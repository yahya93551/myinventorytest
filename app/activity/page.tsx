"use client";

import Sidebar from "@/components/Sidebar";
import ActivityLog from "@/components/ActivityLog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";

export default function ActivityPage() {
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-theme mb-2">Activity Log</h1>
          <p className="text-theme-secondary">
            Monitor all actions performed in your inventory system
          </p>
        </div>

        {/* Filters could go here later */}
        <div className="space-y-4">
          <ActivityLog perPage={20} />
        </div>
      </div>
    </div>
  );
}
