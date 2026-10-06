import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hasMFAAssurance } from "@/lib/api";
import { z } from "zod";

type AuthUserResponse = Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
type AuthUser = NonNullable<NonNullable<AuthUserResponse["data"]>["user"]>;

const ApproveSchema = z.object({
  subscription_id: z.string().uuid(),
  notes: z.string().optional(),
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
  if (!(await hasMFAAssurance(authHeader))) {
    return { error: "Additional MFA verification is required", status: 403 };
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

// POST /api/subscriptions/approve - Admin approves a subscription request
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeAdmin(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const payload = await req.json();
  const parseResult = ApproveSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: parseResult.error.issues.map((issue) => issue.message).join(", ")
      },
      { status: 422 }
    );
  }

  const { subscription_id, notes } = parseResult.data;
  const adminId = auth.user.id;

  // Get subscription
  const { data: subscription, error: fetchError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("id", subscription_id)
    .single();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (subscription.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot approve subscription with status: ${subscription.status}` },
      { status: 400 }
    );
  }

  const today = new Date();
  const requestedDurationMonths = Number.isFinite(Number(subscription.subscription_duration_months))
    ? Number(subscription.subscription_duration_months)
    : 1;
  const durationMonths = [1, 3, 6, 12].includes(requestedDurationMonths) ? requestedDurationMonths : 1;

  const currentExpiry = subscription.active_until ? new Date(subscription.active_until) : null;
  const extensionStart = currentExpiry && !Number.isNaN(currentExpiry.getTime()) && currentExpiry > today
    ? currentExpiry
    : today;
  const activeUntil = new Date(extensionStart);
  activeUntil.setMonth(activeUntil.getMonth() + durationMonths);

  const nextBillingDate = new Date(activeUntil);

  const { data: updatedSubscription, error: updateError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: adminId,
      billing_date: today.toISOString().split("T")[0],
      next_billing_date: nextBillingDate.toISOString().split("T")[0],
      active_until: activeUntil.toISOString(),
      notes: notes || null,
      subscription_duration_months: durationMonths,
    })
    .eq("id", subscription_id)
    .select("*")
    .single();

  if (updateError) {
    const updateErrorMessage = typeof updateError.message === 'string' ? updateError.message.toLowerCase() : '';
    if (updateErrorMessage.includes("subscription_duration_months")) {
      const fallbackUpdate = await supabaseAdmin
        .from("tenant_subscriptions")
        .update({
          status: "active",
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          billing_date: today.toISOString().split("T")[0],
          next_billing_date: nextBillingDate.toISOString().split("T")[0],
          active_until: activeUntil.toISOString(),
          notes: notes || null,
        })
        .eq("id", subscription_id)
        .select("*")
        .single();

      if (fallbackUpdate.error) {
        return NextResponse.json({ error: fallbackUpdate.error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: fallbackUpdate.data,
        message: "Subscription approved successfully"
      });
    }

    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: updatedSubscription,
    message: "Subscription approved successfully"
  });
}
