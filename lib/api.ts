import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ServerTenantContext {
  userId: string;
  tenantId: string;
  role: string;
  active: boolean;
}

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string | undefined, status = 400) {
  return NextResponse.json(
    { success: false, error: message || "An error occurred" },
    { status }
  );
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim();
}

export async function getAuthenticatedUser(
  req: Request
): Promise<{ user: User } | { error: string; status: number }> {
  const token = getBearerToken(req);
  if (!token) {
    return { error: "Missing authorization token", status: 401 };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid or expired session", status: 401 };
  }

  return { user: data.user };
}

export async function getServerTenantContext(
  req: Request
): Promise<ServerTenantContext | { error: string; status: number }> {
  const auth = await getAuthenticatedUser(req);
  if ("error" in auth) {
    return auth;
  }

  const userId = auth.user.id;
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id, role, active")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message || "Failed to load tenant membership", status: 500 };
  }

  if (membership) {
    if (!membership.active) {
      return { error: "Your account is inactive", status: 403 };
    }

    return {
      userId,
      tenantId: membership.tenant_id,
      role: membership.role,
      active: membership.active,
    };
  }

  const { data: createdMembership, error: createMembershipError } = await supabaseAdmin
    .from("tenant_members")
    .insert({
      tenant_id: userId,
      user_id: userId,
      user_email: auth.user.email || "",
      role: "owner",
      active: true,
      created_by: userId,
    })
    .select("tenant_id, role, active")
    .single();

  if (createMembershipError || !createdMembership) {
    return { error: createMembershipError?.message || "Failed to create tenant membership", status: 500 };
  }

  return {
    userId,
    tenantId: createdMembership.tenant_id,
    role: createdMembership.role,
    active: createdMembership.active,
  };
}

export async function getTenantIdForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.tenant_id ?? userId; // Default to the user-owned tenant
}
