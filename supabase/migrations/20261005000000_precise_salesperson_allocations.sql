ALTER TABLE public.inventory_takes
  ADD COLUMN allocation_mode text NOT NULL DEFAULT 'legacy_base',
  ADD COLUMN conversion_rate_snapshot numeric(10,4),
  ADD COLUMN remaining_converted_quantity numeric(20,4);

UPDATE public.inventory_takes
SET allocation_mode = 'legacy_base',
    conversion_rate_snapshot = NULL,
    remaining_converted_quantity = NULL;

ALTER TABLE public.inventory_takes
  ADD CONSTRAINT inventory_takes_allocation_mode_check
  CHECK (
    (
      allocation_mode = 'legacy_base'
      AND conversion_rate_snapshot IS NULL
      AND remaining_converted_quantity IS NULL
    )
    OR
    (
      allocation_mode = 'converted'
      AND conversion_rate_snapshot IS NOT NULL
      AND conversion_rate_snapshot > 0
      AND remaining_converted_quantity IS NOT NULL
      AND remaining_converted_quantity >= 0
    )
  );

CREATE INDEX idx_inventory_takes_active_allocation
  ON public.inventory_takes (tenant_id, user_id, product_id, allocation_mode, created_at, id)
  WHERE remaining_quantity > 0 OR remaining_converted_quantity > 0;

CREATE OR REPLACE FUNCTION public.get_salesperson_allocation_availability(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  product_id uuid,
  base_quantity numeric,
  converted_quantity numeric,
  conversion_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT
    allocation.product_id,
    sum(
      CASE
        WHEN allocation.allocation_mode = 'legacy_base' THEN allocation.remaining_quantity::numeric
        ELSE floor(allocation.remaining_converted_quantity / allocation.conversion_rate_snapshot)
      END
    ) AS base_quantity,
    sum(
      CASE
        WHEN allocation.allocation_mode = 'converted' THEN allocation.remaining_converted_quantity
        ELSE 0::numeric
      END
    ) AS converted_quantity,
    CASE
      WHEN count(DISTINCT allocation.conversion_rate_snapshot) FILTER (
        WHERE allocation.allocation_mode = 'converted'
          AND allocation.remaining_converted_quantity > 0
      ) = 1
      THEN max(allocation.conversion_rate_snapshot) FILTER (
        WHERE allocation.allocation_mode = 'converted'
          AND allocation.remaining_converted_quantity > 0
      )
      ELSE NULL
    END AS conversion_rate
  FROM public.inventory_takes AS allocation
  WHERE allocation.tenant_id = p_tenant_id
    AND allocation.user_id = p_user_id
    AND (
      (allocation.allocation_mode = 'legacy_base' AND allocation.remaining_quantity > 0)
      OR
      (allocation.allocation_mode = 'converted' AND allocation.remaining_converted_quantity > 0)
    )
  GROUP BY allocation.product_id;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_salesperson_allocation_availability(uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_salesperson_allocation_availability(uuid, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.guard_active_allocation_conversion_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.base_unit IS DISTINCT FROM OLD.base_unit
    OR NEW.converted_unit IS DISTINCT FROM OLD.converted_unit
    OR NEW.conversion_rate IS DISTINCT FROM OLD.conversion_rate
  THEN
    IF EXISTS (
      SELECT 1
      FROM public.inventory_takes AS allocation
      WHERE allocation.tenant_id = OLD.tenant_id
        AND allocation.product_id = OLD.id
        AND allocation.allocation_mode = 'converted'
        AND allocation.remaining_converted_quantity > 0
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'PRODUCT_CONVERSION_LOCKED: Conversion metadata cannot change while converted salesperson stock is allocated.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.guard_active_allocation_conversion_metadata()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS products_guard_active_allocation_conversion_metadata ON public.products;
CREATE TRIGGER products_guard_active_allocation_conversion_metadata
  BEFORE UPDATE OF base_unit, converted_unit, conversion_rate
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_active_allocation_conversion_metadata();

CREATE OR REPLACE FUNCTION public.load_inventory_stock_transaction(
  p_tenant_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_previous_stock integer;
  v_new_stock integer;
  v_allocation_mode text;
  v_conversion_rate_snapshot numeric(10,4);
  v_remaining_converted_quantity numeric(20,4);
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAD_INVALID: Invalid load request.';
  END IF;

  SELECT product.* INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAD_NOT_FOUND: Product not found.';
  END IF;

  v_previous_stock := COALESCE(v_product.stock, 0);
  IF v_previous_stock < p_quantity THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAD_STOCK: Cannot take more than available stock.';
  END IF;

  UPDATE public.products
  SET stock = COALESCE(stock, 0) - p_quantity
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
    AND stock >= p_quantity
  RETURNING stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAD_STOCK: Stock changed while loading; retry.';
  END IF;

  IF NULLIF(btrim(v_product.base_unit), '') IS NOT NULL
    AND NULLIF(btrim(v_product.converted_unit), '') IS NOT NULL
    AND v_product.conversion_rate IS NOT NULL
    AND v_product.conversion_rate > 0
  THEN
    v_allocation_mode := 'converted';
    v_conversion_rate_snapshot := v_product.conversion_rate;
    v_remaining_converted_quantity := p_quantity::numeric * v_conversion_rate_snapshot;
  ELSE
    v_allocation_mode := 'legacy_base';
    v_conversion_rate_snapshot := NULL;
    v_remaining_converted_quantity := NULL;
  END IF;

  INSERT INTO public.inventory_takes (
    tenant_id,
    user_id,
    product_id,
    product_name,
    quantity_taken,
    remaining_quantity,
    reason,
    created_by,
    allocation_mode,
    conversion_rate_snapshot,
    remaining_converted_quantity
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_product_id,
    v_product.name,
    p_quantity,
    p_quantity,
    p_reason,
    p_user_id,
    v_allocation_mode,
    v_conversion_rate_snapshot,
    v_remaining_converted_quantity
  );

  RETURN jsonb_build_object(
    'previous_stock', v_previous_stock,
    'stock', v_new_stock,
    'allocation_mode', v_allocation_mode,
    'conversion_rate_snapshot', v_conversion_rate_snapshot,
    'remaining_converted_quantity', v_remaining_converted_quantity
  );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.load_inventory_stock_transaction(uuid, uuid, uuid, integer, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_inventory_stock_transaction(uuid, uuid, uuid, integer, text)
TO service_role;

CREATE OR REPLACE FUNCTION public.drop_inventory_take_transaction(
  p_tenant_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_allocation record;
  v_total_base_available numeric := 0;
  v_remaining_to_drop numeric;
  v_available_base numeric;
  v_consume numeric;
  v_converted_debit numeric;
  v_new_stock integer;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_INVALID: Invalid drop request.';
  END IF;

  SELECT product.* INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_NOT_FOUND: Product not found.';
  END IF;

  FOR v_allocation IN
    SELECT allocation.id,
           allocation.allocation_mode,
           allocation.remaining_quantity,
           allocation.conversion_rate_snapshot,
           allocation.remaining_converted_quantity
    FROM public.inventory_takes AS allocation
    WHERE allocation.tenant_id = p_tenant_id
      AND allocation.user_id = p_user_id
      AND allocation.product_id = p_product_id
      AND (
        (allocation.allocation_mode = 'legacy_base' AND allocation.remaining_quantity > 0)
        OR
        (allocation.allocation_mode = 'converted' AND allocation.remaining_converted_quantity > 0)
      )
    ORDER BY allocation.created_at, allocation.id
    FOR UPDATE
  LOOP
    IF v_allocation.allocation_mode = 'legacy_base' THEN
      v_total_base_available := v_total_base_available + v_allocation.remaining_quantity;
    ELSE
      v_total_base_available := v_total_base_available
        + floor(v_allocation.remaining_converted_quantity / v_allocation.conversion_rate_snapshot);
    END IF;
  END LOOP;

  IF v_total_base_available <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_NO_STOCK: No whole base-unit stock available to drop.';
  END IF;

  IF p_quantity::numeric > v_total_base_available THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_EXCEEDS_TAKEN: Cannot drop more than the whole base-unit allocation.';
  END IF;

  v_remaining_to_drop := p_quantity;
  FOR v_allocation IN
    SELECT allocation.id,
           allocation.allocation_mode,
           allocation.remaining_quantity,
           allocation.conversion_rate_snapshot,
           allocation.remaining_converted_quantity
    FROM public.inventory_takes AS allocation
    WHERE allocation.tenant_id = p_tenant_id
      AND allocation.user_id = p_user_id
      AND allocation.product_id = p_product_id
      AND (
        (allocation.allocation_mode = 'legacy_base' AND allocation.remaining_quantity > 0)
        OR
        (allocation.allocation_mode = 'converted' AND allocation.remaining_converted_quantity > 0)
      )
    ORDER BY allocation.created_at, allocation.id
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_drop <= 0;

    IF v_allocation.allocation_mode = 'legacy_base' THEN
      v_consume := LEAST(v_allocation.remaining_quantity, v_remaining_to_drop);
      UPDATE public.inventory_takes
      SET remaining_quantity = remaining_quantity - v_consume::integer
      WHERE id = v_allocation.id
        AND tenant_id = p_tenant_id
        AND user_id = p_user_id
        AND product_id = p_product_id
        AND allocation_mode = 'legacy_base'
        AND remaining_quantity >= v_consume::integer;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_CONFLICT: Allocation changed while dropping stock; retry.';
      END IF;
    ELSE
      v_available_base := floor(v_allocation.remaining_converted_quantity / v_allocation.conversion_rate_snapshot);
      v_consume := LEAST(v_available_base, v_remaining_to_drop);
      IF v_consume > 0 THEN
        v_converted_debit := v_consume * v_allocation.conversion_rate_snapshot;
        UPDATE public.inventory_takes
        SET remaining_converted_quantity = remaining_converted_quantity - v_converted_debit,
            remaining_quantity = floor((remaining_converted_quantity - v_converted_debit) / conversion_rate_snapshot)::integer
        WHERE id = v_allocation.id
          AND tenant_id = p_tenant_id
          AND user_id = p_user_id
          AND product_id = p_product_id
          AND allocation_mode = 'converted'
          AND remaining_converted_quantity >= v_converted_debit;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_CONFLICT: Allocation changed while dropping stock; retry.';
        END IF;
      END IF;
    END IF;

    v_remaining_to_drop := v_remaining_to_drop - v_consume;
  END LOOP;

  IF v_remaining_to_drop > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_CONFLICT: Allocation changed while dropping stock; retry.';
  END IF;

  UPDATE public.products
  SET stock = COALESCE(stock, 0) + p_quantity
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
  RETURNING stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_NOT_FOUND: Product not found.';
  END IF;

  RETURN jsonb_build_object('dropped', p_quantity, 'stock', v_new_stock);
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.drop_inventory_take_transaction(uuid, uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drop_inventory_take_transaction(uuid, uuid, uuid, integer)
TO service_role;

DO $migration$
DECLARE
  v_function_definition text;
  v_start integer;
  v_end integer;
  v_branch text := $branch$
    ELSIF p_role = 'sales'
      AND EXISTS (
        SELECT 1
        FROM public.business_settings AS settings
        WHERE settings.tenant_id = p_tenant_id
          AND settings.business_type = 'warehouse'
      )
    THEN
      v_remaining := v_quantity;
      FOR v_allocation IN
        SELECT allocation.id,
               allocation.allocation_mode,
               allocation.remaining_quantity,
               allocation.conversion_rate_snapshot,
               allocation.remaining_converted_quantity
        FROM public.inventory_takes AS allocation
        WHERE allocation.tenant_id = p_tenant_id
          AND allocation.user_id = p_user_id
          AND allocation.product_id = v_product.id
          AND (
            (v_unit = 'base' AND allocation.allocation_mode = 'legacy_base' AND allocation.remaining_quantity > 0)
            OR
            (allocation.allocation_mode = 'converted' AND allocation.remaining_converted_quantity > 0)
          )
        ORDER BY allocation.created_at, allocation.id
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_consume := 0;

        IF v_unit = 'base' AND v_allocation.allocation_mode = 'legacy_base' THEN
          v_consume := LEAST(v_allocation.remaining_quantity, v_remaining);
          UPDATE public.inventory_takes
          SET remaining_quantity = remaining_quantity - v_consume::integer
          WHERE id = v_allocation.id
            AND tenant_id = p_tenant_id
            AND user_id = p_user_id
            AND product_id = v_product.id
            AND allocation_mode = 'legacy_base'
            AND remaining_quantity >= v_consume::integer;
          IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_CONFLICT: Allocation changed while completing the sale; retry.';
          END IF;
        ELSE
          v_available_converted := CASE
            WHEN v_unit = 'base'
              THEN floor(v_allocation.remaining_converted_quantity / v_allocation.conversion_rate_snapshot)
            ELSE v_allocation.remaining_converted_quantity
          END;
          v_consume := LEAST(v_available_converted, v_remaining);

          IF v_consume > 0 THEN
            v_allocation_debit := CASE
              WHEN v_unit = 'base' THEN v_consume * v_allocation.conversion_rate_snapshot
              ELSE v_consume
            END;
            UPDATE public.inventory_takes
            SET remaining_converted_quantity = remaining_converted_quantity - v_allocation_debit,
                remaining_quantity = floor((remaining_converted_quantity - v_allocation_debit) / conversion_rate_snapshot)::integer
            WHERE id = v_allocation.id
              AND tenant_id = p_tenant_id
              AND user_id = p_user_id
              AND product_id = v_product.id
              AND allocation_mode = 'converted'
              AND remaining_converted_quantity >= v_allocation_debit;
            IF NOT FOUND THEN
              RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_CONFLICT: Allocation changed while completing the sale; retry.';
            END IF;
          END IF;
        END IF;

        v_remaining := v_remaining - v_consume;
      END LOOP;

      IF v_remaining > 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_STOCK: Insufficient allocated stock for %s.', v_product.name);
      END IF;
$branch$;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.commit_sale_transaction_once(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)'::regprocedure
  )
  INTO v_function_definition;

  IF position('  v_has_type_column boolean;' IN v_function_definition) = 0
    OR position('  v_allocation_debit numeric;' IN v_function_definition) > 0
  THEN
    RAISE EXCEPTION 'Unexpected commit_sale_transaction_once declaration; refusing to replace the sale branch.';
  END IF;

  v_function_definition := replace(
    v_function_definition,
    '  v_has_type_column boolean;',
    '  v_has_type_column boolean;' || E'\n' || '  v_allocation_debit numeric;'
  );

  v_start := position('    ELSIF p_role = ''sales'' AND v_unit = ''base'' THEN' IN v_function_definition);
  IF v_start = 0 THEN
    v_start := position('    ELSIF p_role = ''sales'' THEN' IN v_function_definition);
  END IF;
  IF v_start = 0 THEN
    RAISE EXCEPTION 'Expected salesperson allocation branch was not found.';
  END IF;

  v_end := v_start + position(
    '    ELSIF v_unit = ''converted'' THEN'
    IN substring(v_function_definition FROM v_start)
  ) - 1;
  IF v_end < v_start THEN
    RAISE EXCEPTION 'Expected central converted-sale branch was not found.';
  END IF;

  v_function_definition := substring(v_function_definition FROM 1 FOR v_start - 1)
    || v_branch
    || substring(v_function_definition FROM v_end);

  EXECUTE v_function_definition;
END;
$migration$;
