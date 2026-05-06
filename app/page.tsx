"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Page() {
  const [dark, setDark] = useState(true);

  const router = useRouter();

  // ================= AUTH PROTECTION =================
  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login");
      }
    };

    checkUser();
  }, [router]);

  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}>
      <Sidebar dark={dark} setDark={setDark} />
      <div className="flex-1 p-4 sm:p-6">
        <Dashboard />
      </div>
    </div>
  );
}