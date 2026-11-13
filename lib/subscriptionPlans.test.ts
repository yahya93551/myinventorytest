import { describe, expect, it } from 'vitest';
import {
  getSubscriptionDurationPrice,
  getSubscriptionMonthlyFeeForPlan,
} from './subscriptionPlans';

describe('Basic subscription pricing', () => {
  it('uses the restored $5 monthly rate', () => {
    expect(getSubscriptionMonthlyFeeForPlan('basic')).toBe(5);
    expect(getSubscriptionDurationPrice('basic', 1)).toBe(5);
  });
});
