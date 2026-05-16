// app/api/auth/session/route.ts - Manage user sessions
import { getServerTenantContext, jsonSuccess, jsonError } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

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
      console.error('[SESSION] Failed to fetch sessions:', error);
      return jsonError('Failed to fetch sessions', 500);
    }

    return jsonSuccess({ sessions: data || [] });
  } catch (err) {
    console.error('[SESSION] Error fetching sessions:', err);
    return jsonError('Failed to fetch session data', 500);
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
      console.error('[SESSION] Failed to delete session:', error);
      return jsonError('Failed to log out session', 500);
    }

    return jsonSuccess({ message: 'Session logged out successfully' });
  } catch (err) {
    console.error('[SESSION] Error deleting session:', err);
    return jsonError('Failed to log out session', 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
