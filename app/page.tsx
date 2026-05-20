"use client";

import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";

export default function Page() {
  const { dark } = useTheme();
  const { loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <Sidebar />
      <div className="flex-1 p-4 sm:p-6">
        <Dashboard />
      </div>
    </div>
  );
}