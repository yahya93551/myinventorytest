import { supabase } from "@/lib/supabase";
import { ApiResponse } from "@/lib/api";

const SESSION_STORAGE_KEY = 'inventory_session_id';
const SESSION_USER_ID_KEY = 'inventory_session_user_id';

function getStoredSessionId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function setStoredSessionId(sessionId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

function getStoredSessionUserId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_USER_ID_KEY);
}

function setStoredSessionUserId(userId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_USER_ID_KEY, userId);
}

function removeStoredSessionId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function removeStoredSessionUserId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_USER_ID_KEY);
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

const defaultHeaders = {
  "Content-Type": "application/json",
};

async function fetchApi<T>(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});

  Object.entries(defaultHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  const token = await getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestInit = { ...init, headers };

  const response = await fetch(input, requestInit);

  const body = await response.text();
  const json = body ? JSON.parse(body) : null;

  if (!response.ok) {
    const message = json?.error || json?.message || response.statusText;
    throw new Error(message);
  }

  return json as ApiResponse<T>;
}

export async function apiGet<T>(path: string) {
  return fetchApi<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown) {
  return fetchApi<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body?: unknown) {
  return fetchApi<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function apiDelete<T>(path: string, body?: unknown) {
  return fetchApi<T>(path, { method: "DELETE", body: JSON.stringify(body) });
}

export function getCurrentSessionId() {
  return getStoredSessionId();
}

export function clearCurrentSessionId() {
  removeStoredSessionId();
  removeStoredSessionUserId();
}

export async function registerCurrentSession() {
  if (typeof window === 'undefined') return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session || !session.user) return;

  const currentUserId = session.user.id;
  const storedUserId = getStoredSessionUserId();
  let sessionId = getStoredSessionId();

  if (!sessionId || storedUserId !== currentUserId) {
    sessionId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    setStoredSessionId(sessionId);
    setStoredSessionUserId(currentUserId);
  }

  let expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  // Ensure expiresAt is in the future. If Supabase provided an expired timestamp,
  // fall back to 24 hours from now to avoid server-side constraint failures.
  const now = Date.now();
  if (new Date(expiresAt).getTime() <= now) {
    expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    await apiPost('/api/auth/session', {
      session_id: sessionId,
      expires_at: expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes("could not find the table 'public.user_sessions'") || message.includes('session tracking is unavailable')) {
      console.warn('[SESSION] Session tracking disabled, skipping registration:', error);
      return;
    }

    console.warn('[SESSION] registerCurrentSession retrying after transient failure:', error);
    if (error instanceof Error) {
      if (message.includes('invalid or expired session') || message.includes('missing authorization token')) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await apiPost('/api/auth/session', {
          session_id: sessionId,
          expires_at: expiresAt,
        });
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
}
