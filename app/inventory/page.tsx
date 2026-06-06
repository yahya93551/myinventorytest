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

  if (loading || subscriptionLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
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
