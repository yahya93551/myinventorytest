// app/api/account/export-data/route.ts - GDPR data export
import { getServerTenantContext, jsonSuccess, jsonError } from '@/lib/api';
import { logAudit } from '@/lib/api';
import {
  createDataExportRequest,
  getDataExportRequest,
  compileUserDataForExport,
  convertToCSV,
  calculateDataSize,
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
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
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
      req as any,
      exportRequest.id,
      { format }
    );

    return jsonSuccess({
      message: 'Data export request created',
      export_token: exportRequest.export_token,
      expires_at: exportRequest.expires_at,
      note: 'Your data will be prepared shortly. You will receive an email with download link.',
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
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return jsonError('Export token required', 400);
    }

    // Get export request
    const exportRequest = await getDataExportRequest(token);

    if (!exportRequest) {
      return jsonError('Export request not found or expired', 404);
    }

    // Check if already downloaded (for security)
    if (exportRequest.status === 'downloaded') {
      return jsonError('This export has already been downloaded. Request a new one.', 403);
    }

    if (exportRequest.status !== 'ready') {
      return jsonError(`Export not ready yet. Status: ${exportRequest.status}`, 202);
    }

    // Compile the data
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

    // Mark as downloaded
    // In production, update the export_request.status to 'downloaded'
    // and set downloaded_at timestamp

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
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
