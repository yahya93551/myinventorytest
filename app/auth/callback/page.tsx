"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams.get("type");
    const token = searchParams.get("token");

    // Handle password recovery
    if (type === "recovery") {
      router.replace("/auth/reset-password");
    }
    // Handle email confirmation
    else if (type === "signup" && token) {
      router.replace(`/login?verified=true`);
    }
    // Default: go to login
    else {
      router.replace("/login");
    }
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
