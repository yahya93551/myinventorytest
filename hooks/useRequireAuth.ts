"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiDelete } from "@/lib/apiClient";
import { clearCurrentSessionId, getCurrentSessionId } from "@/lib/apiClient";
import type { User } from "@supabase/supabase-js";

export function useRequireAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let subscription: any;

    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error || !data.session?.user) {
          router.replace("/login");
          return;
        }

        setUser(data.session.user);
      } catch (err) {
        if (mounted) {
          router.replace("/login");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const authEvent = event as string;
      if (authEvent === "SIGNED_OUT" || authEvent === "USER_DELETED") {
        setUser(null);
        router.replace("/login");
      }

      if (authEvent === "SIGNED_IN" && session?.user) {
        setUser(session.user);
      }
    });

    subscription = authListener.data?.subscription;

    checkAuth();

    return () => {
      mounted = false;
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [router]);

  return { user, loading };
}

export async function logout() {
  try {
    const sessionId = getCurrentSessionId();
    if (sessionId) {
      await apiDelete(`/api/auth/session?session_id=${encodeURIComponent(sessionId)}`);
    }
  } catch (error) {
    console.error('[SESSION] Failed to revoke current session during logout:', error);
  } finally {
    clearCurrentSessionId();
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

// Force a hard reload on logout
export async function logoutAndReload() {
  await logout();
  if (typeof window !== "undefined") {
    // Redirect to login with a full page load
    window.location.href = "/login";
  }
}
