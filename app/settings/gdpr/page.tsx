"use client";

import { useState } from "react";
import { apiPost } from "@/lib/apiClient";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { DataExportFormat } from "@/types";

export default function GDPRSettingsPage() {
  const { loading } = useRequireAuth();
  const [format, setFormat] = useState<DataExportFormat>("json");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportToken, setExportToken] = useState<string | null>(null);

  const requestExport = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);

    try {
      const result = await apiPost<{ export_token: string; expires_at: string }>(
        "/api/account/export-data",
        { format }
      );

      setExportToken(result.data?.export_token || null);
      setMessage(
        "A data export request was created. Use the download link below once the export is ready."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request export.");
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);

    try {
      await apiPost("/api/account/delete-data", { confirm: true });
      setMessage(
        "Account deletion request created. Follow the confirmation instructions sent to your email."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request account deletion.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm text-slate-900">
      <h1 className="text-2xl font-semibold">Privacy & GDPR</h1>
      <p className="text-sm text-slate-600">
        Request your account data export or start the account deletion workflow. These actions are protected and require your confirmation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold">Download your data</h2>
          <p className="mt-2 text-sm text-slate-600">
            Export your full tenant dataset in JSON or CSV format.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-700">Export format</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            value={format}
            onChange={(e) => setFormat(e.target.value as DataExportFormat)}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={requestExport}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Requesting export..." : "Request data export"}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 p-5 bg-slate-50">
          <h2 className="text-lg font-semibold">Delete account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create a GDPR deletion request. This will generate a confirmation flow and prepare the tenant for permanent removal.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={requestDeletion}
            className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Requesting deletion..." : "Request account deletion"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {exportToken ? (
        <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-sm text-slate-800">Download link (temporary):</p>
          <a
            href={`/api/account/export-data?token=${encodeURIComponent(exportToken)}`}
            className="mt-2 inline-block text-sm font-semibold text-cyan-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            Download your exported data
          </a>
          <p className="mt-2 text-xs text-slate-500">The export token expires in 7 days.</p>
        </div>
      ) : null}
    </div>
  );
}
