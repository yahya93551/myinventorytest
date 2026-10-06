"use client";

import SalesRouteGuard from '@/components/SalesRouteGuard';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { apiPost } from '@/lib/apiClient';
import { supabase } from '@/lib/supabase';

export default function MFASettingsPage() {
  const router = useRouter();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeExpiresAt, setChallengeExpiresAt] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'phone'>('totp');
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
      let enrolledFactorId: string;
      if (selectedMethod === 'totp') {
        const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MyInventory' });
        if (result.error) throw result.error;
        enrolledFactorId = result.data.id;
        setQrCodeUrl(result.data.totp.qr_code);
        setSecret(result.data.totp.secret);
      } else {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user?.phone) throw new Error('Add and verify a phone number before enabling SMS MFA.');
        const result = await supabase.auth.mfa.enroll({ factorType: 'phone', phone: userData.user.phone, friendlyName: 'MyInventory' });
        if (result.error) throw result.error;
        enrolledFactorId = result.data.id;
        setQrCodeUrl(null);
        setSecret(null);
      }

      const challenge = await supabase.auth.mfa.challenge(
        selectedMethod === 'phone' ? { factorId: enrolledFactorId, channel: 'sms' } : { factorId: enrolledFactorId }
      );
      if (challenge.error) throw challenge.error;
      setFactorId(enrolledFactorId);
      setChallengeId(challenge.data.id);
      setChallengeExpiresAt(challenge.data.expires_at);
      setMessage(selectedMethod === 'phone'
        ? 'Enter the code sent to your verified phone.'
        : 'Scan the QR code, then enter the code from your authenticator app.');
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

    if (!factorId || !challengeId) {
      setError('Start MFA enrollment before verifying a code.');
      return;
    }

    try {
      let activeChallengeId = challengeId;
      if (challengeExpiresAt && Date.now() >= challengeExpiresAt * 1000) {
        const refreshed = await supabase.auth.mfa.challenge(
          selectedMethod === 'phone' ? { factorId, channel: 'sms' } : { factorId }
        );
        if (refreshed.error) throw refreshed.error;
        activeChallengeId = refreshed.data.id;
        setChallengeId(activeChallengeId);
        setChallengeExpiresAt(refreshed.data.expires_at);
        setError('A new verification challenge was sent. Enter the new code.');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Your sign-in session expired. Please sign in again.');

      const result = await apiPost<{
        access_token: string;
        refresh_token: string;
      }>('/api/auth/mfa/verify', {
        factor_id: factorId,
        challenge_id: activeChallengeId,
        code,
        refresh_token: sessionData.session.refresh_token,
      });
      if (!result.data?.access_token || !result.data.refresh_token) throw new Error('MFA verification failed.');
      const { error: updateSessionError } = await supabase.auth.setSession({
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
      });
      if (updateSessionError) throw updateSessionError;
      setMessage('MFA successfully enabled.');
      setFactorId(null);
      setChallengeId(null);
      setTimeout(() => router.refresh(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify MFA');
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm text-slate-900">
      <SalesRouteGuard />
      <h1 className="text-2xl font-semibold">Multi-factor Authentication</h1>
      <p className="text-sm text-slate-600">
        Enable an additional layer of security for your account with an authenticator app or SMS to a verified phone.
      </p>

      <form onSubmit={(event) => { event.preventDefault(); enrollMFA(); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Select MFA method</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as 'totp' | 'phone')}
          >
            <option value="totp">Authenticator App (TOTP)</option>
            <option value="phone">SMS Text Message</option>
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

      {secret ? <p className="text-sm text-slate-600">Authenticator setup key: <code>{secret}</code></p> : null}

      {factorId && challengeId ? (
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
