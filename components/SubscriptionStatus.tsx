import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { apiPost } from '@/lib/apiClient';
import Button from '@/components/Button';
import Card from '@/components/Card';

interface SubscriptionStatusProps {
  onRequestClick?: () => void;
}

export function SubscriptionStatus({ onRequestClick }: SubscriptionStatusProps) {
  const { subscription, loading, error, isActive, refetch } = useSubscription();
  const [requesting, setRequesting] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [selectedPlanFee, setSelectedPlanFee] = useState<number>(subscription?.monthly_fee || 5.0);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

  const activeUntilDate = subscription?.active_until ? new Date(subscription.active_until) : null;
  const remainingDays = activeUntilDate
    ? Math.max(0, Math.ceil((activeUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isFreeTrial = subscription?.status === 'active' && remainingDays !== null && remainingDays > 0 && remainingDays <= 14;

  const handleRequest = async () => {
    setRequestMessage('');
    setRequesting(true);
    try {
      await apiPost('/api/subscriptions', {
        monthly_fee: selectedPlanFee,
        payer_name: payerName,
        payment_phone: paymentPhone,
        payment_email: paymentEmail,
        business_name: businessName,
        payment_reference: paymentReference,
        notes: additionalNotes,
      });
      await refetch();
      if (onRequestClick) onRequestClick();
      setRequestMessage('Subscription request submitted. Waiting for admin approval.');
      setPayerName('');
      setPaymentPhone('');
      setPaymentEmail('');
      setBusinessName('');
      setPaymentReference('');
      setAdditionalNotes('');
      setSelectedPlanFee(subscription?.monthly_fee || 5.0);
    } catch (err) {
      setRequestMessage(err instanceof Error ? err.message : 'Error requesting subscription');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <p className="text-gray-500">Loading subscription status...</p>
        </div>
      </Card>
    );
  }

  if (error && !subscription) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-red-800">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Subscription Status</h3>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive
                ? 'bg-green-100 text-green-800'
                : subscription?.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {subscription?.status?.toUpperCase() || 'INACTIVE'}
          </span>
        </div>

        {isFreeTrial && remainingDays !== null ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            You are currently on a free trial. {remainingDays} day{remainingDays === 1 ? '' : 's'} remaining.
          </div>
        ) : null}

        {!isFreeTrial && isActive && remainingDays !== null ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Your active subscription expires in {remainingDays} day{remainingDays === 1 ? '' : 's'}.
          </div>
        ) : null}

        {/* Active users can request an upgrade */}
        {isActive && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowUpgradeForm((s) => !s)}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-150"
              style={{ alignItems: 'center' }}
            >
              <span className="text-sm font-semibold">{showUpgradeForm ? 'Hide upgrade' : 'Upgrade plan'}</span>
            </button>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <p className="text-gray-600">
            <span className="font-medium">Monthly Fee:</span> ${subscription?.monthly_fee || 5.0}/month
          </p>

          <p className="text-gray-600">
            <span className="font-medium">Active Until:</span>{' '}
            {subscription?.active_until
              ? new Date(subscription.active_until).toLocaleDateString()
              : 'N/A'}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Next Billing Date:</span>{' '}
            {subscription?.next_billing_date
              ? new Date(subscription.next_billing_date).toLocaleDateString()
              : 'N/A'}
          </p>

          {subscription?.status === 'pending' && (
            <p className="text-yellow-700 bg-yellow-50 p-2 rounded">
              Your subscription request is pending approval from an admin.
            </p>
          )}
        </div>

        {(!isActive || showUpgradeForm) && subscription?.status !== 'pending' && (
          <>
            <div className="mt-6 space-y-4 border-t border-theme-input pt-4">
              <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-900">
                <p className="font-semibold">💰 Payment Instructions</p>
                
                <div className="mt-3 space-y-2">
                  <p className="font-medium">Send payment to:</p>
                  <p className="ml-2 font-mono font-bold text-cyan-700">+252686859656</p>
                  
                  <p className="mt-3 font-medium">USSD Payment Methods:</p>
                  <div className="ml-2 space-y-1 font-mono text-xs">
                    <p><span className="font-bold">Hormuud:</span> *712*686859656*5#</p>
                    <p><span className="font-bold">Somnet:</span> *812*686859656*5#</p>
                  </div>
                  
                  <p className="mt-3">
                    Questions?{' '}
                    <a
                      href="https://wa.me/252686859656"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline hover:text-cyan-700"
                    >
                      Contact us via WhatsApp
                    </a>
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-theme-secondary">
                <p className="font-medium text-theme-primary">Payment details</p>
                <p>Enter your payment information so the admin can verify your subscription request.</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-theme-primary">Plan</label>
                    <select
                      value={selectedPlanFee}
                      onChange={(e) => setSelectedPlanFee(Number(e.target.value))}
                      className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                      style={{ backgroundColor: 'var(--surface-input)', color: 'var(--text-primary)' }}
                    >
                      <option value={5}>Basic — $5 / month</option>
                      <option value={10}>Pro — $10 / month</option>
                      <option value={20}>Team — $20 / month</option>
                    </select>
                  </div>
                  <input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Payer name"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                  <input
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder="Phone used to send money"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                  <input
                    value={paymentEmail}
                    onChange={(e) => setPaymentEmail(e.target.value)}
                    placeholder="Payment email"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Business name"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                </div>

                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Payment reference / transaction ID"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Additional notes or instructions"
                  className="w-full min-h-30 rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <Button
              onClick={handleRequest}
              disabled={requesting || !payerName.trim() || !paymentPhone.trim() || !paymentEmail.trim() || !businessName.trim()}
              className="w-full mt-4"
            >
              {requesting ? 'Submitting...' : 'Request Subscription'}
            </Button>

            {requestMessage && (
              <p className="mt-3 text-sm text-theme-secondary">{requestMessage}</p>
            )}
          </>
        )}

        {subscription?.status === 'pending' && (
          <div className="p-2 bg-blue-50 text-blue-800 rounded text-sm">
            Waiting for admin approval...
          </div>
        )}
      </div>
    </Card>
  );
}
