import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { z } from "zod";

type AuthUserResponse = Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
type AuthUser = NonNullable<NonNullable<AuthUserResponse["data"]>["user"]>;

const DeactivateSchema = z.object({
  subscription_id: z.string().uuid(),
  reason: z.string().optional(),
});

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

  const { data: membership } = await supabaseAdmin
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "admin") {
    return { error: "Only admins can access this resource", status: 403 };
  }

  return { user, role: membership.role };
}

// POST /api/subscriptions/deactivate - Admin deactivates an active subscription
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeAdmin(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const payload = await req.json();
  const parseResult = DeactivateSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: parseResult.error.issues.map((issue) => issue.message).join(", ")
      },
      { status: 422 }
    );
  }

  const { subscription_id, reason } = parseResult.data;

  // Get subscription
  const { data: subscription, error: fetchError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("id", subscription_id)
    .single();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (subscription.status !== "active") {
    return NextResponse.json(
      { error: `Cannot deactivate subscription with status: ${subscription.status}` },
      { status: 400 }
    );
  }

  // Update subscription status
  const { data: updatedSubscription, error: updateError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .update({
      status: "inactive",
      active_until: new Date().toISOString(),
      notes: reason ? `Deactivated by admin: ${reason}` : "Deactivated by admin",
    })
    .eq("id", subscription_id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: updatedSubscription,
    message: "Subscription deactivated successfully"
  });
}
