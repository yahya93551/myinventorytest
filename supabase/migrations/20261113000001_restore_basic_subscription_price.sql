-- Restore the Basic subscription price after temporary test pricing.
-- This changes the column default and future confirmed-payment records only.
BEGIN;

ALTER TABLE public.tenant_subscriptions
  ALTER COLUMN monthly_fee SET DEFAULT 5.00;

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

COMMIT;
