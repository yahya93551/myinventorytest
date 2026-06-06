// lib/audit.ts - Enhanced audit logging with IP, user agent, etc.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface AuditLogEntry {
  tenantId: string;
  performedBy: string;
  action: string; // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
  entity: string; // 'product', 'sale', 'user', 'settings'
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  endpoint?: string;
  statusCode?: number;
}

/**
 * Extract IP address from request headers
 * Handles reverse proxies and load balancers
 */
export function extractIPAddress(request: Request): string {
  // Check for IP from reverse proxy headers (Cloudflare, AWS, Nginx, etc.)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Get the first IP in the chain
    return xForwardedFor.split(',')[0].trim();
  }

  // Cloudflare specific
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // AWS Elastic Load Balancer
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback (less reliable)
  return 'unknown';
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Log an audit trail entry
 * All state-changing operations should call this
 */
export async function logAuditTrail(
  entry: AuditLogEntry,
  request?: Request
): Promise<boolean> {
  try {
    // Extract request metadata if request provided
    const ipAddress = entry.ipAddress || (request ? extractIPAddress(request) : undefined);
    const userAgent = entry.userAgent || (request ? extractUserAgent(request) : undefined);
    const httpMethod = entry.httpMethod || request?.method;
    const endpoint = entry.endpoint || new URL(request?.url || '').pathname;

    // Store in database

    // If this is a LOGIN action, avoid noisy repeated logins (e.g., page refreshes)
    if (entry.action === 'LOGIN' && entry.performedBy) {
      try {
        const { data: lastLogin } = await supabaseAdmin
          .from('activity_logs')
          .select('created_at')
          .eq('tenant_id', entry.tenantId)
          .eq('performed_by', entry.performedBy)
          .eq('action', 'LOGIN')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastLogin && (lastLogin as any).created_at) {
          const lastTime = new Date((lastLogin as any).created_at).getTime();
          // Skip if last login logged within 5 minutes
          if (Date.now() - lastTime < 5 * 60 * 1000) {
            return true;
          }
        }
      } catch (e) {
        // If this check fails, continue to attempt logging as normal
        console.error('[AUDIT] Failed to check last LOGIN timestamp:', e);
      }
    }

    const { error } = await supabaseAdmin
      .from('activity_logs')
      .insert({
        tenant_id: entry.tenantId,
        performed_by: entry.performedBy,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId || null,
        details: entry.details || {},
        ip_address: ipAddress,
        user_agent: userAgent,
        http_method: httpMethod,
        endpoint: endpoint,
        status_code: entry.statusCode,
        created_at: new Date().toISOString(),
      });

    if (error) {
      // Log detailed info to make failures visible in server logs
      console.error('[AUDIT] Failed to insert activity_logs row. Error:', error, 'Payload:', {
        tenant_id: entry.tenantId,
        performed_by: entry.performedBy,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId || null,
      });

      // Try a minimal fallback insert to avoid issues from optional fields
      try {
        const { error: fallbackError } = await supabaseAdmin
          .from('activity_logs')
          .insert({
            tenant_id: entry.tenantId,
            performed_by: entry.performedBy,
            action: entry.action,
            entity: entry.entity,
            created_at: new Date().toISOString(),
          });

        if (fallbackError) {
          console.error('[AUDIT] Fallback insert failed:', fallbackError);
          return false;
        }

        return true;
      } catch (fallbackEx) {
        console.error('[AUDIT] Exception during fallback insert:', fallbackEx);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('[AUDIT] Exception while logging:', err);
    return false;
  }
}

/**
 * Get audit logs for a tenant
 * Useful for compliance and investigation
 */
export async function getAuditLogs(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  let query = supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (options?.action) {
    query = query.eq('action', options.action);
  }

  if (options?.entityType) {
    query = query.eq('entity', options.entityType);
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }

  const limit = Math.min(options?.limit || 100, 1000);
  const offset = options?.offset || 0;

  query = query.range(offset, offset + limit - 1);

  return query;
}

/**
 * Get logs by IP address for security investigation
 * Helps detect compromised accounts or attacks
 */
export async function getLogsByIPAddress(
  tenantId: string,
  ipAddress: string,
  limit = 50
) {
  return supabaseAdmin
    .from('activity_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ip_address', ipAddress)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Get suspicious activity (multiple failed logins, etc.)
 */
export async function detectSuspiciousActivity(
  tenantId: string,
  timeWindowMinutes = 15
) {
  const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60000);

  const { data: failedLogins, error } = await supabaseAdmin
    .from('activity_logs')
    .select('ip_address, performed_by, created_at')
    .eq('tenant_id', tenantId)
    .eq('action', 'LOGIN_FAILED')
    .gte('created_at', cutoffTime.toISOString());

  if (error) {
    console.error('[AUDIT] Failed to detect suspicious activity:', error);
    return [];
  }

  // Group by IP and user
  const grouped = (failedLogins || []).reduce(
    (acc: Record<string, number>, log: any) => {
      const key = `${log.ip_address}:${log.performed_by}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  // Return IPs with 5+ failed attempts
  return Object.entries(grouped)
    .filter(([_, count]) => count >= 5)
    .map(([key, count]) => {
      const [ip, user] = key.split(':');
      return { ip, user, failedAttempts: count };
    });
}
