import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveSubscription } from "@/lib/api";
import { createPhoneFallbackEmail, isPhoneNumber, normalizePhoneNumber } from "@/lib/auth";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitResponse,
} from "@/lib/rateLimit";

const CreateSubUserSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["accountant", "sales"]),
});

interface OwnerAuthSuccess {
  user: NonNullable<Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"]["user"]>;
  tenantId: string;
}

interface OwnerAuthError {
  error: string;
  status?: number;
}

async function findUserByIdentifier(identifier: string) {
  const isPhone = isPhoneNumber(normalizePhoneNumber(identifier));
  const normalizedIdentifier = isPhone ? normalizePhoneNumber(identifier) : identifier.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw error;
    }

    const user = data.users.find((user) => {
      if (isPhone) {
        return user.phone === normalizedIdentifier;
      }
      return user.email?.toLowerCase() === normalizedIdentifier;
    });

    if (user) {
      return user;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function authorizeOwner(authHeader: string | null | undefined): Promise<OwnerAuthSuccess | OwnerAuthError> {
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

  const role = membership.role;
  const tenantId = membership.tenant_id;

  if (!membership.active) {
    return { error: "Your owner membership is inactive", status: 403 };
  }

  if (role !== "owner") {
    return { error: "Only owners can manage sub-users", status: 403 };
  }

  return { user: userData.user, tenantId };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeOwner(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const { tenantId } = auth;
  const subscriptionCheck = await requireActiveSubscription(tenantId);
  if ("error" in subscriptionCheck) {
    return NextResponse.json({ error: subscriptionCheck.error }, { status: subscriptionCheck.status });
  }

  const { data, error } = await supabaseAdmin
    .from("tenant_members")
    .select("user_id, user_email, role, active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  const auth = await authorizeOwner(authHeader);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
  }

  const subscriptionCheck = await requireActiveSubscription(auth.tenantId);
  if ("error" in subscriptionCheck) {
    return NextResponse.json({ error: subscriptionCheck.error }, { status: subscriptionCheck.status });
  }

  const payload = await req.json();
  const parseResult = CreateSubUserSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: parseResult.error.issues.map((issue) => issue.message).join(", ")
      },
      { status: 422 }
    );
  }

  const { identifier, password, role } = parseResult.data;
  const ownerId = auth.user.id;
  const tenantId = auth.tenantId;

  const isPhone = isPhoneNumber(normalizePhoneNumber(identifier));
  let normalizedPhone: string | undefined;
  let email: string | undefined;

  if (isPhone) {
    normalizedPhone = normalizePhoneNumber(identifier);
    if (!normalizedPhone) {
      return NextResponse.json({ error: "Please provide a valid phone number." }, { status: 422 });
    }
  } else {
    email = identifier.trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email address or phone number." }, { status: 422 });
    }
  }

  const rateLimitIdentifier = getRateLimitIdentifier(req, auth.user.id);
  const rateResult = await checkRateLimit(rateLimitIdentifier, {
    interval: 60_000,
    maxRequests: 10,
  });

  if (!rateResult.success) {
    return rateLimitResponse(rateResult);
  }

  let newUser = null;

  try {
    newUser = await findUserByIdentifier(identifier);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to verify identifier" }, { status: 500 });
  }

  if (!newUser) {
    const createPayload: Record<string, unknown> = {
      password,
      email_confirm: true,
    };

    if (isPhone) {
      createPayload.phone = normalizedPhone;
      createPayload.email = createPhoneFallbackEmail(identifier);
      createPayload.phone_confirm = true;
    } else {
      createPayload.email = email;
    }

    const {
      data: createData,
      error: createError,
    } = await supabaseAdmin.auth.admin.createUser(createPayload as any);

    if (createError || !createData?.user) {
      return NextResponse.json({ error: createError?.message || "Failed to create sub-user" }, { status: 500 });
    }

    newUser = createData.user;
  }

  const { data: existingMembership, error: existingMembershipError } = await supabaseAdmin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", newUser.id)
    .maybeSingle();

  if (existingMembershipError) {
    return NextResponse.json({ error: existingMembershipError.message || "Failed to check existing membership" }, { status: 500 });
  }

  if (existingMembership) {
    return NextResponse.json({ error: "This user is already a member of the tenant" }, { status: 409 });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: newUser.id,
      user_id: newUser.id,
      email: newUser.email || (isPhone ? createPhoneFallbackEmail(identifier) : email),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message || "Failed to create sub-user profile" }, { status: 500 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_members")
    .insert({
      tenant_id: tenantId,
      user_id: newUser.id,
      user_email: isPhone ? normalizedPhone : email,
      role,
      active: true,
      created_by: ownerId,
    })
    .select("user_id, user_email, role, active, created_at")
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: membershipError?.message || "Failed to create tenant membership" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: membership });
}
