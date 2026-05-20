"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiGet, apiDelete } from "@/lib/apiClient";
import type { UserSession } from "@/types";

export default function SessionsSettingsPage() {
  const { loading } = useRequireAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const result = await apiGet<{ sessions: UserSession[] }>("/api/auth/session");
      setSessions(result.data?.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    }
  }, []);

  const deleteSession = async (sessionId: string) => {
    setBusy(true);
    setError(null);

    try {
      await apiDelete(`/api/auth/session?session_id=${encodeURIComponent(sessionId)}`);
      setSessions((current) => current.filter((session) => session.session_id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      loadSessions();
    }
  }, [loading, loadSessions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm text-slate-900">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Active Sessions</h1>
        <p className="text-sm text-slate-600">
          Review and revoke active sessions for your account to keep access secure.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 p-6 text-slate-600">
            No active sessions found.
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.session_id} className="rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Session ID</p>
                  <p className="font-medium text-slate-900 break-all">{session.session_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last active</p>
                  <p className="font-medium text-slate-900">{new Date(session.last_activity).toLocaleString()}</p>
                </div>
                <div>
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => deleteSession(session.session_id)}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Revoke session
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">IP Address</p>
                  <p className="text-sm text-slate-900">{session.ip_address || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">User agent</p>
                  <p className="text-sm text-slate-900 break-all">{session.user_agent || 'Unknown'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
