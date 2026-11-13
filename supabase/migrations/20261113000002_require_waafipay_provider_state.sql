BEGIN;

UPDATE public.waafipay_subscription_payments
SET provider_state = CASE status
  WHEN 'succeeded' THEN 'approved'
  WHEN 'failed' THEN 'failed'
  ELSE 'unresolved'
END
WHERE provider_state IS NULL OR btrim(provider_state) = '';

ALTER TABLE public.waafipay_subscription_payments
  ALTER COLUMN provider_state SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_waafipay_payment_provider_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.provider_state IS NULL OR btrim(NEW.provider_state) = '' THEN
    NEW.provider_state := CASE NEW.status
      WHEN 'succeeded' THEN 'approved'
      WHEN 'failed' THEN 'failed'
      ELSE 'awaiting_confirmation'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_waafipay_payment_provider_state
  ON public.waafipay_subscription_payments;

CREATE TRIGGER set_waafipay_payment_provider_state
  BEFORE INSERT OR UPDATE ON public.waafipay_subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_waafipay_payment_provider_state();

COMMIT;
