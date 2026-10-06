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
  v_total_remaining bigint := 0;
  v_remaining_to_drop integer;
  v_consume integer;
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
    SELECT allocation.id, allocation.remaining_quantity
    FROM public.inventory_takes AS allocation
    WHERE allocation.tenant_id = p_tenant_id
      AND allocation.user_id = p_user_id
      AND allocation.product_id = p_product_id
      AND allocation.remaining_quantity > 0
    ORDER BY allocation.created_at, allocation.id
    FOR UPDATE
  LOOP
    v_total_remaining := v_total_remaining + v_allocation.remaining_quantity;
  END LOOP;

  IF v_total_remaining <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_NO_STOCK: No taken stock available to drop';
  END IF;

  IF p_quantity::bigint > v_total_remaining THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_EXCEEDS_TAKEN: Cannot drop more than the taken quantity';
  END IF;

  v_remaining_to_drop := p_quantity;
  FOR v_allocation IN
    SELECT allocation.id, allocation.remaining_quantity
    FROM public.inventory_takes AS allocation
    WHERE allocation.tenant_id = p_tenant_id
      AND allocation.user_id = p_user_id
      AND allocation.product_id = p_product_id
      AND allocation.remaining_quantity > 0
    ORDER BY allocation.created_at, allocation.id
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_drop <= 0;
    v_consume := LEAST(v_allocation.remaining_quantity, v_remaining_to_drop);

    UPDATE public.inventory_takes
    SET remaining_quantity = remaining_quantity - v_consume
    WHERE id = v_allocation.id
      AND tenant_id = p_tenant_id
      AND user_id = p_user_id
      AND product_id = p_product_id
      AND remaining_quantity >= v_consume;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DROP_CONFLICT: Allocation changed while dropping stock; retry.';
    END IF;

    v_remaining_to_drop := v_remaining_to_drop - v_consume;
  END LOOP;

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