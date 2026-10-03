CREATE OR REPLACE FUNCTION public.commit_sale_transaction(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role text,
  p_items jsonb,
  p_order_id text,
  p_customer_name text,
  p_customer_address text,
  p_customer_phone text,
  p_paid boolean,
  p_type text,
  p_refund_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_lock record;
  v_allocation record;
  v_quantity numeric;
  v_remaining numeric;
  v_consume numeric;
  v_conversion_rate numeric;
  v_available_converted numeric;
  v_remaining_converted numeric;
  v_new_stock integer;
  v_new_remainder integer;
  v_unit text;
  v_unit_label text;
  v_line_total numeric;
  v_debt_total numeric := 0;
  v_sold_balance numeric;
  v_returned_so_far numeric;
  v_returned_by_product jsonb := '{}'::jsonb;
  v_product_rows jsonb := '[]'::jsonb;
  v_insert_columns text;
  v_inserted jsonb;
  v_unique_product_count integer;
  v_locked_product_count integer;
  v_has_type_column boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('owner', 'sales') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Invalid sale context.';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Add at least one product to the sale.';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('sale', 'return') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Invalid sale type.';
  END IF;

  IF p_type = 'sale' AND NOT p_paid AND (NULLIF(btrim(p_customer_name), '') IS NULL OR NULLIF(btrim(p_customer_phone), '') IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Customer name and phone are required for unpaid sales.';
  END IF;

  SELECT count(DISTINCT (item->>'product_id')::uuid)::integer
  INTO v_unique_product_count
  FROM jsonb_array_elements(p_items) AS items(item);

  FOR v_lock IN
    SELECT product.id
    FROM public.products AS product
    WHERE product.tenant_id = p_tenant_id
      AND product.id IN (
        SELECT DISTINCT (item->>'product_id')::uuid
        FROM jsonb_array_elements(p_items) AS items(item)
      )
    ORDER BY product.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  SELECT count(*)::integer
  INTO v_locked_product_count
  FROM public.products AS product
  WHERE product.tenant_id = p_tenant_id
    AND product.id IN (
      SELECT DISTINCT (item->>'product_id')::uuid
      FROM jsonb_array_elements(p_items) AS items(item)
    );

  IF v_locked_product_count <> v_unique_product_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_NOT_FOUND: One or more products were not found.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.sales'::regclass
      AND attname = 'type'
      AND attnum > 0
      AND NOT attisdropped
  ) INTO v_has_type_column;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS items(value)
  LOOP
    v_quantity := (v_item->>'quantity')::numeric;
    IF v_quantity < 1 OR v_quantity <> trunc(v_quantity) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Sale quantities must be positive whole numbers.';
    END IF;

    v_unit := CASE WHEN v_item->>'unit' = 'converted' THEN 'converted' ELSE 'base' END;

    SELECT * INTO v_product
    FROM public.products AS product
    WHERE product.id = (v_item->>'product_id')::uuid
      AND product.tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_NOT_FOUND: Product not found.';
    END IF;

    v_conversion_rate := v_product.conversion_rate;
    v_unit_label := CASE
      WHEN v_unit = 'converted' THEN COALESCE(NULLIF(btrim(v_product.converted_unit), ''), 'converted unit')
      ELSE COALESCE(NULLIF(btrim(v_product.base_unit), ''), 'base unit')
    END;

    IF p_type = 'return' THEN
      IF v_has_type_column THEN
        EXECUTE $query$
          SELECT COALESCE(SUM(CASE WHEN sale.type = 'return' THEN -sale.quantity ELSE sale.quantity END), 0)
          FROM public.sales AS sale
          WHERE sale.tenant_id = $1
            AND sale.product_id = $2
            AND ($3::text IS NULL OR sale.order_id = $3)
            AND ($4::text IS NULL OR sale.customer_name ILIKE $4)
            AND (NOT $5::boolean OR sale.user_id = $6)
        $query$
        INTO v_sold_balance
        USING p_tenant_id, v_product.id, p_order_id, p_customer_name, p_role = 'sales', p_user_id;
      ELSE
        EXECUTE $query$
          SELECT COALESCE(SUM(sale.quantity), 0)
          FROM public.sales AS sale
          WHERE sale.tenant_id = $1
            AND sale.product_id = $2
            AND ($3::text IS NULL OR sale.order_id = $3)
            AND ($4::text IS NULL OR sale.customer_name ILIKE $4)
            AND (NOT $5::boolean OR sale.user_id = $6)
        $query$
        INTO v_sold_balance
        USING p_tenant_id, v_product.id, p_order_id, p_customer_name, p_role = 'sales', p_user_id;
      END IF;

      v_returned_so_far := COALESCE((v_returned_by_product->>v_product.id::text)::numeric, 0);
      v_sold_balance := GREATEST(0, v_sold_balance - v_returned_so_far);
      IF v_quantity > v_sold_balance THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_INVALID: Return quantity for %s exceeds the remaining sold quantity (%s).', v_product.name, v_sold_balance);
      END IF;
      v_returned_by_product := jsonb_set(v_returned_by_product, ARRAY[v_product.id::text], to_jsonb(v_returned_so_far + v_quantity), true);

      IF v_unit = 'converted' THEN
        IF v_conversion_rate IS NULL OR v_conversion_rate <= 0 THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_INVALID: Product %s does not support converted-unit returns.', v_product.name);
        END IF;
        v_available_converted := COALESCE(v_product.stock, 0) * v_conversion_rate + COALESCE(v_product.stock_remainder, 0);
        v_remaining_converted := v_available_converted + v_quantity;
        v_new_stock := floor(v_remaining_converted / v_conversion_rate)::integer;
        v_new_remainder := mod(v_remaining_converted, v_conversion_rate)::integer;
        UPDATE public.products
        SET stock = v_new_stock, stock_remainder = v_new_remainder
        WHERE id = v_product.id AND tenant_id = p_tenant_id;
      ELSE
        UPDATE public.products
        SET stock = COALESCE(v_product.stock, 0) + v_quantity::integer
        WHERE id = v_product.id AND tenant_id = p_tenant_id;
      END IF;
    ELSIF p_role = 'sales' AND v_unit = 'base' THEN
      v_remaining := v_quantity;
      FOR v_allocation IN
        SELECT allocation.id, allocation.remaining_quantity
        FROM public.inventory_takes AS allocation
        WHERE allocation.tenant_id = p_tenant_id
          AND allocation.user_id = p_user_id
          AND allocation.product_id = v_product.id
          AND allocation.remaining_quantity > 0
        ORDER BY allocation.created_at, allocation.id
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_consume := LEAST(v_allocation.remaining_quantity, v_remaining);
        UPDATE public.inventory_takes
        SET remaining_quantity = remaining_quantity - v_consume::integer
        WHERE id = v_allocation.id
          AND tenant_id = p_tenant_id
          AND user_id = p_user_id
          AND remaining_quantity >= v_consume::integer;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_CONFLICT: Allocation changed while completing the sale; retry.';
        END IF;
        v_remaining := v_remaining - v_consume;
      END LOOP;
      IF v_remaining > 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_STOCK: Insufficient taken stock for %s.', v_product.name);
      END IF;
    ELSIF v_unit = 'converted' THEN
      IF v_conversion_rate IS NULL OR v_conversion_rate <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_INVALID: Product %s does not support converted-unit sales.', v_product.name);
      END IF;
      v_available_converted := COALESCE(v_product.stock, 0) * v_conversion_rate + COALESCE(v_product.stock_remainder, 0);
      IF v_quantity > v_available_converted THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_STOCK: Insufficient stock for %s.', v_product.name);
      END IF;
      v_remaining_converted := v_available_converted - v_quantity;
      v_new_stock := floor(v_remaining_converted / v_conversion_rate)::integer;
      v_new_remainder := mod(v_remaining_converted, v_conversion_rate)::integer;
      UPDATE public.products
      SET stock = v_new_stock, stock_remainder = v_new_remainder
      WHERE id = v_product.id AND tenant_id = p_tenant_id;
    ELSE
      IF COALESCE(v_product.stock, 0) < v_quantity THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_STOCK: Insufficient stock for %s.', v_product.name);
      END IF;
      UPDATE public.products
      SET stock = COALESCE(v_product.stock, 0) - v_quantity::integer
      WHERE id = v_product.id
        AND tenant_id = p_tenant_id
        AND stock >= v_quantity::integer;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_CONFLICT: Stock for %s changed while completing the sale; retry.', v_product.name);
      END IF;
    END IF;

    v_line_total := v_quantity * COALESCE(v_product.price, 0);
    IF v_unit = 'converted' AND v_conversion_rate IS NOT NULL AND v_conversion_rate > 0 THEN
      v_line_total := (v_quantity / v_conversion_rate) * COALESCE(v_product.price, 0);
    END IF;
    v_line_total := round(abs(v_line_total), 2);

    v_product_rows := v_product_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'type', p_type,
      'refund_reason', CASE WHEN p_type = 'return' THEN p_refund_reason ELSE NULL END,
      'unit', v_unit,
      'quantity_unit', v_unit_label,
      'total', v_line_total,
      'tenant_id', p_tenant_id,
      'user_id', p_user_id,
      'created_by', p_user_id,
      'order_id', p_order_id,
      'customer_name', NULLIF(btrim(p_customer_name), ''),
      'customer_address', NULLIF(btrim(p_customer_address), ''),
      'customer_phone', NULLIF(btrim(p_customer_phone), ''),
      'paid', CASE WHEN p_type = 'return' THEN true ELSE p_paid END
    ));

    IF p_type = 'sale' AND NOT p_paid THEN
      v_debt_total := v_debt_total + v_line_total;
    END IF;
  END LOOP;

  SELECT string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum)
  INTO v_insert_columns
  FROM pg_catalog.pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.sales'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND attribute.attname IN (
      SELECT jsonb_object_keys(v_product_rows->0)
    );

  IF v_insert_columns IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_SCHEMA: No compatible sales columns were found.';
  END IF;

  EXECUTE format(
    'WITH mapped AS (
       SELECT (jsonb_populate_record(NULL::public.sales, value)).*
       FROM jsonb_array_elements($1) AS input(value)
     ), inserted AS (
       INSERT INTO public.sales (%1$s)
       SELECT %1$s FROM mapped
       RETURNING *
     )
     SELECT COALESCE(jsonb_agg(to_jsonb(inserted)), ''[]''::jsonb) FROM inserted',
    v_insert_columns
  ) INTO v_inserted USING v_product_rows;

  IF p_type = 'sale' AND NOT p_paid THEN
    INSERT INTO public.debts (
      tenant_id, user_id, created_by, customer_name, customer_phone, amount, date, note, paid
    ) VALUES (
      p_tenant_id,
      p_user_id,
      p_user_id,
      btrim(p_customer_name),
      btrim(p_customer_phone),
      v_debt_total,
      CURRENT_DATE::text,
      'Unpaid sale ' || p_order_id,
      false
    );
  END IF;

  RETURN COALESCE(v_inserted, '[]'::jsonb);
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.commit_sale_transaction(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_sale_transaction(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)
TO service_role;
