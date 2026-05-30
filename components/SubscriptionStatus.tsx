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

  const handleRequest = async () => {
    setRequestMessage('');
    setRequesting(true);
    try {
      await apiPost('/api/subscriptions', {
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

        <div className="space-y-2 text-sm">
          <p className="text-gray-600">
            <span className="font-medium">Monthly Fee:</span> ${subscription?.monthly_fee || 5.0}/month
          </p>

          {isActive && (
            <>
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
            </>
          )}

          {subscription?.status === 'pending' && (
            <p className="text-yellow-700 bg-yellow-50 p-2 rounded">
              Your subscription request is pending approval from an admin.
            </p>
          )}
        </div>

        {!isActive && subscription?.status !== 'pending' && (
          <>
            <div className="mt-6 space-y-4 border-t border-theme-input pt-4 text-sm text-theme-secondary">
              <p className="font-medium text-theme-primary">Payment details</p>
              <p>Enter your payment information so the admin can verify your subscription request.</p>

              <div className="grid gap-4 sm:grid-cols-2">
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
                className="w-full min-h-[120px] rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
              />
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
