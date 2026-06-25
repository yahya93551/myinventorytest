"use client";

import SalesRouteGuard from '@/components/SalesRouteGuard';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { apiPost } from '@/lib/apiClient';

export default function MFASettingsPage() {
  const router = useRouter();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'sms' | 'email'>('totp');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }
  const enrollMFA = async () => {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const result = await apiPost<{ enrollment_data: { qr_code_url?: string; secret?: string; backup_codes: string[] } }>(
        '/api/auth/mfa/enroll',
        { method: selectedMethod }
      );

      setQrCodeUrl(result.data?.enrollment_data.qr_code_url || null);
      setSecret(result.data?.enrollment_data.secret || null);
      setBackupCodes(result.data?.enrollment_data.backup_codes || []);
      setMessage('Enter the verification code from your authenticator app or your selected delivery method.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enroll MFA');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMFA = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = form.get('code')?.toString() || '';

    if (!code) {
      setError('Verification code is required');
      return;
    }

    const method = selectedMethod;

    try {
      const result = await apiPost('/api/auth/mfa/verify', {
        method,
        code,
        secret: secret ?? undefined,
        backup_codes: backupCodes.length > 0 ? backupCodes : undefined,
      });

      setMessage('MFA successfully enabled. Reloading...');
      setTimeout(() => router.refresh(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify MFA');
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm text-slate-900">
      <SalesRouteGuard />
      <h1 className="text-2xl font-semibold">Multi-factor Authentication</h1>
      <p className="text-sm text-slate-600">
        Enable an additional layer of security for your account by using an authenticator app, SMS, or email codes.
      </p>

      <form onSubmit={(event) => { event.preventDefault(); enrollMFA(); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Select MFA method</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as 'totp' | 'sms' | 'email')}
          >
            <option value="totp">Authenticator App (TOTP)</option>
            <option value="sms">SMS Text Message</option>
            <option value="email">Email Code</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          disabled={isLoading}
        >
          {isLoading ? 'Starting enrollment...' : 'Start MFA Enrollment'}
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {qrCodeUrl ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Scan this QR code</h2>
          <img src={qrCodeUrl} alt="MFA QR Code" className="mt-4 h-48 w-48" />
          <p className="mt-3 text-sm text-slate-600">Use your authenticator app to scan the QR code and generate a verification code.</p>
        </div>
      ) : null}

      {backupCodes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Backup codes</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
            {backupCodes.join('\n')}
          </pre>
          <p className="mt-3 text-sm text-slate-600">Store these codes somewhere safe. Each code can be used once.</p>
        </div>
      ) : null}

      {qrCodeUrl ? (
        <form onSubmit={verifyMFA} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Verification Code</label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              placeholder="Enter 6-digit code"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Verify MFA
          </button>
        </form>
      ) : null}
    </div>
  );
}
