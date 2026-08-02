// app/auth/reset-password/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ResetPasswordContent() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    const checkRecoverySession = async (attempt = 0) => {
      try {
        console.log("🔐 Checking recovery session...");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);

          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            return checkRecoverySession(attempt + 1);
          }

          setMessageType("error");
          setMessage("Unable to verify your reset session.");
          setIsValidSession(false);
          setValidating(false);
          return;
        }

        if (!session) {
          const hasRecoveryPayload =
            typeof window !== "undefined" &&
            (window.location.hash.includes("type=recovery") ||
              window.location.hash.includes("access_token=") ||
              new URLSearchParams(window.location.search).get("code"));

          if (hasRecoveryPayload && attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            return checkRecoverySession(attempt + 1);
          }

          console.error("❌ No recovery session found");

          setMessageType("error");
          setMessage(
            "This password reset link is invalid or has expired. Please request a new one."
          );
          setIsValidSession(false);
          setValidating(false);
          return;
        }

        console.log("✅ Recovery session confirmed");

        setIsValidSession(true);
        setMessage("");
        setValidating(false);
      } catch (error) {
        console.error("Recovery session check failed:", error);

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          return checkRecoverySession(attempt + 1);
        }

        setMessageType("error");
        setMessage("Failed to validate reset session. Please try again.");
        setIsValidSession(false);
        setValidating(false);
      }
    };

    checkRecoverySession();
  }, []);

  const validate = () => {
    if (!password || !confirmPassword) {
      setMessageType("error");
      setMessage("Please enter and confirm your password.");
      return false;
    }

    if (password.length < 6) {
      setMessageType("error");
      setMessage("Password must be at least 6 characters.");
      return false;
    }

    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validate()) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setLoading(false);
        setMessageType("error");
        setMessage(error.message || "Failed to reset password.");
        return;
      }

      setLoading(false);
      setMessageType("success");
      setMessage("Password reset successful! Redirecting to login...");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);

      setLoading(false);
      setMessageType("error");
      setMessage("Failed to reset password. Please try again.");
    }
  };

  if (validating) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4" />
          <p className="text-slate-400">
            Securing your password reset...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%)] blur-3xl" />

        <div className="absolute right-1/2 top-1/3 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="absolute left-1/2 bottom-0 -z-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-8 lg:py-16">

          {/* LEFT BRANDING */}
          <section className="hidden lg:block relative overflow-hidden rounded-4xl border border-white/10 bg-slate-900/85 p-8 shadow-[0_35px_120px_-45px_rgba(14,165,233,0.55)] backdrop-blur-xl">

            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-500/20 bg-cyan-400/10 text-cyan-300 shadow-sm shadow-cyan-500/10">
                <Sparkles className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">
                  Premium access
                </p>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  MyInventory
                </h1>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-7 text-slate-300">
              The modern inventory workspace for teams that need secure access,
              fast insights, and zero friction across every device.
            </p>

            <div className="mt-10 space-y-4">

              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Enterprise-grade security
                  </p>

                  <p className="text-sm text-slate-400">
                    Protect every login with modern auth and encrypted session handling.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                  <Zap className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Instant onboarding
                  </p>

                  <p className="text-sm text-slate-400">
                    Create accounts and sign in seamlessly with our polished auth flow.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Unified inventory control
                  </p>

                  <p className="text-sm text-slate-400">
                    One dashboard for products, stock, and reporting with elegant data views.
                  </p>
                </div>
              </div>

            </div>

            <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/5" />
          </section>

          {/* RESET PASSWORD */}
          <section className="relative rounded-4xl border border-white/10 bg-slate-950/90 p-8 shadow-[0_45px_120px_-40px_rgba(15,23,42,0.75)] backdrop-blur-xl">

            <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="absolute right-10 top-16 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative z-10">

              <div className="mb-4 flex flex-col gap-2">

                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">
                  Secure recovery
                </p>

                <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Create new password
                </h2>

                <p className="max-w-xl text-sm leading-7 text-slate-400">
                  Enter a strong password to secure your account.
                </p>

              </div>

              {message && (
                <div
                  className={`mb-6 rounded-3xl border px-4 py-3 text-sm ring-1 ${
                    messageType === "error"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-100 ring-rose-500/20"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 ring-emerald-500/20"
                  }`}
                >
                  {message}
                </div>
              )}

              {isValidSession ? (
                <div className="space-y-4">

                  {/* NEW PASSWORD */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                      <Lock className="h-5 w-5" />
                    </span>

                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                      <Lock className="h-5 w-5" />
                    </span>

                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  {/* RESET BUTTON */}
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center rounded-[28px] bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-5 py-4 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_-20px_rgba(14,165,233,0.65)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_25px_80px_-30px_rgba(14,165,233,0.75)] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {loading
                      ? "Resetting password..."
                      : "Reset Password"}
                  </button>

                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center gap-2 text-sm text-cyan-300/80 transition hover:text-cyan-300"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Link>

                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[28px] bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-5 py-4 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_-20px_rgba(14,165,233,0.65)] transition duration-300 hover:-translate-y-0.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to Login
                </Link>
              )}

              {/* TRUST FEATURES */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <ShieldCheck className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Secure Authentication
                    </p>
                    <p className="text-xs text-slate-400">
                      Protected sessions, always.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                    <Lock className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Encrypted Data
                    </p>
                    <p className="text-xs text-slate-400">
                      End-to-end protected.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                    <Zap className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Fast Access
                    </p>
                    <p className="text-xs text-slate-400">
                      Reset in seconds.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </section>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-400 sm:flex-row">

          <div className="text-center sm:text-left">
            © {new Date().getFullYear()} MyInventory
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/legal/privacy"
              className="hover:underline"
            >
              Privacy
            </Link>

            <Link
              href="/legal/terms"
              className="hover:underline"
            >
              Terms
            </Link>

            <a
              href="mailto:support@myinventory.example"
              className="hover:underline"
            >
              Support
            </a>

            <a
              href="https://wa.me/+252686859656"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              WhatsApp
            </a>
          </div>

          <div className="text-center text-slate-500 sm:text-right">
            Built with care.
          </div>

        </div>
      </footer>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mb-4" />

            <p className="text-slate-400">
              Securing your password reset...
            </p>
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}