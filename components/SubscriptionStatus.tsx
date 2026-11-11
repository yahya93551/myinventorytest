import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { apiGet, apiPost } from '@/lib/apiClient';
import {
  getSubscriptionDiscountForDuration,
  getSubscriptionDurationPrice,
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

export function SubscriptionStatus({ onRequestClick }: SubscriptionStatusProps) {
  const { subscription, loading, error, isActive } = useSubscription();
  const [requesting, setRequesting] = useState(false);
  const [accountNo, setAccountNo] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
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
    apiGet<{
      payment: typeof payment;
      checkoutEnabled: boolean;
    }>('/api/subscriptions/payment')
      .then((result) => {
        if (!active) return;
        setPayment(result.data?.payment ?? null);
        setCheckoutEnabled(result.data?.checkoutEnabled === true);
      })
      .catch((err) => {
        if (!active) return;
        setPaymentError(err instanceof Error ? err.message : 'Could not load payment status.');
      })
      .finally(() => {
        if (active) setPaymentLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
      const result = await apiPost<{
        referenceId: string;
        status: string;
        providerState: string | null;
        plan: SubscriptionPlan;
        durationMonths: number;
        amountMinor: number;
        currency: string;
        createdAt?: string;
      }>('/api/subscriptions/checkout', {
        plan: selectedPlan,
        durationMonths: selectedDurationMonths,
        accountNo,
      });
      if (!result.data?.referenceId) {
        throw new Error('WaafiPay did not return a payment reference. Please try again later.');
      }
      setPayment({
        ...result.data,
        providerState: result.data.providerState ?? null,
        createdAt: result.data.createdAt ?? new Date().toISOString(),
      });
      setAccountNo('');
      setRequestMessage(
        result.data.status === 'pending'
          ? 'Payment request sent. Your subscription will not activate until an administrator verifies the payment.'
          : 'This payment already has a recorded result. Contact an administrator before making another payment.',
      );
      if (onRequestClick) onRequestClick();
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

          {paymentError && (
            <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">
              {paymentError}
            </p>
          )}

          {payment && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {payment.status === 'pending'
                  ? 'Payment pending — awaiting manual verification'
                  : 'Payment recorded — contact an administrator to confirm its status'}
              </p>
              <p className="mt-2">
                Reference: <span className="font-mono font-semibold">{payment.referenceId}</span>
              </p>
              <p className="mt-1">
                {payment.plan} plan, {payment.durationMonths} month{payment.durationMonths === 1 ? '' : 's'} —{' '}
                {payment.currency} {(payment.amountMinor / 100).toFixed(2)}
              </p>
              <p className="mt-2">
                A provider response does not activate your subscription. Keep this reference and wait for an administrator to verify the payment.
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
                <p className="font-semibold">Pay securely with WaafiPay</p>
                <p className="mt-2">
                  Enter your WaafiPay account number to start checkout. Your subscription remains unchanged until the payment is manually verified.
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

            <Button
              onClick={handleRequest}
              disabled={requesting || paymentLoading || payment?.status === 'pending' || !/^[1-9][0-9]{9,19}$/.test(accountNo)}
              className="w-full mt-4"
            >
              {requesting ? 'Connecting to WaafiPay...' : 'Checkout with WaafiPay'}
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
