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

function getPaymentOutcomeMessage(status: string, providerState: string | null) {
  const state = providerState?.trim().toLowerCase();

  const providerMessages: Record<string, string> = {
    invalid_credentials: 'EVC Plus could not process the payment because the merchant API credentials are invalid. Please contact support.',
    invalid_hpp_token: 'EVC Plus rejected an invalid hosted payment token. Please try again or contact support.',
    invalid_hpp_result_token: 'EVC Plus could not verify the hosted payment result. Please contact support.',
    reference_mismatch: 'The payment reference did not match EVC Plus records. Please contact support before retrying.',
    request_id_mismatch: 'The payment request did not match EVC Plus records. Please contact support before retrying.',
    user_cancelled: 'You canceled the EVC Plus payment request. No subscription was activated.',
    hpp_token_expired: 'The EVC Plus payment session expired. Start a new checkout.',
    service_not_enabled: 'This payment method is not enabled for the merchant. Please contact support.',
    user_timeout: 'The payment request timed out before it was completed. Start a new checkout if you still want to pay.',
    user_rejected: 'You rejected the EVC Plus payment request. No subscription was activated.',
    already_cancelled: 'EVC Plus reports that this transaction was already canceled. No subscription was activated.',
  };

  if (state && providerMessages[state]) {
    return providerMessages[state];
  }
  if (state === 'insufficient_balance') {
    return 'Haraaga xisaabtaadu kuguma filna';
  }
  if (state === 'cancelled' || state === 'canceled') {
    return 'You canceled the payment request. No subscription was activated.';
  }
  if (state === 'rcs_user_rejected') {
    return 'You rejected the EVC Plus payment request. No subscription was activated.';
  }
  if (status === 'succeeded') {
    return 'EVC Plus confirmed your payment. Your subscription is active.';
  }
  if (status === 'failed') {
    return 'Your payment was rejected. Please try again. No subscription was activated.';
  }
  if (status === 'pending') {
    return 'Payment is awaiting EVC Plus confirmation. Do not submit another checkout while it is unresolved.';
  }
  return 'Payment status requires review. Contact support before trying another payment.';
}

export function SubscriptionStatus({ onRequestClick }: SubscriptionStatusProps) {
  const { subscription, loading, error, isActive, refetch } = useSubscription();
  const [requesting, setRequesting] = useState(false);
  const [accountNo, setAccountNo] = useState('252');
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentPending, setPaymentPending] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{
    referenceId: string;
    status: string;
    providerState: string | null;
    plan: SubscriptionPlan;
    durationMonths: number;
    amountMinor: number;
    currency: string;
    createdAt: string;
    sandbox?: boolean;
    sandboxOutcome?: string;
  } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(() => getSubscriptionPlan(subscription ?? null));
  const [selectedDurationMonths, setSelectedDurationMonths] = useState<number>(1);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

  useEffect(() => {
    if (subscription?.plan && isSubscriptionPlan(subscription.plan)) {
      setSelectedPlan(subscription.plan);
    }
  }, [subscription]);

  useEffect(() => {
    let active = true;
    if (sandboxMode) {
      return () => {
        active = false;
      };
    }

    const loadPaymentStatus = () => apiGet<{
      payment: typeof payment;
      paymentPending?: boolean;
      checkoutEnabled: boolean;
      checkoutMode?: string;
    }>('/api/subscriptions/payment')
      .then((result) => {
        if (!active) return;
        setPayment(result.data?.payment ?? null);
        setPaymentPending(result.data?.paymentPending === true);
        setCheckoutEnabled(result.data?.checkoutEnabled === true);
        setSandboxMode(result.data?.checkoutMode === 'sandbox');
        setPaymentError(null);
      })
      .catch((err) => {
        if (!active) return;
        setPaymentError(err instanceof Error ? err.message : 'Could not load payment status.');
      })
      .finally(() => {
        if (active) setPaymentLoading(false);
      });

    void loadPaymentStatus();
    const interval = paymentPending
      ? window.setInterval(() => void loadPaymentStatus(), 5000)
      : null;

    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [payment?.sandbox, paymentPending, sandboxMode]);

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
    const checkoutPayload = {
      plan: selectedPlan,
      durationMonths: selectedDurationMonths,
      accountNo,
    };

    try {
      const result = await apiPost<{
        referenceId: string;
        status: string;
        sandbox?: boolean;
        sandboxOutcome?: string;
        providerState: string | null;
        plan: SubscriptionPlan;
        durationMonths: number;
        amountMinor: number;
        currency: string;
        createdAt?: string;
      }>('/api/subscriptions/checkout', checkoutPayload);
      if (!result.data?.referenceId) {
        throw new Error('EVC Plus did not return a payment reference. Please try again later.');
      }
      const awaitingFinalPaymentStatus = !result.data.sandbox
        && result.data.status === 'pending';
      setPaymentPending(awaitingFinalPaymentStatus);
      setPayment(awaitingFinalPaymentStatus ? null : {
        ...result.data,
        providerState: result.data.providerState ?? null,
        createdAt: result.data.createdAt ?? new Date().toISOString(),
        sandbox: result.data.sandbox === true,
        sandboxOutcome: result.data.sandboxOutcome,
      });
      if (result.data.sandbox) {
        setRequestMessage('Sandbox request completed. No production payment record or subscription was changed.');
      } else if (result.data.status === 'succeeded') {
        setPaymentPending(false);
        setAccountNo('252');
        setRequestMessage(getPaymentOutcomeMessage(result.data.status, result.data.providerState));
        await refetch();
      } else if (result.data.status === 'failed') {
        setPaymentPending(false);
        setAccountNo('252');
        setRequestMessage(getPaymentOutcomeMessage(result.data.status, result.data.providerState));
      } else {
        setRequestMessage('Checkout is awaiting your EVC Plus response. Approve or reject the request on your phone. The payment will appear here only after EVC Plus confirms success or failure. Do not retry while it is awaiting confirmation.');
      }
      if (onRequestClick) onRequestClick();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error requesting subscription';
      console.warn('[Subscription checkout] Checkout request failed', { message });
      setRequestMessage(message);
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
            <span className="font-medium">Monthly Fee:</span> ${subscription?.monthly_fee ?? getSubscriptionMonthlyFeeForPlan('basic')}/month
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

          {paymentError && (
            <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">
              {paymentError}
            </p>
          )}

          {paymentPending && (
            <div role="status" aria-live="polite" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {payment?.providerState && payment.providerState !== 'awaiting_confirmation'
                ? `Payment status from EVC Plus: ${payment.providerState}. `
                : 'EVC Plus is awaiting your approval. '}
              The payment result will appear here after EVC Plus confirms success or failure. Do not submit another checkout while this request is unresolved.
            </div>
          )}

          {payment && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {payment.sandbox
                  ? 'Sandbox test result — no production payment or subscription changes'
                  : payment.status === 'succeeded'
                  ? 'Payment successful — subscription activated'
                  : payment.status === 'failed'
                    ? payment.providerState === 'insufficient_balance'
                      ? 'Payment failed — not enough balance'
                      : payment.providerState === 'user_rejected'
                        || payment.providerState === 'rcs_user_rejected'
                        || payment.providerState === 'user_cancelled'
                        || payment.providerState === 'user_timeout'
                        ? 'Payment rejected'
                        : payment.providerState === 'cancelled'
                          || payment.providerState === 'canceled'
                          ? 'Payment canceled'
                          : 'Your payment was rejected — please try again'
                    : payment.status === 'pending'
                      ? 'Payment pending — check your phone for the EVC prompt'
                      : 'Payment recorded — status requires review'}
              </p>
              <p className="mt-2">
                {payment.sandbox
                  ? `Sandbox outcome: ${payment.sandboxOutcome || 'unknown'}. This result was not saved as a payment and cannot activate a subscription.`
                  : getPaymentOutcomeMessage(payment.status, payment.providerState)}
              </p>
            </div>
          )}

          {subscription?.status === 'pending' && !payment && (
            <p className="text-yellow-700 bg-yellow-50 p-2 rounded">
              Your subscription request is pending approval from an admin.
            </p>
          )}
        </div>

        {(!isActive || showUpgradeForm) && subscription?.status !== 'pending' && (
          <>
            <div className="mt-6 space-y-4 border-t border-theme-input pt-4">
              <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-900">
                <p className="font-semibold">Pay securely with EVC Plus</p>
                <p className="mt-2">
                  Enter your EVC Plus account number to start checkout. EVC Plus may send an approval prompt to that wallet. A confirmed payment activates the subscription; a declined payment is recorded as failed.
                </p>
              </div>

              <div className="space-y-4 text-sm text-theme-secondary">
                <p className="font-medium text-theme-primary">Choose your plan and pay</p>

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
                      {selectedDurationMonths === 12
                        ? '1 year'
                        : `${selectedDurationMonths} month${selectedDurationMonths === 1 ? '' : 's'}`}
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

                  <label className="block">
                    <span className="text-sm font-medium text-theme-primary">EVC Plus account number</span>
                    <input
                      value={accountNo}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 20);
                        const numberWithoutPrefix = digits.startsWith('252')
                          ? digits.slice(3)
                          : digits;
                        setAccountNo(`252${numberWithoutPrefix}`.slice(0, 20));
                      }}
                      onKeyDown={(e) => {
                        const input = e.currentTarget;
                        const selectionTouchesPrefix = (input.selectionStart ?? 0) < 3
                          && (input.selectionEnd ?? 0) > 0;
                        const selectingWholeValue = input.selectionStart === 0
                          && input.selectionEnd === input.value.length;
                        const isEditingKey = e.key === 'Backspace'
                          || e.key === 'Delete'
                          || e.key.length === 1;
                        if (
                          selectionTouchesPrefix
                          && !selectingWholeValue
                          && !e.ctrlKey
                          && !e.metaKey
                          && isEditingKey
                        ) {
                          e.preventDefault();
                        }
                        if (
                          (e.key === 'Backspace' && input.selectionStart === 3 && input.selectionEnd === 3)
                          || (e.key === 'Delete' && input.selectionStart === 2 && input.selectionEnd === 2)
                        ) {
                          e.preventDefault();
                        }
                      }}
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="252 followed by your number"
                      className="mt-1 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleRequest}
              disabled={requesting || paymentLoading || (!sandboxMode && paymentPending) || !/^[1-9][0-9]{9,19}$/.test(accountNo)}
              className="w-full mt-4"
            >
              {requesting
                ? sandboxMode ? 'Connecting to EVC Plus Sandbox...' : 'Connecting to EVC Plus...'
                : sandboxMode ? 'Test EVC Plus Sandbox Checkout' : 'Checkout with EVC Plus'}
            </Button>

            {!checkoutEnabled && (
              <p className="mt-3 text-sm text-amber-700">
                EVC Plus checkout is currently disabled. No payment will be sent.
              </p>
            )}

            {requestMessage && (
              <p className="mt-3 text-sm text-theme-secondary">{requestMessage}</p>
            )}
          </>
        )}

        {paymentLoading && (
          <p className="text-sm text-theme-secondary">Checking payment status...</p>
        )}

        {subscription?.status === 'pending' && !payment && (
          <div className="p-2 bg-blue-50 text-blue-800 rounded text-sm">
            Waiting for admin approval...
          </div>
        )}
      </div>
    </Card>
  );
}
