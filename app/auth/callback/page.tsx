"use client";

import { Suspense, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

function CallbackContent() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      console.log("🔐 Supabase auth callback");

      const hasRecoveryPayload =
        typeof window !== "undefined" &&
        (window.location.hash.includes("type=recovery") ||
          window.location.hash.includes("access_token=") ||
          new URLSearchParams(window.location.search).get("code"));

      const waitForRecoverySession = async (attempt = 0): Promise<boolean> => {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return false;

        if (!error && session) {
          return true;
        }

        if (hasRecoveryPayload && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          return waitForRecoverySession(attempt + 1);
        }

        return false;
      };

      const foundSession = await waitForRecoverySession();

      if (!mounted) return;

      if (foundSession) {
        console.log("✅ Recovery session found");
        router.replace("/auth/reset-password");
        return;
      }

      if (hasRecoveryPayload) {
        console.warn("Recovery link arrived but the session is still not ready. Showing reset form.");
        router.replace("/auth/reset-password");
        return;
      }

      console.error("❌ No recovery session found");
      router.replace("/login?error=invalid_reset_link");
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4" />

        <p className="text-slate-400">
          Securing your reset session...
        </p>
      </div>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4" />

            <p className="text-slate-400">
              Loading...
            </p>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}