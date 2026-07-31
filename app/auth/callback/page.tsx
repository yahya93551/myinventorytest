//app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

 useEffect(() => {
  console.log("====================================");
  console.log("🔐 SUPABASE CALLBACK STARTED");
  console.log("====================================");

  console.log("FULL URL:", window.location.href);
  console.log("PATH:", window.location.pathname);
  console.log("SEARCH:", window.location.search);
  console.log("HASH:", window.location.hash);

  const params = new URLSearchParams(window.location.search);

  console.log("QUERY PARAMETERS:");

  for (const [key, value] of params.entries()) {
    console.log(key, "=", value);
  }

  console.log("====================================");

  const handleCallback = async () => {
    console.log("Checking Supabase session...");

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    console.log("SESSION:", session);
    console.log("SESSION ERROR:", error);

    if (session) {
      console.log("✅ RECOVERY SESSION FOUND");
      console.log("Redirecting to reset password...");

      router.replace("/auth/reset-password");
      return;
    }

    console.log("❌ NO SESSION FOUND");
    console.log("Staying on callback page for debugging.");

    // TEMPORARILY DISABLED
    // router.replace("/login");
  };

  handleCallback();
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
