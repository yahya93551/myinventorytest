import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSubscriptionPlan, getSubscriptionMonthlyFeeForPlan, isSubscriptionPlan } from "@/lib/subscriptionPlans";

type AuthUserResponse = Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
type AuthUser = NonNullable<NonNullable<AuthUserResponse["data"]>["user"]>;

interface OwnerAuthSuccess {
  user: AuthUser;
  tenantId: string;
}

interface OwnerAuthError {
  error: string;
  status?: number;
}

async function authorizeUser(authHeader: string | null | undefined): Promise<OwnerAuthSuccess | OwnerAuthError> {
  if (!authHeader) {
    return { error: "Missing authorization token" };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader);
  if (userError || !userData.user) {
    return { error: "Invalid or expired session" };
  }

  const user = userData.user;

  let { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("tenant_id, role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message || "Failed to verify user role" };
  }

  if (!membership) {
    const { data: createdMembership, error: createMembershipError } = await supabaseAdmin
      .from("tenant_members")
      .insert({
        tenant_id: userData.user.id,
        user_id: userData.user.id,
        user_email: userData.user.email || "",
        role: "owner",
        active: true,
        created_by: userData.user.id,
      })
      .select("tenant_id, role, active")
      .single();

    if (createMembershipError || !createdMembership) {
      return { error: createMembershipError?.message || "Failed to initialize owner membership" };
    }

    membership = createdMembership;
  }

  if (!membership.active) {
    return { error: "Your membership is inactive", status: 403 };
  }

  return { user: userData.user, tenantId: membership.tenant_id };
}

function normalizeSubscription(subscription: any) {
  if (!subscription) {
    return {
      status: "inactive",
      monthly_fee: 5.0,
      message: "No active subscription",
      plan: "basic",
    };
  }

  const normalized = { ...subscription };
  if (normalized.status === "active" && normalized.active_until) {
    const activeUntil = new Date(normalized.active_until);
    if (!Number.isNaN(activeUntil.getTime()) && activeUntil < new Date()) {
      normalized.status = "expired";
    }
  }

  normalized.plan = getSubscriptionPlan(normalized);
  return normalized;
}

// GET /api/subscriptions - Get subscription status for current user
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeUser(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { tenantId } = auth;

  const { data: subscription, error } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: normalizeSubscription(subscription) });
}

// POST /api/subscriptions - Owner requests subscription (only for owners)
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeUser(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { tenantId, user } = auth;

  // Check if user is owner
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can request subscriptions" }, { status: 403 });
  }

  // Parse payload early so we have plan and fee available for update paths
  const payload = await req.json().catch(() => ({}));
  const payerName = typeof payload.payer_name === 'string' ? payload.payer_name.trim() : '';
  const paymentPhone = typeof payload.payment_phone === 'string' ? payload.payment_phone.trim() : '';
  const paymentEmail = typeof payload.payment_email === 'string' ? payload.payment_email.trim() : '';
  const businessName = typeof payload.business_name === 'string' ? payload.business_name.trim() : '';
  const paymentReference = typeof payload.payment_reference === 'string' ? payload.payment_reference.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const requestedPlan = typeof payload.plan === 'string' && isSubscriptionPlan(payload.plan) ? payload.plan : "basic";
  const monthly_fee = getSubscriptionMonthlyFeeForPlan(requestedPlan);

  const notesParts = [
    payerName ? `Payer name: ${payerName}` : null,
    paymentPhone ? `Payment phone: ${paymentPhone}` : null,
    paymentEmail ? `Payment email: ${paymentEmail}` : null,
    businessName ? `Business name: ${businessName}` : null,
    paymentReference ? `Payment reference: ${paymentReference}` : null,
    notes ? `Details: ${notes}` : null,
    `Selected plan: ${requestedPlan}`,
  ].filter(Boolean);
  const formattedNotes = notesParts.length > 0 ? notesParts.join(' | ') : null;

  // Check if subscription already exists and normalize its status
  const { data: existingSubscription, error: existingError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingSubscription) {
    const normalizedExisting = normalizeSubscription(existingSubscription);
    // If there's an active or pending subscription/request, block new requests
    if (normalizedExisting.status === "active" || normalizedExisting.status === "pending") {
      return NextResponse.json(
        { error: "Subscription already exists for this account. Current status: " + normalizedExisting.status },
        { status: 400 }
      );
    }

    // If existing subscription is expired or inactive, update that row to become a new pending request
    const { data: updatedSubscription, error: updateError } = await supabaseAdmin
      .from("tenant_subscriptions")
      .update({
        status: "pending",
        monthly_fee,
        requested_at: new Date().toISOString(),
        notes: formattedNotes,
        plan: requestedPlan,
      })
      .eq("id", existingSubscription.id)
      .select("*")
      .single();

    if (updateError) {
      // If the DB schema doesn't have `plan`, retry without that column to remain backward compatible
      if (typeof updateError.message === 'string' && updateError.message.toLowerCase().includes("plan")) {
        const { data: updatedSubscriptionRetry, error: updateErrorRetry } = await supabaseAdmin
          .from("tenant_subscriptions")
          .update({
            status: "pending",
            monthly_fee,
            requested_at: new Date().toISOString(),
            notes: formattedNotes,
          })
          .eq("id", existingSubscription.id)
          .select("*")
          .single();

        if (updateErrorRetry) {
          return NextResponse.json({ error: updateErrorRetry.message }, { status: 500 });
        }

        return NextResponse.json(
          { success: true, data: updatedSubscriptionRetry, message: "Subscription request submitted. Waiting for admin approval." },
          { status: 200 }
        );
      }

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, data: updatedSubscription, message: "Subscription request submitted. Waiting for admin approval." },
      { status: 200 }
    );
  }

  // Create new subscription request
  let { data: newSubscription, error: createError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .insert({
      tenant_id: tenantId,
      status: "pending",
      monthly_fee,
      requested_at: new Date().toISOString(),
      notes: formattedNotes,
      plan: requestedPlan,
    })
    .select("*")
    .single();

  if (createError) {
    // Retry without `plan` if the DB doesn't have that column yet
    if (typeof createError.message === 'string' && createError.message.toLowerCase().includes("plan")) {
      const res = await supabaseAdmin
        .from("tenant_subscriptions")
        .insert({
          tenant_id: tenantId,
          status: "pending",
          monthly_fee,
          requested_at: new Date().toISOString(),
          notes: formattedNotes,
        })
        .select("*")
        .single();

      newSubscription = res.data;
      createError = res.error;
    }
  }

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: newSubscription, message: "Subscription request submitted. Waiting for admin approval." },
    { status: 201 }
  );
}
