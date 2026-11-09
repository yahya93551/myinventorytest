import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { apiGet, apiPost } from '@/lib/apiClient';
import {
  getSubscriptionDiscountForDuration,
  getSubscriptionDurationPrice,
  getSubscriptionMonthlyFeeForPlan,
  getSubscriptionPlan,
  isSubscriptionPlan,
  SubscriptionPlan
} from '@/lib/subscriptionPlans';
import PlanSelect from '@/components/PlanSelect';
import Button from '@/components/Button';
import Card from '@/components/Card';

interface SubscriptionStatusProps {
  onRequestClick?: () => void;
}

type PaymentMethod = 'manual' | 'waafi_production';

interface WaafiPaymentStatus {
  checkoutEnabled: boolean;
  serviceStatus?: string;
  environment?: 'production';
}

interface WaafiCheckoutResult {
  referenceId: string;
  outcome: 'pending' | 'succeeded' | 'failed';
  message: string;
  plan: SubscriptionPlan;
  durationMonths: number;
}

const PLAN_DETAILS: Record<SubscriptionPlan, { label: string; products: string; users: string; description: string }> = {
  basic: {
    label: 'Basic',
    products: 'Up to 1,000 products',
    users: 'Up to 3 users',
    description: 'A great starter plan for small businesses that need essential inventory management.',
  },
  pro: {
    label: 'Pro',
    products: 'Up to 5,000 products',
    users: 'Up to 10 users',
    description: 'For growing teams who need more capacity and collaboration.',
  },
  unlimited: {
    label: 'Unlimited',
    products: 'Unlimited products',
    users: 'Unlimited users',
    description: 'Designed for high-growth businesses that need full access and scale.',
  },
};

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
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(() => getSubscriptionPlan(subscription ?? null));
  const [selectedDurationMonths, setSelectedDurationMonths] = useState<number>(1);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('manual');
  const [checkingWaafi, setCheckingWaafi] = useState(false);
  const [waafiAvailabilityChecked, setWaafiAvailabilityChecked] = useState(false);
  const [waafiCheckoutReady, setWaafiCheckoutReady] = useState(false);
  const [waafiPhone, setWaafiPhone] = useState('');
  const [waafiMessage, setWaafiMessage] = useState('');
  const [waafiOutcome, setWaafiOutcome] = useState<'idle' | 'pending' | 'succeeded' | 'failed'>('idle');
  const [waafiRequesting, setWaafiRequesting] = useState(false);
  const [waafiIdempotencyKey, setWaafiIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (subscription?.plan && isSubscriptionPlan(subscription.plan)) {
      setSelectedPlan(subscription.plan);
    }
  }, [subscription]);

  const selectedPlanFee = getSubscriptionMonthlyFeeForPlan(selectedPlan);
  const selectedDurationDiscount = getSubscriptionDiscountForDuration(selectedDurationMonths);
  const selectedDurationTotal = getSubscriptionDurationPrice(selectedPlan, selectedDurationMonths);

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
        plan: selectedPlan,
        subscription_duration_months: selectedDurationMonths,
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
      if (subscription?.plan && isSubscriptionPlan(subscription.plan)) {
        setSelectedPlan(subscription.plan);
      }
    } catch (err) {
      setRequestMessage(err instanceof Error ? err.message : 'Error requesting subscription');
    } finally {
      setRequesting(false);
    }
  };

  const handlePaymentMethodChange = async (method: PaymentMethod) => {
    if (method === 'manual') {
      setPaymentMethod('manual');
      setWaafiMessage('');
      setWaafiOutcome('idle');
      return;
    }
    if (checkingWaafi || waafiAvailabilityChecked) {
      return;
    }

    setCheckingWaafi(true);
    try {
      const result = await apiGet<WaafiPaymentStatus>('/api/subscription-payments/status');
      const available = result.data?.checkoutEnabled === true;
      setWaafiCheckoutReady(available);
      setWaafiAvailabilityChecked(true);
      setPaymentMethod('waafi_production');
      if (!available) {
        setWaafiMessage(result.data?.serviceStatus === 'unavailable'
          ? 'WaafiPay payment service is currently unreachable. No payment was sent. Check the service deployment and connection.'
          : result.data?.environment === 'production'
            ? 'Production checkout is not configured. No payment was sent. Configure the production credentials, verification credentials, webhook secret, database access, and service connection.'
            : 'Production checkout is not configured on this server yet. No payment was sent. Configure the production credentials and service connection.');
        setWaafiOutcome('failed');
      }
    } catch {
      setWaafiCheckoutReady(false);
      setWaafiAvailabilityChecked(true);
      setPaymentMethod('waafi_production');
      setWaafiMessage('Could not check WaafiPay payment service readiness. No payment was sent. Check the service configuration and try again.');
      setWaafiOutcome('failed');
    } finally {
      setCheckingWaafi(false);
    }
  };

  const handleWaafiCheckout = async () => {
    setWaafiMessage('Checking WaafiPay service configuration…');
    setWaafiOutcome('pending');
    setWaafiRequesting(true);
    let checkoutSubmitted = false;
    try {
      const readiness = await apiGet<WaafiPaymentStatus>('/api/subscription-payments/status');
      setWaafiCheckoutReady(readiness.data?.checkoutEnabled === true);
      if (readiness.data?.checkoutEnabled !== true) {
        setWaafiAvailabilityChecked(true);
        setWaafiMessage(readiness.data?.environment === 'production'
          ? 'Payment not sent. Production checkout is not configured. Add the production API credentials, HPP verification credentials, webhook secret, database connection, and service settings.'
          : 'Payment not sent. Production checkout is not configured. Add the WaafiPay production credentials and service connection.');
        setWaafiOutcome('failed');
        return;
      }

      setWaafiAvailabilityChecked(true);
      const reconciliationAttempt = waafiIdempotencyKey !== null;
      const idempotencyKey = waafiIdempotencyKey || crypto.randomUUID();
      setWaafiIdempotencyKey(idempotencyKey);
      checkoutSubmitted = true;
      setWaafiMessage(reconciliationAttempt
        ? 'Checking the existing payment with WaafiPay. No new charge will be started.'
        : 'Production service is ready. Submitting your wallet payment to WaafiPay; please wait for server verification.');
      const response = await apiPost<WaafiCheckoutResult>(
        '/api/subscription-payments/checkout',
        {
          plan: selectedPlan,
          durationMonths: selectedDurationMonths,
          accountNo: waafiPhone.trim(),
        },
        { 'Idempotency-Key': idempotencyKey },
      );
      const result = response.data;
      if (!result) {
        throw new Error('WaafiPay payment service returned an empty result.');
      }
      const resultKey = /^sub-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
        .exec(result.referenceId)?.[1];
      if (!resultKey) {
        throw new Error('WaafiPay returned an invalid payment reference. Do not retry; contact support.');
      }
      const restoredAttempt = result.referenceId !== `sub-${idempotencyKey}`;
      setWaafiIdempotencyKey(resultKey);
      setSelectedPlan(result.plan);
      setSelectedDurationMonths(result.durationMonths);
      setWaafiMessage(restoredAttempt && result.outcome === 'pending'
        ? 'Found your previous pending payment. No new charge was started; use Check payment status to reconcile it.'
        : result.message);
      setWaafiOutcome(result.outcome);
      if (result.outcome === 'succeeded') {
        await refetch();
      }
      if (result.outcome === 'failed') {
        setWaafiIdempotencyKey(null);
      }
    } catch (err) {
      setWaafiMessage(checkoutSubmitted
        ? 'Payment result could not be confirmed. Do not retry or create a new payment reference; contact support to reconcile this attempt.'
        : err instanceof Error
          ? err.message
          : 'WaafiPay service readiness could not be checked.');
      setWaafiOutcome(checkoutSubmitted ? 'pending' : 'failed');
    } finally {
      setWaafiRequesting(false);
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
              <div className="space-y-3">
                <p className="font-medium text-theme-primary">Choose a payment method</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={paymentMethod === 'manual'}
                    onClick={() => handlePaymentMethodChange('manual')}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      paymentMethod === 'manual'
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-950'
                        : 'border-theme bg-theme-input text-theme-primary hover:border-cyan-300'
                    }`}
                  >
                    <span className="block font-semibold">Manual payment</span>
                    <span className="mt-1 block text-sm">Current payment process with admin verification</span>
                    <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      Available
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={checkingWaafi}
                    aria-pressed={paymentMethod === 'waafi_production'}
                    onClick={() => handlePaymentMethodChange('waafi_production')}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      paymentMethod === 'waafi_production'
                        ? 'border-amber-500 bg-amber-50 text-amber-950'
                        : 'border-theme bg-theme-input text-theme-primary hover:border-amber-300'
                    }`}
                  >
                    <span className="block font-semibold">WaafiPay API</span>
                    <span className="mt-1 block text-sm">
                      Direct wallet payment; environment checked when selected
                    </span>
                    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                      {checkingWaafi
                        ? 'Checking availability'
                        : waafiAvailabilityChecked
                          ? waafiCheckoutReady
                            ? 'Production ready'
                            : 'Production setup needed'
                          : 'Check availability'}
                    </span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'waafi_production' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-semibold">
                      {waafiCheckoutReady
                        ? 'Production payment — this will charge a real wallet.'
                        : 'Production payment selected — checkout is not ready and cannot charge yet.'}
                    </p>
                    <p className="mt-1">Your subscription changes only after WaafiPay confirms the payment on the server.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-theme-primary">Plan</label>
                      <PlanSelect
                        value={selectedPlan}
                        onChange={(plan) => setSelectedPlan(plan)}
                        disabled={waafiIdempotencyKey !== null}
                        className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="waafi-subscription-duration" className="text-sm font-medium text-theme-primary">
                        Subscription duration
                      </label>
                      <select
                        id="waafi-subscription-duration"
                        value={selectedDurationMonths}
                        onChange={(event) => setSelectedDurationMonths(Number(event.target.value))}
                        disabled={waafiIdempotencyKey !== null}
                        className="mt-1 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                      >
                        <option value={1}>1 month</option>
                        <option value={3}>3 months</option>
                        <option value={6}>6 months</option>
                        <option value={12}>1 year</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                      <p className="font-semibold">
                        Payment amount
                      </p>
                      <p className="mt-1">${selectedDurationTotal} USD</p>
                      {selectedDurationDiscount > 0 && (
                        <p className="mt-1">Includes {selectedDurationDiscount}% duration discount.</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="waafi-payment-phone" className="text-sm font-medium text-theme-primary">
                        Wallet number
                      </label>
                      <input
                        id="waafi-payment-phone"
                        inputMode="numeric"
                        autoComplete="off"
                        value={waafiPhone}
                        onChange={(event) => setWaafiPhone(event.target.value)}
                        disabled={waafiIdempotencyKey !== null}
                        placeholder="252611111111"
                        className="mt-1 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                      />
                      <p className="mt-1 text-xs text-theme-secondary">Country code included; digits only, no + or leading zero.</p>
                    </div>
                  </div>

                  {waafiMessage && (
                    <div
                      role={waafiOutcome === 'pending' ? 'status' : 'alert'}
                      aria-live="polite"
                      className={`rounded-xl border p-4 text-sm ${
                        waafiOutcome === 'pending'
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : waafiOutcome === 'succeeded'
                            ? 'border-green-300 bg-green-50 text-green-900'
                            : 'border-red-300 bg-red-50 text-red-900'
                      }`}
                    >
                      <p className="font-semibold">
                        {waafiOutcome === 'pending'
                          ? 'Checking WaafiPay payment'
                          : waafiOutcome === 'succeeded'
                            ? 'Payment confirmed'
                            : 'WaafiPay payment update'}
                      </p>
                      <p className="mt-1">{waafiMessage}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleWaafiCheckout}
                    disabled={
                      waafiRequesting
                      || !/^[0-9]{10,20}$/.test(waafiPhone.trim())
                      || (waafiIdempotencyKey !== null && waafiOutcome !== 'pending')
                    }
                    className="w-full"
                  >
                    {waafiRequesting
                      ? 'Checking and processing...'
                      : waafiIdempotencyKey && waafiOutcome === 'pending'
                        ? 'Check payment status'
                        : waafiIdempotencyKey
                          ? 'Payment confirmed'
                          : 'Pay with WaafiPay'}
                  </Button>

                </div>
              ) : (
              <>
              <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-900">
                <p className="font-semibold">💰 Payment Instructions</p>

                <div className="mt-3 space-y-2">
                  <p className="font-medium">Please contact us on WhatsApp and then fill the payment details below:</p>
                  <p className="ml-2 font-mono font-bold text-cyan-700">+252686859656</p>

                  <p className="mt-3">After sending the payment, complete the form below so the admin can verify your subscription.</p>

                  <p className="mt-3">
                    <a
                      href="https://wa.me/252686859656"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline hover:text-cyan-700"
                    >
                      Message us on WhatsApp
                    </a>
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-theme-secondary">
                <p className="font-medium text-theme-primary">Payment details</p>
                <p>Enter your payment information so the admin can verify your subscription request.</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <label className="text-sm font-medium text-theme-primary">Plan</label>
                    <PlanSelect
                      value={selectedPlan}
                      onChange={(p) => setSelectedPlan(p)}
                      className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{PLAN_DETAILS[selectedPlan].label} plan details</p>
                    <ul className="mt-2 space-y-1 list-disc pl-5">
                      <li>{PLAN_DETAILS[selectedPlan].products}</li>
                      <li>{PLAN_DETAILS[selectedPlan].users}</li>
                      <li>{PLAN_DETAILS[selectedPlan].description}</li>
                    </ul>
                  </div>

                  <div className="relative">
                    <label className="text-sm font-medium text-theme-primary">Subscription duration</label>
                    <select
                      value={selectedDurationMonths}
                      onChange={(e) => setSelectedDurationMonths(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    >
                      <option value={1}>1 month</option>
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>1 year</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                    <p className="font-semibold">Selected duration</p>
                    <p className="mt-1">
                      {selectedDurationMonths === 12 ? '1 year' : `${selectedDurationMonths} months`}
                    </p>
                    {selectedDurationDiscount > 0 && (
                      <p className="mt-2 font-medium text-cyan-700">
                        Save {selectedDurationDiscount}% with this plan.
                      </p>
                    )}
                    <p className="mt-2 font-semibold text-cyan-900">
                      Total: ${selectedDurationTotal}
                    </p>
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
            </div>
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
