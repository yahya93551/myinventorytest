// app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log("=================================");
    console.log("🔐 SUPABASE AUTH CALLBACK DEBUG");
    console.log("=================================");

    console.log("FULL URL:", window.location.href);
    console.log("PATHNAME:", window.location.pathname);
    console.log("SEARCH:", window.location.search);
    console.log("HASH:", window.location.hash);

    console.log("SEARCH PARAMS:");

    for (const [key, value] of searchParams.entries()) {
      console.log(`${key}:`, value);
    }

    const type = searchParams.get("type");
    const token = searchParams.get("token");

    console.log("type:", type);
    console.log("token exists:", !!token);

    console.log("=================================");

    const handleRecovery = async () => {
      if (type === "recovery" && token) {
        console.log("✅ Recovery token found");

        try {
          const result = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          });

          console.log("verifyOtp result:", result);

          if (result.error) {
            console.error("❌ verifyOtp error:", result.error);
            return;
          }

          console.log("✅ Recovery verification successful");

          router.replace("/auth/reset-password");
          return;
        } catch (error) {
          console.error("❌ Recovery verification exception:", error);
          return;
        }
      }

      console.log("⚠️ Recovery token/type NOT found");
      console.log("type:", type);
      console.log("token:", token);

      // TEMPORARILY DISABLED
      // router.replace("/login");
    };

    handleRecovery();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4"></div>
        <p className="text-slate-400">Checking authentication...</p>
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
            <p className="text-slate-400">Loading...</p>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}