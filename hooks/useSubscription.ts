import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/apiClient';
import { Subscription } from '@/types';

interface SubscriptionError {
  error: string;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiGet<Subscription>('/api/subscriptions');
      setSubscription(result.data ?? null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(errorMessage);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = subscription?.status === 'active';

  return {
    subscription,
    loading,
    error,
    isActive,
    refetch: fetchSubscription,
  };
}
