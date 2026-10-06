CREATE OR REPLACE FUNCTION public.get_accounting_tenant_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_members
  WHERE p_user_id = auth.uid()
    AND user_id = p_user_id
    AND role IN ('owner', 'accountant')
    AND active = true;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_tenant_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_members
  WHERE p_user_id = auth.uid()
    AND user_id = p_user_id
    AND active = true;
$function$;

CREATE OR REPLACE FUNCTION public.get_owned_tenant_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_members
  WHERE p_user_id = auth.uid()
    AND user_id = p_user_id
    AND role = 'owner'
    AND active = true;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_tenant_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tenant_id
  FROM public.tenant_members
  WHERE p_user_id = auth.uid()
    AND user_id = p_user_id
    AND role IN ('owner', 'sales')
    AND active = true;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE p_user_id = auth.uid()
      AND user_id = p_user_id
      AND role = 'admin'
      AND active = true
  );
$function$;
