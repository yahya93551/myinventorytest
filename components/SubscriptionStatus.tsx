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

function showAccountNoInPreview(preview: unknown, accountNo: string): unknown {
  if (
    typeof preview !== 'object'
    || preview === null
    || !('payload' in preview)
    || typeof preview.payload !== 'object'
    || preview.payload === null
    || !('serviceParams' in preview.payload)
    || typeof preview.payload.serviceParams !== 'object'
    || preview.payload.serviceParams === null
    || !('payerInfo' in preview.payload.serviceParams)
    || typeof preview.payload.serviceParams.payerInfo !== 'object'
    || preview.payload.serviceParams.payerInfo === null
  ) {
    return preview;
  }

  return {
    ...preview,
    payload: {
      ...preview.payload,
      serviceParams: {
        ...preview.payload.serviceParams,
        payerInfo: {
          ...preview.payload.serviceParams.payerInfo,
          accountNo,
        },
      },
    },
  };
}

function getPaymentOutcomeMessage(status: string, providerState: string | null) {
  const state = providerState?.trim().toLowerCase();

  if (state === 'insufficient_balance') {
    return 'Not enough balance in your WaafiPay wallet. Add funds and try again. No subscription was activated.';
  }
  if (state === 'cancelled' || state === 'canceled') {
    return 'You canceled the payment request. No subscription was activated.';
  }
  if (state === 'user_rejected' || state === 'rcs_user_rejected') {
    return 'You rejected the WaafiPay payment request. No subscription was activated.';
  }
  if (status === 'succeeded') {
    return 'WaafiPay confirmed your payment. Your subscription is active.';
  }
  if (status === 'failed') {
    return 'Your payment was rejected. Please try again. No subscription was activated.';
  }
  if (status === 'pending') {
    return 'Payment is awaiting WaafiPay confirmation. Do not submit another checkout while it is unresolved.';
  }
  return 'Payment status requires review. Contact support before trying another payment.';
}

export function SubscriptionStatus({ onRequestClick }: SubscriptionStatusProps) {
  const { subscription, loading, error, isActive, refetch } = useSubscription();
  const [requesting, setRequesting] = useState(false);
  const [accountNo, setAccountNo] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentPending, setPaymentPending] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null);
  const [providerRequestPreview, setProviderRequestPreview] = useState<unknown>(null);
  const [lastCheckoutPayload, setLastCheckoutPayload] = useState<{
    plan: SubscriptionPlan;
    durationMonths: number;
    accountNo: string;
  } | null>(null);
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
    providerDiagnostics?: unknown;
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
        if (result.data?.payment?.status === 'succeeded') {
          setCheckoutResult('WaafiPay confirmed payment; subscription is active.');
        } else if (result.data?.payment?.status === 'failed') {
          setCheckoutResult('Your payment was rejected. Please try again. No subscription was activated.');
        }
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
    setCheckoutResult('Sending checkout request...');
    setProviderRequestPreview(null);
    setRequesting(true);
    const checkoutPayload = {
      plan: selectedPlan,
      durationMonths: selectedDurationMonths,
      accountNo,
    };
    setLastCheckoutPayload({
      ...checkoutPayload,
      accountNo: accountNo || '(empty)',
    });
    console.info('[Subscription checkout] App request payload (account number masked)', {
      endpoint: 'POST /api/subscriptions/checkout',
      payload: {
        plan: selectedPlan,
        durationMonths: selectedDurationMonths,
        accountNo: accountNo
          ? `${'*'.repeat(Math.max(0, accountNo.length - 4))}${accountNo.slice(-4)}`
          : '(empty)',
      },
    });

    try {
      const result = await apiPost<{
        referenceId: string;
        status: string;
        responseCode?: string | null;
        requestSent?: boolean;
        requestPreview?: unknown;
        sandbox?: boolean;
        sandboxOutcome?: string;
        providerDiagnostics?: unknown;
        providerState: string | null;
        plan: SubscriptionPlan;
        durationMonths: number;
        amountMinor: number;
        currency: string;
        createdAt?: string;
      }>('/api/subscriptions/checkout', checkoutPayload);
      console.info('[Subscription checkout] WaafiPay request diagnostics', {
        requestSent: result.data?.requestSent === true,
        requestPreview: result.data?.requestPreview ?? null,
        paymentStatus: result.data?.status ?? 'not returned',
        sandboxOutcome: result.data?.sandboxOutcome ?? null,
        providerDiagnostics: result.data?.providerDiagnostics ?? null,
        referenceId: result.data?.referenceId ?? null,
        responseCode: result.data?.responseCode ?? null,
        providerState: result.data?.providerState ?? null,
      });
      if (!result.data?.referenceId) {
        throw new Error('WaafiPay did not return a payment reference. Please try again later.');
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
        providerDiagnostics: result.data.providerDiagnostics,
      });
      setProviderRequestPreview(
        showAccountNoInPreview(result.data.requestPreview ?? null, accountNo),
      );
      if (result.data.sandbox) {
        setRequestMessage('Sandbox request completed. No production payment record or subscription was changed.');
      } else if (result.data.status === 'succeeded') {
        setPaymentPending(false);
        setAccountNo('');
        setRequestMessage(getPaymentOutcomeMessage(result.data.status, result.data.providerState));
        await refetch();
      } else if (result.data.status === 'failed') {
        setPaymentPending(false);
        setAccountNo('');
        setRequestMessage(getPaymentOutcomeMessage(result.data.status, result.data.providerState));
      } else {
        setRequestMessage('Checkout is awaiting your EVC response. Approve or reject the request on your phone. The payment will appear here only after WaafiPay confirms success or failure. Do not retry while it is awaiting confirmation.');
      }
      setCheckoutResult(awaitingFinalPaymentStatus
        ? 'Checkout is awaiting the EVC response. No final payment result is available yet; do not retry.'
        : result.data.sandbox
        ? `Sandbox request sent: ${result.data.requestSent === true ? 'yes' : 'no'}; provider outcome: ${result.data.sandboxOutcome || 'unknown'}; WaafiPay response code: ${result.data.responseCode || 'not returned'}; reference: ${result.data.referenceId}; provider state: ${result.data.providerState || 'not returned'}. No production payment was recorded.`
        : result.data.status === 'failed'
          ? getPaymentOutcomeMessage(result.data.status, result.data.providerState)
        : `Request sent: ${result.data.requestSent === true ? 'yes' : 'no'}; payment status: ${result.data.status}; WaafiPay response code: ${result.data.responseCode || 'not returned'}; reference: ${result.data.referenceId}; provider state: ${result.data.providerState || 'not returned'}.`);
      if (onRequestClick) onRequestClick();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error requesting subscription';
      console.warn('[Subscription checkout] Checkout request failed', { message });
      setRequestMessage(message);
      setCheckoutResult(`Request failed: ${message}`);
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
                ? `Payment status from WaafiPay: ${payment.providerState}. `
                : 'WaafiPay is awaiting your EVC approval. '}
              The payment result will appear here after WaafiPay confirms success or failure. Do not submit another checkout while this request is unresolved.
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
                      : payment.providerState === 'user_rejected' || payment.providerState === 'rcs_user_rejected'
                        ? 'Payment rejected'
                        : payment.providerState === 'cancelled' || payment.providerState === 'canceled'
                          ? 'Payment canceled'
                        : 'Your payment was rejected — please try again'
                    : payment.status === 'pending'
                      ? 'Payment pending — check your phone for the EVC prompt'
                      : 'Payment recorded — status requires review'}
              </p>
              <p className="mt-2">
                Reference: <span className="font-mono font-semibold">{payment.referenceId}</span>
              </p>
              <p className="mt-1">
                {payment.plan} plan, {payment.durationMonths} month{payment.durationMonths === 1 ? '' : 's'} —{' '}
                {payment.currency} {(payment.amountMinor / 100).toFixed(2)}
              </p>
              <p className="mt-2">
                {payment.sandbox
                  ? `Sandbox outcome: ${payment.sandboxOutcome || 'unknown'}. This result was not saved as a payment and cannot activate a subscription.`
                  : getPaymentOutcomeMessage(payment.status, payment.providerState)}
              </p>
              {payment.sandbox && payment.providerDiagnostics !== undefined && (
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(payment.providerDiagnostics, null, 2)}
                </pre>
              )}
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
                <p className="font-semibold">Pay securely with WaafiPay</p>
                <p className="mt-2">
                  Enter your WaafiPay account number to start checkout. WaafiPay may send an EVC approval prompt to that wallet. A confirmed payment activates the subscription; a declined payment is recorded as failed.
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
                    <span className="text-sm font-medium text-theme-primary">WaafiPay account number</span>
                    <input
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 20))}
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="International number without + or leading zero"
                      className="mt-1 w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
              <p className="font-semibold">Checkout diagnostics</p>
              <p className="mt-2">
                Endpoint: <code>POST /api/subscriptions/checkout</code>
              </p>
              <p className="mt-1">
                Checkout mode: {sandboxMode ? 'Sandbox (no production payment record)' : 'Production'}
              </p>
              <p className="mt-1">
                WaafiPay checkout: {paymentLoading
                  ? 'Checking configuration...'
                  : paymentError
                    ? 'Configuration status could not be loaded'
                    : checkoutEnabled
                      ? 'Enabled'
                      : 'Disabled'}
              </p>
              <p className="mt-2 font-medium">Request payload</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(lastCheckoutPayload ?? {
                  plan: selectedPlan,
                  durationMonths: selectedDurationMonths,
                  accountNo: accountNo || '(empty)',
                }, null, 2)}
              </pre>
              <p className="mt-2">
                {sandboxMode
                  ? 'Sandbox requests use the WaafiPay sandbox endpoint and separate sandbox credentials. They are not written to the production payment database and cannot activate a subscription.'
                  : 'This preview does not send a payment. Click Checkout with WaafiPay to send a purchase request using this number as the payer wallet. The server sends it to WaafiPay.'}
              </p>
              {checkoutResult && (
                <p role="status" aria-live="polite" className="mt-2 wrap-break-word">
                  Result: {checkoutResult}
                </p>
              )}
              {providerRequestPreview !== null && (
                <>
                  <p className="mt-3 font-medium">WaafiPay request sent (credentials masked)</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(providerRequestPreview, null, 2)}
                  </pre>
                </>
              )}
            </div>

            <Button
              onClick={handleRequest}
              disabled={requesting || paymentLoading || (!sandboxMode && paymentPending) || !/^[1-9][0-9]{9,19}$/.test(accountNo)}
              className="w-full mt-4"
            >
              {requesting
                ? sandboxMode ? 'Connecting to WaafiPay Sandbox...' : 'Connecting to WaafiPay...'
                : sandboxMode ? 'Test WaafiPay Sandbox Checkout' : 'Checkout with WaafiPay'}
            </Button>

            {!checkoutEnabled && (
              <p className="mt-3 text-sm text-amber-700">
                WaafiPay checkout is currently disabled. No payment will be sent.
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
