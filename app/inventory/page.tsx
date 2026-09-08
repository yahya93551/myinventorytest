"use client";

import Sidebar from "@/components/Sidebar";
import Inventory from "./Inventory";
import { useInventory } from "@/hooks/useInventory";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/lib/theme-context";

export default function InventoryPage() {
  const inventory = useInventory();
  const customFieldsQuery = useCustomFields();
  const customFields = customFieldsQuery.data || [];
  const { dark } = useTheme();
  const { loading } = useRequireAuth();
  const { isActive: subscriptionActive, loading: subscriptionLoading } = useSubscription();

  if (loading || subscriptionLoading) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="w-full min-w-0 space-y-8 px-2 sm:px-4 lg:px-6 animate-pulse">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="h-9 w-36 rounded-2xl bg-theme-surface" />
                <div className="h-4 w-72 rounded-xl bg-theme-surface/80" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-11 w-32 rounded-2xl bg-theme-surface" />
                <div className="h-11 w-36 rounded-2xl bg-theme-surface" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-theme-surface bg-theme-card p-3 shadow-soft">
                  <div className="h-2.5 w-16 rounded-full bg-theme-surface" />
                  <div className="mt-3 h-6 w-12 rounded-xl bg-theme-surface" />
                  <div className="mt-2 h-2.5 w-24 rounded-full bg-theme-surface/80" />
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-theme-surface bg-theme-card p-5 shadow-soft">
              <div className="h-6 w-40 rounded-xl bg-theme-surface" />
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-theme-surface bg-theme-surface p-3">
                    <div className="h-3 w-20 rounded-full bg-theme-surface/80" />
                    <div className="mt-3 h-7 w-24 rounded-xl bg-theme-surface" />
                    <div className="mt-2 h-3 w-28 rounded-full bg-theme-surface/70" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-theme-surface bg-theme-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 rounded-full bg-theme-surface" />
                <div className="h-5 w-20 rounded-full bg-theme-surface" />
              </div>
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-2xl bg-theme-surface/80" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionActive) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-3xl rounded-3xl border border-yellow-200 bg-yellow-50 p-8 text-yellow-900 shadow-sm">
            <h1 className="text-3xl font-bold">Subscription required</h1>
            <p className="mt-4 text-sm text-yellow-800">
              Your tenant needs an active subscription to sell products and manage inventory. Please request a subscription from Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <Sidebar />
      <div className="flex-1 min-w-0 p-4 sm:p-6">
        <Inventory {...inventory} customFields={customFields} />
      </div>
    </div>
  );
}
