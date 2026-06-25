export type SubscriptionPlan = "basic" | "pro" | "team";

export const SUBSCRIPTION_PLAN_PRODUCT_LIMITS: Record<SubscriptionPlan, number | null> = {
  basic: 1000,
  pro: 5000,
  team: null,
};

export const SUBSCRIPTION_PLAN_USER_LIMITS: Record<SubscriptionPlan, number | null> = {
  basic: 3,
  pro: 10,
  team: null,
};

export const SUBSCRIPTION_PLAN_MONTHLY_FEE: Record<SubscriptionPlan, number> = {
  basic: 5.0,
  pro: 9.0,
  team: 19.0,
};

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "basic" || value === "pro" || value === "team";
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

  return "team";
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
