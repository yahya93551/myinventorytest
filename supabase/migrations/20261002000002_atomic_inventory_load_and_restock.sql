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

  INSERT INTO public.inventory_takes (
    tenant_id,
    user_id,
    product_id,
    product_name,
    quantity_taken,
    remaining_quantity,
    reason,
    created_by
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_product_id,
    v_product.name,
    p_quantity,
    p_quantity,
    p_reason,
    p_user_id
  );

  RETURN jsonb_build_object(
    'previous_stock', v_previous_stock,
    'stock', v_new_stock
  );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.load_inventory_stock_transaction(uuid, uuid, uuid, integer, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_inventory_stock_transaction(uuid, uuid, uuid, integer, text)
TO service_role;

CREATE OR REPLACE FUNCTION public.restock_inventory_stock_transaction(
  p_tenant_id uuid,
  p_product_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_stock integer;
BEGIN
  IF p_tenant_id IS NULL OR p_product_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESTOCK_INVALID: Invalid restock request.';
  END IF;

  UPDATE public.products
  SET stock = COALESCE(stock, 0) + p_amount
  WHERE id = p_product_id
    AND tenant_id = p_tenant_id
  RETURNING stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESTOCK_NOT_FOUND: Product not found.';
  END IF;

  RETURN jsonb_build_object(
    'previous_stock', v_new_stock - p_amount,
    'stock', v_new_stock
  );
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.restock_inventory_stock_transaction(uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restock_inventory_stock_transaction(uuid, uuid, integer)
TO service_role;