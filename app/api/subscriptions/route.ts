import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  if (!subscription) {
    // Return default inactive subscription
    return NextResponse.json({
      success: true,
      data: {
        status: "inactive",
        monthly_fee: 5.0,
        message: "No active subscription"
      }
    });
  }

  return NextResponse.json({ success: true, data: subscription });
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

  // Check if subscription already exists
  const { data: existingSubscription, error: existingError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingSubscription) {
    return NextResponse.json(
      { error: "Subscription already exists for this account. Current status: " + existingSubscription.status },
      { status: 400 }
    );
  }

  const payload = await req.json().catch(() => ({}));
  const payerName = typeof payload.payer_name === 'string' ? payload.payer_name.trim() : '';
  const paymentPhone = typeof payload.payment_phone === 'string' ? payload.payment_phone.trim() : '';
  const paymentEmail = typeof payload.payment_email === 'string' ? payload.payment_email.trim() : '';
  const businessName = typeof payload.business_name === 'string' ? payload.business_name.trim() : '';
  const paymentReference = typeof payload.payment_reference === 'string' ? payload.payment_reference.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';

  const notesParts = [
    payerName ? `Payer name: ${payerName}` : null,
    paymentPhone ? `Payment phone: ${paymentPhone}` : null,
    paymentEmail ? `Payment email: ${paymentEmail}` : null,
    businessName ? `Business name: ${businessName}` : null,
    paymentReference ? `Payment reference: ${paymentReference}` : null,
    notes ? `Details: ${notes}` : null,
  ].filter(Boolean);
  const formattedNotes = notesParts.length > 0 ? notesParts.join(' | ') : null;

  // Create new subscription request
  const { data: newSubscription, error: createError } = await supabaseAdmin
    .from("tenant_subscriptions")
    .insert({
      tenant_id: tenantId,
      status: "pending",
      monthly_fee: 5.0,
      requested_at: new Date().toISOString(),
      notes: formattedNotes,
    })
    .select("*")
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: newSubscription, message: "Subscription request submitted. Waiting for admin approval." },
    { status: 201 }
  );
}
