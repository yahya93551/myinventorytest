// lib/gdpr.ts - GDPR compliance utilities
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import type { DataExportFormat } from '@/types';

/**
 * Generate an export token for data export requests
 */
export function generateExportToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a data export request
 */
export async function createDataExportRequest(
  userId: string,
  tenantId: string,
  format: DataExportFormat = 'json'
) {
  const token = generateExportToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

  const { data, error } = await supabaseAdmin
    .from('data_export_requests')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      export_token: token,
      status: 'pending',
      data_format: format,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[GDPR] Failed to create export request:', error);
    throw new Error('Failed to create export request');
  }

  return data;
}

/**
 * Get a data export request by token
 */
export async function getDataExportRequest(token: string) {
  const { data, error } = await supabaseAdmin
    .from('data_export_requests')
    .select()
    .eq('export_token', token)
    .maybeSingle();

  if (error) {
    console.error('[GDPR] Failed to fetch export request:', error);
    return null;
  }

  // Check if expired
  if (data && new Date(data.expires_at) < new Date()) {
    return null; // Expired
  }

  return data;
}

/**
 * Compile user data for export (all products, sales, categories, etc.)
 */
export async function compileUserDataForExport(tenantId: string) {
  try {
    const [
      { data: products },
      { data: sales },
      { data: categories },
      { data: activityLogs },
    ] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select()
        .eq('tenant_id', tenantId),
      supabaseAdmin
        .from('sales')
        .select()
        .eq('tenant_id', tenantId),
      supabaseAdmin
        .from('categories')
        .select()
        .eq('tenant_id', tenantId),
      supabaseAdmin
        .from('activity_logs')
        .select()
        .eq('tenant_id', tenantId),
    ]);

    return {
      export_date: new Date().toISOString(),
      products: products || [],
      sales: sales || [],
      categories: categories || [],
      activity_logs: activityLogs || [],
    };
  } catch (err) {
    console.error('[GDPR] Failed to compile export data:', err);
    throw new Error('Failed to compile export data');
  }
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: Record<string, any>): string {
  const lines: string[] = [];
  
  // Add header
  const headers = Object.keys(data);
  lines.push(headers.map(h => `"${h}"`).join(','));
  
  // Add rows
  if (Array.isArray(data.products) && data.products.length > 0) {
    lines.push('Products:');
    const productHeaders = Object.keys(data.products[0]);
    lines.push(productHeaders.map(h => `"${h}"`).join(','));
    data.products.forEach((product: any) => {
      lines.push(productHeaders.map(h => `"${product[h] || ''}"`).join(','));
    });
    lines.push('');
  }
  
  if (Array.isArray(data.sales) && data.sales.length > 0) {
    lines.push('Sales:');
    const saleHeaders = Object.keys(data.sales[0]);
    lines.push(saleHeaders.map(h => `"${h}"`).join(','));
    data.sales.forEach((sale: any) => {
      lines.push(saleHeaders.map(h => `"${sale[h] || ''}"`).join(','));
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Create a data deletion request
 */
export async function createAccountDeletionRequest(
  userId: string,
  tenantId: string
) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

  const { data, error } = await supabaseAdmin
    .from('account_deletion_requests')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      deletion_token: token,
      status: 'pending',
      requested_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      requested_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[GDPR] Failed to create deletion request:', error);
    throw new Error('Failed to create deletion request');
  }

  return data;
}

/**
 * Get a deletion request by token
 */
export async function getAccountDeletionRequest(token: string) {
  const { data, error } = await supabaseAdmin
    .from('account_deletion_requests')
    .select()
    .eq('deletion_token', token)
    .maybeSingle();

  if (error) {
    console.error('[GDPR] Failed to fetch deletion request:', error);
    return null;
  }

  // Check if expired
  if (data && new Date(data.expires_at) < new Date()) {
    return null; // Expired
  }

  return data;
}

/**
 * Confirm account deletion request
 */
export async function confirmAccountDeletion(token: string) {
  const { data, error } = await supabaseAdmin
    .from('account_deletion_requests')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('deletion_token', token)
    .select()
    .single();

  if (error) {
    console.error('[GDPR] Failed to confirm deletion:', error);
    throw new Error('Failed to confirm deletion');
  }

  return data;
}

/**
 * Delete all user data (final step after confirmation)
 */
export async function deleteAllUserData(userId: string, tenantId: string) {
  try {
    // Delete in order of dependencies
    const deleteOperations = [
      supabaseAdmin.from('activity_logs').delete().eq('tenant_id', tenantId),
      supabaseAdmin.from('sales').delete().eq('tenant_id', tenantId),
      supabaseAdmin.from('products').delete().eq('tenant_id', tenantId),
      supabaseAdmin.from('categories').delete().eq('tenant_id', tenantId),
      supabaseAdmin.from('tenant_members').delete().eq('tenant_id', tenantId),
      supabaseAdmin.from('profiles').delete().eq('id', userId),
      supabaseAdmin.auth.admin.deleteUser(userId),
    ];

    const results = await Promise.all(deleteOperations);
    
    // Check for any errors
    const errors = results.filter(r => 'error' in r && r.error);
    if (errors.length > 0) {
      console.error('[GDPR] Deletion errors:', errors);
      throw new Error('Failed to delete all user data');
    }

    return true;
  } catch (err) {
    console.error('[GDPR] Failed to delete user data:', err);
    throw err;
  }
}

/**
 * Archive user data before deletion (for backup/compliance)
 */
export async function archiveUserDataBeforeDeletion(
  userId: string,
  tenantId: string
): Promise<string> {
  const data = await compileUserDataForExport(tenantId);
  const archive = JSON.stringify(data, null, 2);
  
  // In production, upload to secure S3 bucket with encryption
  console.log('[GDPR] User data archived for deletion:', { userId, tenantId, size: archive.length });
  
  return archive;
}

/**
 * Calculate data size for export
 */
export function calculateDataSize(data: Record<string, any>): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json).length;
  
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Check GDPR compliance status
 */
export async function checkGDPRCompliance(tenantId: string) {
  try {
    const [products, sales, logs] = await Promise.all([
      supabaseAdmin.from('products').select('count', { count: 'exact' }).eq('tenant_id', tenantId),
      supabaseAdmin.from('sales').select('count', { count: 'exact' }).eq('tenant_id', tenantId),
      supabaseAdmin.from('activity_logs').select('count', { count: 'exact' }).eq('tenant_id', tenantId),
    ]);

    return {
      products_count: products.count || 0,
      sales_count: sales.count || 0,
      audit_logs_count: logs.count || 0,
      can_export: true,
      can_delete: true,
    };
  } catch (err) {
    console.error('[GDPR] Compliance check failed:', err);
    return null;
  }
}
