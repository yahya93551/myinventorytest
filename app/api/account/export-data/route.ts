// app/api/account/export-data/route.ts - GDPR data export
import { requireRole, jsonSuccess, jsonError } from '@/lib/api';
import { logAudit } from '@/lib/api';
import {
  createDataExportRequest,
  getDataExportRequest,
  consumeDataExportRequest,
  compileUserDataForExport,
  convertToCSV,
} from '@/lib/gdpr';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RequestDataExportSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

/**
 * POST /api/account/export-data - Request a data export
 */
export async function POST(req: NextRequest) {
  try {
    const tenantContext = await requireRole(req, ['owner', 'accountant', 'admin']);
    if ('error' in tenantContext) {
      return jsonError('Not authorized to request a tenant export', tenantContext.status);
    }

    const payload = await req.json();
    const parsed = RequestDataExportSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError('Invalid request', 400);
    }

    const { format } = parsed.data;

    // Create export request
    const exportRequest = await createDataExportRequest(
      tenantContext.userId,
      tenantContext.tenantId,
      format
    );

    // Log the action
    await logAudit(
      tenantContext.tenantId,
      tenantContext.userId,
      'REQUEST_DATA_EXPORT',
      'account',
      req,
      exportRequest.id,
      { format }
    );

    return jsonSuccess({
      message: 'Data export request created',
      export_token: exportRequest.export_token,
      expires_at: exportRequest.expires_at,
      note: 'Your export is ready to download.',
    });
  } catch (err) {
    console.error('[GDPR] Data export request failed:', err);
    return jsonError('Failed to create export request', 500);
  }
}

/**
 * GET /api/account/export-data?token=xxx - Download exported data
 */
export async function GET(req: NextRequest) {
  try {
    const tenantContext = await requireRole(req, ['owner', 'accountant', 'admin']);
    if ('error' in tenantContext) {
      return jsonError('Not authorized to access this export', tenantContext.status);
    }

    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return jsonError('Export not available', 404);
    }

    const exportRequest = await getDataExportRequest(token);
    if (
      !exportRequest ||
      exportRequest.user_id !== tenantContext.userId ||
      exportRequest.tenant_id !== tenantContext.tenantId ||
      !['pending', 'ready'].includes(exportRequest.status)
    ) {
      return jsonError('Export not available', 404);
    }

    const data = await compileUserDataForExport(exportRequest.tenant_id);

    // Format based on requested format
    let fileContent: string;
    let contentType: string;
    let filename: string;

    if (exportRequest.data_format === 'csv') {
      fileContent = convertToCSV(data);
      contentType = 'text/csv';
      filename = `data-export-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      fileContent = JSON.stringify(data, null, 2);
      contentType = 'application/json';
      filename = `data-export-${new Date().toISOString().split('T')[0]}.json`;
    }

    const consumed = await consumeDataExportRequest(
      token,
      tenantContext.userId,
      tenantContext.tenantId
    );
    if (!consumed) return jsonError('Export not available', 404);

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[GDPR] Data export download failed:', err);
    return jsonError('Failed to download export', 500);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
