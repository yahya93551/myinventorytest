"use client";

import { Suspense, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams.get("type");
    const token = searchParams.get("token");

    const handleRecovery = async () => {
      if (type === "recovery" && token) {
        try {
          await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          });
        } catch (error) {
          console.warn("Recovery verification warning:", error);
        }

        const params = new URLSearchParams(searchParams.toString());
        router.replace(`/auth/reset-password?${params.toString()}`);
        return;
      }

      // Handle email confirmation
      if (type === "signup" && token) {
        router.replace(`/login?verified=true`);
        return;
      }

      // Default: go to login
      router.replace("/login");
    };

    handleRecovery();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4"></div>
        <p className="text-slate-400">Redirecting...</p>
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
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4"></div>
            <p className="text-slate-400">Redirecting...</p>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
