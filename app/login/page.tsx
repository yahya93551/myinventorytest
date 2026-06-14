"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { registerCurrentSession } from "@/lib/apiClient";
import { CheckCircle2, Lock, Mail, Phone, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { createPhoneFallbackEmail, isPhoneNumber, normalizePhoneNumber } from "@/lib/auth";

const countryOptions = [
  { code: "+252", country: "Somalia", flag: "🇸🇴" },
  { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+250", country: "Rwanda", flag: "🇷🇼" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
];

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const countryMenuRef = useRef<HTMLDivElement | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const redirectIfSignedIn = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted && data.user) {
          router.push("/");
        }
      } catch (err) {
        // Stay on login page on error
      }
    };

    redirectIfSignedIn();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (mode !== "signup") {
      setSignupMethod("email");
      setOtpSent(false);
      setOtp("");
      setIdentifier("");
      setCountryCode("+1");
      setCountryDropdownOpen(false);
      setCountryQuery("");
    }
  }, [mode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryMenuRef.current && !countryMenuRef.current.contains(event.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validate = () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      setMessageType("error");
      setMessage("Email or phone and password are required.");
      return false;
    }

    if (mode === "login") {
      const isEmail = /\S+@\S+\.\S+/.test(trimmedIdentifier);
      const isPhone = isPhoneNumber(trimmedIdentifier);

      if (!isEmail && !isPhone) {
        setMessageType("error");
        setMessage("Please enter a valid email address or phone number.");
        return false;
      }
    }

    if (mode === "signup") {
      if (signupMethod === "email") {
        const emailValid = /\S+@\S+\.\S+/.test(trimmedIdentifier);
        if (!emailValid) {
          setMessageType("error");
          setMessage("Please enter a valid email address.");
          return false;
        }
      } else {
        const phoneValue = `${countryCode}${trimmedIdentifier}`;
        if (!isPhoneNumber(phoneValue)) {
          setMessageType("error");
          setMessage("Please enter a valid phone number.");
          return false;
        }

        if (!otp.trim()) {
          setMessageType("error");
          setMessage("Enter the SMS verification code sent to your phone.");
          return false;
        }
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
    }

    return true;
  };

  const login = async () => {
    if (!validate()) return;
    setLoading(true);
    setMessage("");

    const trimmedIdentifier = identifier.trim();
    const authIdentifier = isPhoneNumber(trimmedIdentifier)
      ? createPhoneFallbackEmail(trimmedIdentifier)
      : trimmedIdentifier;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authIdentifier,
      password,
    });

    setLoading(false);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
    } else {
      try {
        await registerCurrentSession();
      } catch (sessionError) {
        console.error('[SESSION] Failed to register session after login:', sessionError);
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        router.push('/');
      }
    }
  };

  const sendOtp = async () => {
    const trimmedPhone = identifier.trim();
    const phoneValue = `${countryCode}${trimmedPhone}`;
    if (!isPhoneNumber(phoneValue)) {
      setMessageType("error");
      setMessage("Please enter a valid phone number to receive the verification code.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: normalizePhoneNumber(phoneValue) }),
      });

      const text = await res.text();
      let result: { error?: string; message?: string } = {};

      try {
        result = JSON.parse(text);
      } catch {
        result.error = text || "Failed to send verification code.";
      }

      setLoading(false);

      if (!res.ok) {
        setMessageType("error");
        setMessage(result.error || "Failed to send verification code.");
        return;
      }

      setOtpSent(true);
      setMessageType("success");
      setMessage(result.message || "Verification code sent to your phone.");
    } catch (error) {
      setLoading(false);
      setMessageType("error");
      setMessage("Failed to send verification code. Please try again.");
      console.error(error);
    }
  };

  const signup = async () => {
    if (!validate()) return;
    setLoading(true);
    setMessage("");

    const trimmedIdentifier = identifier.trim();
    const payload: Record<string, unknown> = {
      password,
    };

    if (signupMethod === "email") {
      payload.email = trimmedIdentifier;
    } else {
      const phoneValue = `${countryCode}${trimmedIdentifier}`;
      payload.phone = normalizePhoneNumber(phoneValue);
      payload.otp = otp.trim();
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      setLoading(false);

      if (!res.ok) {
        setMessageType("error");
        setMessage(result.error || "Failed to create account.");
        return;
      }

      setMessageType("success");
      setMessage(result.data?.message || "Account created successfully. Please log in.");
      setMode("login");
      setSignupMethod("email");
      setIdentifier("");
      setPassword("");
      setConfirmPassword("");
      setOtp("");
      setOtpSent(false);
    } catch (error) {
      setLoading(false);
      setMessageType("error");
      setMessage("Signup failed. Please try again.");
      console.error(error);
    }
  };

  const inputPlaceholder =
    mode === "login"
      ? "Email or phone"
      : signupMethod === "phone"
      ? "Phone number"
      : "Email";

  const Icon =
    mode === "signup" && signupMethod === "phone"
      ? Phone
      : mode === "login" && isPhoneNumber(identifier.trim())
      ? Phone
      : Mail;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%)] blur-3xl" />
        <div className="absolute right-1/2 top-1/3 -z-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-1/2 bottom-0 -z-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-8 lg:py-16">
          <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-slate-900/85 p-8 shadow-[0_35px_120px_-45px_rgba(14,165,233,0.55)] backdrop-blur-xl">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-500/20 bg-cyan-400/10 text-cyan-300 shadow-sm shadow-cyan-500/10">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Premium access</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">MyInventory</h1>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-7 text-slate-300">
              The modern inventory workspace for teams that need secure access, fast insights, and zero friction across every device.
            </p>

            <div className="mt-10 space-y-4">
              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Enterprise-grade security</p>
                  <p className="text-sm text-slate-400">Protect every login with modern auth and encrypted session handling.</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Instant onboarding</p>
                  <p className="text-sm text-slate-400">Create accounts and sign in seamlessly with our polished auth flow.</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Unified inventory control</p>
                  <p className="text-sm text-slate-400">One dashboard for products, stock, and reporting with elegant data views.</p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/5" />
          </section>

          <section className="relative rounded-4xl border border-white/10 bg-slate-950/90 p-8 shadow-[0_45px_120px_-40px_rgba(15,23,42,0.75)] backdrop-blur-xl">
            <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute right-10 top-16 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-4 flex flex-col gap-2">
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">Secure login</p>
                <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Access your account
                </h2>
                <p className="max-w-xl text-sm leading-7 text-slate-400">
                  Login or create a new account to continue managing inventory with a polished, high-end auth experience.
                </p>
              </div>

              <div className="mb-6 relative flex w-full overflow-hidden rounded-full border border-white/10 bg-slate-900/80 p-1 shadow-inner shadow-slate-950/50">
                <div className={`absolute inset-y-1 left-1 w-1/2 rounded-full bg-cyan-500/15 transition duration-300 ${mode === "signup" ? "translate-x-full" : "translate-x-0"}`} />
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`relative z-10 flex-1 rounded-full py-3 text-sm font-semibold text-center transition ${mode === "login" ? "text-white" : "text-slate-400"}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`relative z-10 flex-1 rounded-full py-3 text-sm font-semibold text-center transition ${mode === "signup" ? "text-white" : "text-slate-400"}`}
                >
                  Sign Up
                </button>
              </div>

              {mode === "signup" && (
                <div className="mb-6 flex gap-3 rounded-3xl border border-white/10 bg-slate-900/80 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMethod("email");
                      setOtpSent(false);
                      setOtp("");
                    }}
                    className={`flex-1 rounded-3xl py-3 text-sm font-semibold transition ${signupMethod === "email" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMethod("phone");
                      setOtpSent(false);
                      setOtp("");
                    }}
                    className={`flex-1 rounded-3xl py-3 text-sm font-semibold transition ${signupMethod === "phone" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                  >
                    Phone
                  </button>
                </div>
              )}

              {message && (
                <div className={`mb-6 rounded-3xl border px-4 py-3 text-sm ring-1 ${messageType === "error"
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-100 ring-rose-500/20"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 ring-emerald-500/20"}`}>
                  {message}
                </div>
              )}

              <div className="space-y-4">
                {mode === "signup" && signupMethod === "phone" ? (
                  <div className="relative" ref={countryMenuRef}>
                    <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] items-center">
                      <button
                        type="button"
                        onClick={() => setCountryDropdownOpen((open) => !open)}
                        aria-haspopup="listbox"
                        aria-expanded={countryDropdownOpen}
                        className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-slate-900/95 px-4 py-3 text-left text-sm text-white shadow-sm transition hover:border-cyan-300/40 w-full"
                      >
                        <span className="text-lg">{countryOptions.find((opt) => opt.code === countryCode)?.flag || "🌐"}</span>
                        <span className="ml-2 font-medium text-slate-100">{countryCode}</span>
                        <span className="ml-3 truncate text-sm text-slate-200">{countryOptions.find((opt) => opt.code === countryCode)?.country}</span>
                        <span className="ml-auto text-slate-400">▾</span>
                      </button>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                          <Phone className="h-5 w-5" />
                        </span>
                        <input
                          type="tel"
                          inputMode="tel"
                          className="w-full rounded-[28px] border border-white/10 bg-slate-900/95 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-500/20"
                          placeholder="Phone number"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                        />
                      </div>
                    </div>

                    {countryDropdownOpen && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-[0_30px_80px_-30px_rgba(2,6,23,0.8)]">
                        <div className="px-3 py-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                            <input
                              className="w-full rounded-xl border border-white/6 bg-slate-900/90 px-10 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-500/20"
                              placeholder="Search country..."
                              value={countryQuery}
                              onChange={(e) => setCountryQuery(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto" role="listbox" aria-label="Country codes">
                          {countryOptions
                            .filter((option) => `${option.country} ${option.code}`.toLowerCase().includes(countryQuery.toLowerCase()))
                            .map((option) => {
                              const selected = option.code === countryCode;
                              return (
                                <button
                                  key={option.code}
                                  type="button"
                                  onClick={() => {
                                    setCountryCode(option.code);
                                    setCountryQuery("");
                                    setCountryDropdownOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                                    selected
                                      ? 'bg-cyan-500/10 text-white font-semibold ring-1 ring-cyan-400/10'
                                      : 'text-slate-200 hover:bg-slate-800/60'
                                  }`}
                                >
                                  <span className="text-lg">{option.flag}</span>
                                  <span className="truncate">{option.country}</span>
                                  <span className="ml-auto text-slate-400">{option.code}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                      <Icon className="h-5 w-5" />
                    </span>
                    <input
                      className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                      placeholder={inputPlaceholder}
                      type={mode === "signup" && signupMethod === "phone" ? "tel" : "text"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </div>
                )}

                {mode === "signup" && signupMethod === "phone" && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={sendOtp}
                      disabled={loading || !isPhoneNumber(`${countryCode}${identifier.trim()}`)}
                      className="inline-flex flex-1 items-center justify-center rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {otpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                    <span className="text-xs text-slate-400">SMS verification required</span>
                  </div>
                )}

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    type="password"
                    className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {mode === "signup" && (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                      <Lock className="h-5 w-5" />
                    </span>
                    <input
                      type="password"
                      className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}

                {mode === "signup" && signupMethod === "phone" && (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-300/80">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <input
                      type="text"
                      className="w-full rounded-[28px] border border-white/10 bg-slate-950/80 py-4 pl-14 pr-4 text-sm text-white placeholder:text-slate-500 shadow-sm shadow-cyan-500/10 outline-none transition focus:border-cyan-300/60 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                      placeholder="Verification code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={mode === "login" ? login : signup}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-[28px] bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-5 py-4 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_-20px_rgba(14,165,233,0.65)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_25px_80px_-30px_rgba(14,165,233,0.75)] disabled:pointer-events-none disabled:opacity-60"
                >
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                    ? "Login"
                    : "Sign Up"}
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Secure Authentication</p>
                    <p className="text-xs text-slate-400">Protected sessions, always.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                    <Lock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Encrypted Data</p>
                    <p className="text-xs text-slate-400">End-to-end protected.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Fast Access</p>
                    <p className="text-xs text-slate-400">Login in seconds.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
