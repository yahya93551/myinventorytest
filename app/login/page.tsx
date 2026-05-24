"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { registerCurrentSession } from "@/lib/apiClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
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

  const validate = () => {
    if (!email.trim() || !password) {
      setMessageType("error");
      setMessage("Email and password are required.");
      return false;
    }

    const emailValid = /\S+@\S+\.\S+/.test(email);
    if (!emailValid) {
      setMessageType("error");
      setMessage("Please enter a valid email address.");
      return false;
    }

    if (password.length < 6) {
      setMessageType("error");
      setMessage("Password must be at least 6 characters.");
      return false;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return false;
    }

    return true;
  };

  const login = async () => {
    if (!validate()) return;
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
        // Hard refresh to ensure fresh state after login
        window.location.href = '/';
      } else {
        router.push('/');
      }
    }
  };

  const signup = async () => {
    if (!validate()) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await res.json();
      setLoading(false);

      if (!res.ok) {
        setMessageType("error");
        setMessage(result.error || "Failed to create account.");
        return;
      }

      setMessageType("success");
      setMessage("Account created successfully. Please log in.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setLoading(false);
      setMessageType("error");
      setMessage("Signup failed. Please try again.");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-4">
      <div className="w-full max-w-md rounded-3xl bg-theme-card border border-theme p-6 shadow-card">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{mode === "login" ? "Login" : "Create Account"}</h2>
            <p className="text-theme-secondary mt-1">
              {mode === "login"
                ? "Enter your credentials to access the dashboard."
                : "Create a secure account to manage your inventory."}
            </p>
          </div>
          <div className="flex gap-2 rounded-full bg-slate-900/70 p-1">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${mode === "login" ? "bg-cyan-400 text-slate-950" : "text-theme-secondary hover:text-white"}`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${mode === "signup" ? "bg-violet-500 text-white" : "text-theme-secondary hover:text-white"}`}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 rounded-xl p-3 text-sm ${messageType === "error" ? "bg-red-500/10 text-red-100" : "bg-emerald-500/10 text-emerald-100"}`}>
            {message}
          </div>
        )}

        <div className="space-y-3">
          <input
            className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "signup" && (
            <input
              type="password"
              className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}

          <button
            type="button"
            onClick={mode === "login" ? login : signup}
            className="w-full rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Login" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
