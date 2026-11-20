CREATE TABLE IF NOT EXISTS public.debt_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payment_records_tenant_debt_paid_at
  ON public.debt_payment_records (tenant_id, debt_id, paid_at DESC);

ALTER TABLE public.debt_payment_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.debt_payment_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.debt_payment_records TO service_role;

CREATE OR REPLACE FUNCTION public.record_debt_payment(
  p_tenant_id uuid,
  p_debt_id uuid,
  p_payment_amount numeric
)
RETURNS public.debts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_debt public.debts%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL
    OR p_debt_id IS NULL
    OR p_payment_amount IS NULL
    OR p_payment_amount <= 0
    OR p_payment_amount <> round(p_payment_amount, 2)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEBT_INVALID: Enter a valid payment amount with up to two decimal places.';
  END IF;

  SELECT *
  INTO v_debt
  FROM public.debts
  WHERE tenant_id = p_tenant_id
    AND id = p_debt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEBT_NOT_FOUND: Debt record was not found.';
  END IF;

  IF p_payment_amount > v_debt.amount - v_debt.amount_paid THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEBT_OVERPAYMENT: Payment cannot exceed the remaining balance.';
  END IF;

  UPDATE public.debts
  SET amount_paid = amount_paid + p_payment_amount,
      paid = amount_paid + p_payment_amount >= amount
  WHERE id = p_debt_id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_debt;

  INSERT INTO public.debt_payment_records (tenant_id, debt_id, amount)
  VALUES (p_tenant_id, p_debt_id, p_payment_amount);

  RETURN v_debt;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_debt_payment(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(uuid, uuid, numeric) TO service_role;
