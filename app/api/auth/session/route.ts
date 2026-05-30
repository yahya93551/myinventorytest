// app/api/auth/session/route.ts - Manage user sessions
import { getServerTenantContext, jsonSuccess, jsonError, logAudit } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractIPAddress, extractUserAgent } from '@/lib/audit';
import { NextRequest, NextResponse } from 'next/server';

function isUserSessionsMissingError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = (error as any).message;
  return typeof message === 'string' && message.includes("Could not find the table 'public.user_sessions'");
}

export async function GET(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', tenantContext.userId)
      .order('last_activity', { ascending: false });

    if (error) {
      if (isUserSessionsMissingError(error)) {
        console.warn('[SESSION] user_sessions table missing. Session tracking disabled.');
        return jsonSuccess({ sessions: [] });
      }
      console.error('[SESSION] Failed to fetch sessions:', error);
      return jsonError('Failed to fetch sessions', 500);
    }

    return jsonSuccess({ sessions: data || [] });
  } catch (err) {
    console.error('[SESSION] Error fetching sessions:', err);
    return jsonError('Failed to fetch session data', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const payload = await req.json().catch(() => ({}));
    const sessionId = typeof payload.session_id === 'string' ? payload.session_id.trim() : '';

    if (!sessionId) {
      return jsonError('Session ID is required to register a session', 400);
    }

    const now = new Date();
    // Default to 24 hours from now
    let expiresAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Use a small buffer for last_activity to avoid DB clock precision races
    const lastActivityDate = new Date(Date.now() + 1000);
    if (typeof payload.expires_at === 'string' && payload.expires_at) {
      const parsed = new Date(payload.expires_at);
      if (!Number.isNaN(parsed.getTime())) {
        // Ensure expires_at is not earlier than now. If it is, extend by 24h.
        if (parsed.getTime() > now.getTime()) {
          expiresAtDate = parsed;
        } else {
          expiresAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    }
    // Ensure expires_at is not earlier than last_activity
    if (expiresAtDate.getTime() <= lastActivityDate.getTime()) {
      expiresAtDate = new Date(lastActivityDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const expiresAt = expiresAtDate.toISOString();

    const ipAddress = extractIPAddress(req);
    const userAgent = extractUserAgent(req);
    const nowIso = lastActivityDate.toISOString();

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .upsert(
        {
          user_id: tenantContext.userId,
          session_id: sessionId,
          ip_address: ipAddress,
          user_agent: userAgent,
          last_activity: nowIso,
          expires_at: expiresAt,
        },
        { onConflict: 'session_id' }
      )
      .select()
      .single();

    if (error) {
      // If the table is missing, or the DB constraint about session dates fires,
      // treat session tracking as unavailable so the app continues to function.
      const msg = (error as any)?.message || '';
      const code = (error as any)?.code || '';
      if (isUserSessionsMissingError(error) || code === '23514' || msg.includes('check_session_dates') || msg.includes('violates check constraint')) {
        console.warn('[SESSION] user_sessions table missing or invalid session dates; skipping registration.', error);
        return jsonError('Session tracking is unavailable', 503);
      }

      console.error('[SESSION] Failed to register session:', error);
      return jsonError(`Failed to register session: ${error.message || 'Unknown error'}`, 500);
    }

    if (!data) {
      console.error('[SESSION] Register session returned no data');
      return jsonError('Failed to register session: no data returned', 500);
    }

    await logAudit(
      tenantContext.tenantId,
      tenantContext.userId,
      'LOGIN',
      'user',
      req,
      undefined,
      { sessionId }
    );

    return jsonSuccess({ session: data });
  } catch (err) {
    console.error('[SESSION] Error registering session:', err);
    return jsonError('Failed to register session', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantContext = await getServerTenantContext(req as any);
    if ('error' in tenantContext) {
      return jsonError(tenantContext.error, tenantContext.status);
    }

    const sessionId = new URL(req.url).searchParams.get('session_id');
    if (!sessionId) {
      return jsonError('Session ID is required to log out', 400);
    }

    const { error } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('user_id', tenantContext.userId)
      .eq('session_id', sessionId);

    if (error) {
      if (isUserSessionsMissingError(error)) {
        console.warn('[SESSION] user_sessions table missing. Session deletion skipped.');
        return jsonSuccess({ message: 'Session tracking unavailable' });
      }
      console.error('[SESSION] Failed to delete session:', error);
      return jsonError('Failed to log out session', 500);
    }

    await logAudit(
      tenantContext.tenantId,
      tenantContext.userId,
      'LOGOUT',
      'user',
      req,
      undefined,
      { sessionId }
    );

    return jsonSuccess({ message: 'Session logged out successfully' });
  } catch (err) {
    console.error('[SESSION] Error deleting session:', err);
    return jsonError('Failed to log out session', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
