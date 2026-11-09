BEGIN;

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_duration_months integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.waafipay_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reference_id text NOT NULL UNIQUE
    CHECK (reference_id ~ '^[A-Za-z0-9._-]{1,50}$'),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'unlimited')),
  duration_months integer NOT NULL CHECK (duration_months IN (1, 3, 6, 12)),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  merchant_uid text NOT NULL,
  provider_state text,
  provider_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_waafipay_one_pending_payment_per_tenant
  ON public.waafipay_subscription_payments (tenant_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.waafipay_subscription_webhook_events (
  event_id text PRIMARY KEY,
  reference_id text NOT NULL
    REFERENCES public.waafipay_subscription_payments(reference_id),
  event text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waafipay_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waafipay_subscription_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.waafipay_subscription_payments FROM anon, authenticated;
REVOKE ALL ON public.waafipay_subscription_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.waafipay_subscription_payments TO service_role;
GRANT SELECT, INSERT ON public.waafipay_subscription_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.apply_waafipay_verified_result(
  p_reference_id text,
  p_outcome text,
  p_provider_state text,
  p_provider_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payment_row public.waafipay_subscription_payments%ROWTYPE;
  subscription_row public.tenant_subscriptions%ROWTYPE;
  now_at timestamptz := now();
  expiry_start timestamptz;
  expiry_at timestamptz;
  monthly_fee numeric(8, 2);
BEGIN
  IF p_outcome NOT IN ('pending', 'succeeded', 'failed') THEN
    RAISE EXCEPTION 'Invalid verified payment outcome';
  END IF;

  SELECT * INTO payment_row
  FROM public.waafipay_subscription_payments
  WHERE reference_id = p_reference_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  IF payment_row.status IN ('succeeded', 'failed') THEN
    RETURN jsonb_build_object(
      'referenceId', payment_row.reference_id,
      'status', payment_row.status,
      'duplicate', true
    );
  END IF;

  IF p_outcome = 'pending' THEN
    UPDATE public.waafipay_subscription_payments
    SET provider_state = p_provider_state,
        provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
        updated_at = now_at
    WHERE id = payment_row.id;
    RETURN jsonb_build_object(
      'referenceId', payment_row.reference_id,
      'status', 'pending',
      'duplicate', false
    );
  END IF;

  UPDATE public.waafipay_subscription_payments
  SET status = p_outcome,
      provider_state = p_provider_state,
      provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
      verified_at = now_at,
      updated_at = now_at
  WHERE id = payment_row.id;

  IF p_outcome = 'succeeded' THEN
    monthly_fee := CASE payment_row.plan
      WHEN 'basic' THEN 5.00
      WHEN 'pro' THEN 7.00
      WHEN 'unlimited' THEN 10.00
    END;

    SELECT * INTO subscription_row
    FROM public.tenant_subscriptions
    WHERE tenant_id = payment_row.tenant_id
    FOR UPDATE;

    expiry_start := CASE
      WHEN FOUND AND subscription_row.status = 'active'
        AND subscription_row.active_until > now_at
        THEN subscription_row.active_until
      ELSE now_at
    END;
    expiry_at := expiry_start + make_interval(months => payment_row.duration_months);

    INSERT INTO public.tenant_subscriptions (
      tenant_id,
      status,
      monthly_fee,
      plan,
      subscription_duration_months,
      billing_date,
      next_billing_date,
      active_until,
      approved_at,
      approved_by,
      updated_at
    )
    VALUES (
      payment_row.tenant_id,
      'active',
      monthly_fee,
      payment_row.plan,
      payment_row.duration_months,
      now_at::date,
      expiry_at::date,
      expiry_at,
      now_at,
      NULL,
      now_at
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      status = 'active',
      monthly_fee = EXCLUDED.monthly_fee,
      plan = EXCLUDED.plan,
      subscription_duration_months = EXCLUDED.subscription_duration_months,
      billing_date = EXCLUDED.billing_date,
      next_billing_date = EXCLUDED.next_billing_date,
      active_until = EXCLUDED.active_until,
      approved_at = EXCLUDED.approved_at,
      approved_by = NULL,
      updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN jsonb_build_object(
    'referenceId', payment_row.reference_id,
    'status', p_outcome,
    'duplicate', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_waafipay_subscription_webhook(
  p_event_id text,
  p_event text,
  p_reference_id text,
  p_status text,
  p_provider_transaction_id text,
  p_amount_minor integer,
  p_currency text,
  p_merchant_uid text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  payment_row public.waafipay_subscription_payments%ROWTYPE;
  result jsonb;
  payment_outcome text;
BEGIN
  IF p_event NOT IN ('authorization', 'declined')
    OR p_status NOT IN ('APPROVED', 'DECLINED', 'FAILED', 'CANCELLED')
    OR p_event_id IS NULL OR length(p_event_id) < 1 OR length(p_event_id) > 200 THEN
    RAISE EXCEPTION 'Invalid WaafiPay webhook event';
  END IF;

  SELECT * INTO payment_row
  FROM public.waafipay_subscription_payments
  WHERE reference_id = p_reference_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  IF payment_row.merchant_uid <> p_merchant_uid
    OR payment_row.amount_minor <> p_amount_minor
    OR payment_row.currency <> upper(p_currency) THEN
    RAISE EXCEPTION 'WaafiPay webhook does not match the recorded payment';
  END IF;

  INSERT INTO public.waafipay_subscription_webhook_events (
    event_id,
    reference_id,
    event,
    status
  )
  VALUES (p_event_id, p_reference_id, p_event, p_status)
  ON CONFLICT (event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', payment_row.status, 'duplicate', true);
  END IF;

  payment_outcome := CASE
    WHEN p_event = 'authorization' AND p_status = 'APPROVED' THEN 'succeeded'
    WHEN p_status IN ('DECLINED', 'FAILED', 'CANCELLED') THEN 'failed'
    ELSE 'pending'
  END;

  result := public.apply_waafipay_verified_result(
    p_reference_id,
    payment_outcome,
    lower(p_status),
    p_provider_transaction_id
  );

  RETURN result || jsonb_build_object('duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_waafipay_verified_result(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_waafipay_subscription_webhook(text, text, text, text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_waafipay_verified_result(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_waafipay_subscription_webhook(text, text, text, text, text, integer, text, text) TO service_role;

COMMIT;
