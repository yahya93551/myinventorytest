ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.debts
SET amount_paid = amount
WHERE paid = true
  AND amount_paid = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'debts_amount_paid_within_amount'
      AND conrelid = 'public.debts'::regclass
  ) THEN
    ALTER TABLE public.debts
      ADD CONSTRAINT debts_amount_paid_within_amount
      CHECK (amount_paid >= 0 AND amount_paid <= amount);
  END IF;
END;
$$;

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

  RETURN v_debt;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_debt_payment(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(uuid, uuid, numeric) TO service_role;
