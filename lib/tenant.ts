import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/apiClient";

export type TenantRole = "owner" | "accountant" | "sales";

export interface TenantContext {
  tenant_id: string;
  role: TenantRole;
  user_id: string;
  user_email: string;
}

export async function getTenantContext(): Promise<TenantContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Authentication required");
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required");
  }

  const res = await fetch("/api/tenant-context", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const result = await res.json();

  if (!res.ok || !result?.success) {
    throw new Error(result?.error || "Failed to load tenant context");
  }

  return {
    tenant_id: result.data.tenant_id,
    role: result.data.role,
    user_id: result.data.user_id,
    user_email: result.data.user_email ?? "",
  };
}
