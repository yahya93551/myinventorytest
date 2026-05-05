"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    setMessage("");
    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
    }
  };

  const signup = async () => {
    setMessage("");
    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created successfully. Please log in.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="p-6 bg-white/10 rounded-2xl w-[320px] space-y-4">
        <h2 className="text-xl font-bold">Login</h2>

        {message && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-100">
            {message}
          </div>
        )}

        <input
          className="w-full p-2 bg-white/10 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full p-2 bg-white/10 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={login}
          className="w-full bg-blue-600 p-2 rounded"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <button
          onClick={signup}
          className="w-full bg-green-600 p-2 rounded"
          disabled={loading}
        >
          Create Account
        </button>
      </div>
    </div>
  );
}