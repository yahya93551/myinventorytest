import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface SubscriptionCheckResult {
  isActive: boolean;
  status: string;
  subscription: any | null;
  error: string | null;
}

/**
 * Check if a tenant has an active subscription
 * @param tenantId - The tenant ID to check
 * @returns SubscriptionCheckResult with status and subscription data
 */
export async function checkSubscriptionStatus(tenantId: string): Promise<SubscriptionCheckResult> {
  try {
    const { data: subscription, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      return {
        isActive: false,
        status: 'error',
        subscription: null,
        error: error.message,
      };
    }

    if (!subscription) {
      return {
        isActive: false,
        status: 'no_subscription',
        subscription: null,
        error: null,
      };
    }

    const isActive = subscription.status === 'active';
    return {
      isActive,
      status: subscription.status,
      subscription,
      error: null,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      isActive: false,
      status: 'error',
      subscription: null,
      error: errorMessage,
    };
  }
}

/**
 * Middleware function to protect routes that require active subscription
 * Use in API routes or server components
 */
export async function requireActiveSubscription(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await checkSubscriptionStatus(tenantId);

  if (!result.isActive) {
    return {
      success: false,
      error: `Subscription required. Current status: ${result.status}`,
    };
  }

  return { success: true };
}
