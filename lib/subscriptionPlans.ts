export type SubscriptionPlan = "basic" | "pro" | "unlimited";

export const SUBSCRIPTION_PLAN_PRODUCT_LIMITS: Record<SubscriptionPlan, number | null> = {
  basic: 1000,
  pro: 5000,
  unlimited: null,
};

export const SUBSCRIPTION_PLAN_USER_LIMITS: Record<SubscriptionPlan, number | null> = {
  basic: 3,
  pro: 10,
  unlimited: null,
};

export const SUBSCRIPTION_PLAN_MONTHLY_FEE: Record<SubscriptionPlan, number> = {
  basic: 5.0,
  pro: 7.0,
  unlimited: 10.0,
};

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "basic" || value === "pro" || value === "unlimited";
}

export function getSubscriptionPlan(subscription: { monthly_fee?: number | null; plan?: unknown } | null): SubscriptionPlan {
  if (subscription?.plan && isSubscriptionPlan(subscription.plan)) {
    return subscription.plan;
  }

  const fee = Number(subscription?.monthly_fee ?? 5);
  if (!Number.isFinite(fee)) {
    return "basic";
  }

  if (fee <= SUBSCRIPTION_PLAN_MONTHLY_FEE.basic) {
    return "basic";
  }

  if (fee <= SUBSCRIPTION_PLAN_MONTHLY_FEE.pro) {
    return "pro";
  }

  return "unlimited";
}

export function getSubscriptionPlanLimits(plan: SubscriptionPlan) {
  return {
    maxProducts: SUBSCRIPTION_PLAN_PRODUCT_LIMITS[plan],
    maxUsers: SUBSCRIPTION_PLAN_USER_LIMITS[plan],
  };
}

export function getSubscriptionMonthlyFeeForPlan(plan: SubscriptionPlan) {
  return SUBSCRIPTION_PLAN_MONTHLY_FEE[plan];
}

export function getSubscriptionDiscountForDuration(months: number): number {
  if (months >= 12) return 20;
  if (months >= 6) return 15;
  if (months >= 3) return 10;
  return 0;
}

export function getSubscriptionDurationPrice(plan: SubscriptionPlan, months: number): number {
  const baseMonthly = getSubscriptionMonthlyFeeForPlan(plan);
  const discount = getSubscriptionDiscountForDuration(months);
  const discountedMonthly = baseMonthly * (1 - discount / 100);
  return Number((discountedMonthly * months).toFixed(2));
}
