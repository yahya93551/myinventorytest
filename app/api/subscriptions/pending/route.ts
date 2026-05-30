import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuthUserResponse = Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
type AuthUser = NonNullable<NonNullable<AuthUserResponse["data"]>["user"]>;

interface AdminAuthSuccess {
  user: AuthUser;
  role: string;
}

interface AdminAuthError {
  error: string;
  status?: number;
}

async function authorizeAdmin(authHeader: string | null | undefined): Promise<AdminAuthSuccess | AdminAuthError> {
  if (!authHeader) {
    return { error: "Missing authorization token" };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
  if (userError || !userData.user) {
    return { error: "Invalid or expired session" };
  }

  const user = userData.user;

  // Admins don't have a tenant_id in tenant_members - they manage across the system
  // Check if user exists in tenant_members (should be superadmin or similar)
  const { data: membership } = await supabaseAdmin
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  // If user has admin role in tenant_members, allow access
  if (membership?.role !== "admin") {
    return { error: "Only admins can access this resource", status: 403 };
  }

  return { user, role: membership.role };
}

// GET /api/subscriptions/pending - Get all pending subscription requests
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeAdmin(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { data: pendingSubscriptions, error } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch owner emails for each subscription
  const subscriptionsWithOwners = await Promise.all(
    (pendingSubscriptions || []).map(async (sub) => {
      const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(sub.tenant_id);
      return {
        ...sub,
        owner_email: ownerData?.user?.email || "Unknown"
      };
    })
  );

  return NextResponse.json({ success: true, data: subscriptionsWithOwners });
}
