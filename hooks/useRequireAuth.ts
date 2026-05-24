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
    
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (mounted) {
          if (error || !data.user) {
            router.push("/login");
            return;
          }
          setUser(data.user);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          router.push("/login");
        }
      }
    };

    checkAuth();
    return () => {
      mounted = false;
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
