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

      // Supabase processes the recovery URL and creates
      // the session automatically.
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Supabase session error:", error);
        router.replace("/login?error=reset_failed");
        return;
      }

      if (session) {
        console.log("✅ Recovery session found");
        router.replace("/auth/reset-password");
        return;
      }

      // Sometimes the Supabase client needs a moment to
      // process the URL hash and establish the session.
      const timeout = setTimeout(async () => {
        const {
          data: { session: latestSession },
          error: latestError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (latestError || !latestSession) {
          console.error(
            "❌ No recovery session found",
            latestError
          );

          router.replace("/login?error=invalid_reset_link");
          return;
        }

        console.log("✅ Recovery session found after waiting");
        router.replace("/auth/reset-password");
      }, 1000);

      return () => clearTimeout(timeout);
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