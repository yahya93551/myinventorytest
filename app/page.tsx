"use client";

import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTheme } from "@/lib/theme-context";

export default function Page() {
  const { dark } = useTheme();
  const { loading } = useRequireAuth();
  const { data: tenantRoleData, isLoading: roleLoading } = useTenantRole();

  if (loading || roleLoading) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="w-full min-w-0 space-y-8 px-2 sm:px-4 lg:px-6 animate-pulse">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="h-9 w-32 rounded-2xl bg-theme-surface" />
                <div className="h-4 w-80 rounded-xl bg-theme-surface/80" />
              </div>
            </div>

            <div className="mb-6">
              <div className="card-compact w-full max-w-[18rem] p-3">
                <div className="h-3 w-24 rounded-full bg-theme-surface" />
                <div className="mt-3 h-8 w-16 rounded-xl bg-theme-surface" />
              </div>
            </div>

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card-compact px-3 py-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 rounded-full bg-theme-surface" />
                      <div className="h-7 w-24 rounded-xl bg-theme-surface" />
                      <div className="h-3 w-28 rounded-full bg-theme-surface/80" />
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-theme-surface" />
                  </div>
                </div>
              ))}
            </div>

            <div className="card-standard mt-6">
              <div className="h-6 w-40 rounded-xl bg-theme-surface" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="card-compact bg-theme-surface p-4">
                    <div className="h-3 w-20 rounded-full bg-theme-surface/80" />
                    <div className="mt-3 h-8 w-20 rounded-xl bg-theme-surface" />
                  </div>
                ))}
              </div>
              <div className="mt-6 h-52 rounded-3xl border border-theme-surface bg-theme-surface" />
            </div>
          </div>
        </div>
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