'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme-context';
import { registerCurrentSession, clearCurrentSessionId } from '@/lib/apiClient';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function SessionTracker() {
  useEffect(() => {
    let active = true;
    let subscription: any;

    const registerSession = async () => {
      try {
        await registerCurrentSession();
      } catch (error) {
        if (active) {
          console.warn('[SESSION] Active session registration failed:', error);
        }
      }
    };

    registerSession();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      const authEvent = event as string;

      if (authEvent === 'SIGNED_IN' && session) {
        registerSession();
      }

      if (authEvent === 'SIGNED_OUT' || authEvent === 'USER_DELETED') {
        clearCurrentSessionId();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    });

    subscription = data?.subscription;

    return () => {
      active = false;
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionTracker />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
