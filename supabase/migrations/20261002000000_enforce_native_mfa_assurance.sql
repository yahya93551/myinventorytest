CREATE OR REPLACE FUNCTION public.mfa_assurance_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM auth.mfa_factors AS factor
      WHERE factor.user_id = auth.uid()
        AND factor.status = 'verified'
    )
    OR COALESCE(auth.jwt()->>'aal' = 'aal2', false);
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.mfa_assurance_satisfied()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_assurance_satisfied()
TO authenticated, service_role;

CREATE POLICY products_mfa_assurance ON public.products
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_assurance_satisfied())
  WITH CHECK (public.mfa_assurance_satisfied());

CREATE POLICY sales_mfa_assurance ON public.sales
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_assurance_satisfied())
  WITH CHECK (public.mfa_assurance_satisfied());

CREATE POLICY categories_mfa_assurance ON public.categories
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_assurance_satisfied())
  WITH CHECK (public.mfa_assurance_satisfied());

CREATE POLICY custom_fields_mfa_assurance ON public.custom_fields
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_assurance_satisfied())
  WITH CHECK (public.mfa_assurance_satisfied());

CREATE POLICY business_settings_mfa_assurance ON public.business_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_assurance_satisfied())
  WITH CHECK (public.mfa_assurance_satisfied());
