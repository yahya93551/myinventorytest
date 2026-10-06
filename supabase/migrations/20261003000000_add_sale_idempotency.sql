CREATE TABLE public.sale_idempotency (
  tenant_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  request_payload jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);

ALTER TABLE public.sale_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.sale_idempotency FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sale_idempotency FROM PUBLIC, service_role;

ALTER FUNCTION public.commit_sale_transaction(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)
RENAME TO commit_sale_transaction_once;

REVOKE ALL PRIVILEGES ON FUNCTION public.commit_sale_transaction_once(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.commit_sale_transaction(
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
  p_refund_reason text,
  p_idempotency_key uuid,
  p_order_id_is_generated boolean,
  p_request_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_expected_payload jsonb;
  v_request_payload jsonb;
  v_refund_reason text;
  v_existing_payload jsonb;
  v_existing_result jsonb;
  v_result jsonb;
  v_claimed integer;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('owner', 'sales') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Invalid sale context.';
  END IF;

  IF p_idempotency_key IS NULL OR p_order_id_is_generated IS NULL OR p_request_payload IS NULL OR jsonb_typeof(p_request_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: A valid idempotency key and sale payload are required.';
  END IF;

  IF (p_order_id_is_generated AND COALESCE(p_order_id !~ '^INV-[0-9]+$', true))
    OR (NOT p_order_id_is_generated AND p_order_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Invalid sale invoice reference.';
  END IF;

  v_expected_payload := jsonb_build_object(
    'user_id', p_user_id,
    'role', p_role,
    'items', p_items,
    'order_id', CASE WHEN p_order_id_is_generated THEN NULL ELSE p_order_id END,
    'customer_name', NULLIF(btrim(p_customer_name), ''),
    'customer_address', NULLIF(btrim(p_customer_address), ''),
    'customer_phone', NULLIF(btrim(p_customer_phone), ''),
    'paid', CASE WHEN p_type = 'return' THEN true ELSE p_paid END,
    'type', p_type,
    'refund_reason', NULLIF(btrim(p_refund_reason), '')
  );
  v_refund_reason := NULLIF(btrim(p_refund_reason), '');

  IF p_request_payload IS DISTINCT FROM v_expected_payload THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_INVALID: Sale payload does not match the transaction parameters.';
  END IF;

  v_request_payload := v_expected_payload;

  INSERT INTO public.sale_idempotency (tenant_id, idempotency_key, request_payload)
  VALUES (p_tenant_id, p_idempotency_key, v_request_payload)
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    SELECT request_payload, result
    INTO v_existing_payload, v_existing_result
    FROM public.sale_idempotency
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_existing_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_IDEMPOTENCY_CONFLICT: This idempotency key was already used for a different sale.';
    END IF;

    IF v_existing_result IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SALE_CONFLICT: The original sale is still being completed; retry.';
    END IF;

    RETURN jsonb_build_object('result', v_existing_result, 'replayed', true);
  END IF;

  v_result := public.commit_sale_transaction_once(
    p_tenant_id,
    p_user_id,
    p_role,
    p_items,
    p_order_id,
    p_customer_name,
    p_customer_address,
    p_customer_phone,
    p_paid,
    p_type,
    v_refund_reason
  );

  UPDATE public.sale_idempotency
  SET result = COALESCE(v_result, '[]'::jsonb)
  WHERE tenant_id = p_tenant_id
    AND idempotency_key = p_idempotency_key;

  RETURN jsonb_build_object('result', COALESCE(v_result, '[]'::jsonb), 'replayed', false);
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.commit_sale_transaction(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text, uuid, boolean, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_sale_transaction(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text, uuid, boolean, jsonb)
TO service_role;