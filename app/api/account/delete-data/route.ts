// app/api/account/delete-data/route.ts - GDPR account deletion request
import { getServerTenantContext, jsonSuccess, jsonError } from '@/lib/api';
import { createAccountDeletionRequest } from '@/lib/gdpr';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const DeleteDataSchema = z.object({
  confirm: z.literal(true),
});

export async function POST(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const payload = await req.json();
    const parsed = DeleteDataSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Confirmation required to delete account', 400);
    }

    const deletionRequest = await createAccountDeletionRequest(
      tenantContext.userId,
      tenantContext.tenantId
    );

    return jsonSuccess({
      message: 'Account deletion request created',
      deletion_token: deletionRequest.deletion_token,
      expires_at: deletionRequest.expires_at,
      note: 'A confirmation email should be sent with the deletion link.',
    });
  } catch (err) {
    console.error('[GDPR] Account deletion request failed:', err);
    return jsonError('Failed to create deletion request', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
