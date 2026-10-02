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
        AND factor.factor_type IN ('totp', 'phone')
    )
    OR COALESCE(auth.jwt()->>'aal' = 'aal2', false);
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.mfa_assurance_satisfied()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_assurance_satisfied()
TO authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE
  public.products,
  public.sales,
  public.categories,
  public.custom_fields,
  public.business_settings
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE
  public.sales,
  public.categories,
  public.custom_fields,
  public.business_settings
TO authenticated;