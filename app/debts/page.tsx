"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import SalesRouteGuard from "@/components/SalesRouteGuard";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useBusinessSettings } from "@/hooks/useCustomFields";
import { useTheme } from "@/lib/theme-context";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { useSubscription } from "@/hooks/useSubscription";
import DebtModal, { DebtFormValues } from "../../components/DebtModal";
import DebtCard, { DebtRecord } from "../../components/DebtCard";
import Button from "../../components/Button";
import { Search, Plus } from "lucide-react";
import DebouncedDebtSearch from "./DebouncedDebtSearch";

type DebtApiRecord = {
  id: string;
  customer_name: string;
  customer_phone: string;
  amount: number;
  date: string;
  note?: string;
  paid: boolean;
  created_at: string;
};

type StoredDebt = DebtRecord & { id: string; name?: string; phone: string };

const toStoredDebt = (record: DebtApiRecord): StoredDebt => ({
  id: record.id,
  name: record.customer_name,
  phone: record.customer_phone,
  amount: record.amount,
  date: record.date,
  note: record.note,
  paid: record.paid,
});

export default function DebtsPage() {
  const { dark } = useTheme();
  const { loading: authLoading } = useRequireAuth();
  const { data: roleData, isLoading: roleLoading, isError: roleIsError, error: roleError } = useTenantRole();
  const { isActive: subscriptionActive, loading: subscriptionLoading } = useSubscription();
  const { data: businessSettings } = useBusinessSettings();
  const [debts, setDebts] = useState<StoredDebt[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<DebtFormValues> | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unpaid">("all");
  const [sortBy, setSortBy] = useState<"latest" | "high-balance">("latest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = roleData?.role === "owner";

  useEffect(() => {
    if (authLoading || roleLoading) return;

    const fetchDebts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiGet<DebtApiRecord[]>("/api/debts");
        setDebts((response.data || []).map(toStoredDebt));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load debts");
      } finally {
        setLoading(false);
      }
    };

    if (roleIsError) {
      const errorMessage = roleError instanceof Error ? roleError.message : "Failed to verify access";
      setError(errorMessage);
      setLoading(false);
      return;
    }

    if (!isOwner) {
      setError("Access denied. Only owners can view and manage debts.");
      setDebts([]);
      setLoading(false);
      return;
    }

    fetchDebts();
  }, [authLoading, roleLoading, roleIsError, roleError, isOwner]);

  const businessName = businessSettings?.business_name?.trim() || "Business";

  const customers = useMemo(() => {
    type CustomerSummary = { name: string; phone: string; debts: DebtRecord[]; totalAmount: number; unpaidAmount: number; latestDate: string };
    const map = new Map<string, { name: string; phone: string; debts: DebtRecord[] }>();
    debts.forEach((d) => {
      const existing = map.get(d.phone);
      const rec = {
        name: d.name || existing?.name || "",
        phone: d.phone,
        debts: existing ? [...existing.debts, { id: d.id, amount: d.amount, date: d.date, note: d.note, paid: d.paid }] : [{ id: d.id, amount: d.amount, date: d.date, note: d.note, paid: d.paid }],
      };
      map.set(d.phone, rec);
    });
    let arr: Array<CustomerSummary> = Array.from(map.values()) as Array<CustomerSummary>;

    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.debts.some((d) =>
            String(d.amount).toLowerCase().includes(q) ||
            d.date.toLowerCase().includes(q) ||
            (d.note || "").toLowerCase().includes(q)
          )
      );
    }

    if (filter === "unpaid") {
      arr = arr.filter((c) => c.debts.some((d) => !d.paid));
    }

    arr = arr.map((customer) => ({
      ...customer,
      totalAmount: customer.debts.reduce((sum, d) => sum + (d.amount || 0), 0),
      unpaidAmount: customer.debts.reduce((sum, d) => sum + (d.paid ? 0 : d.amount || 0), 0),
      latestDate: customer.debts[customer.debts.length - 1]?.date || "",
    }));

    arr.sort((a, b) => {
      const aHasUnpaid = a.debts.some((debt) => !debt.paid);
      const bHasUnpaid = b.debts.some((debt) => !debt.paid);

      if (aHasUnpaid !== bHasUnpaid) {
        return aHasUnpaid ? -1 : 1;
      }

      if (sortBy === "high-balance") {
        return b.unpaidAmount - a.unpaidAmount;
      }

      return b.latestDate.localeCompare(a.latestDate);
    });

    return arr;
  }, [debts, filter, query, sortBy]);

  const debtStats = useMemo(() => {
    const totalDebt = debts.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalPaid = debts.reduce((sum, d) => sum + (d.paid ? d.amount || 0 : 0), 0);
    const totalOutstanding = totalDebt - totalPaid;
    const customerCount = new Set(debts.map((d) => d.phone)).size;
    return { totalDebt, totalPaid, totalOutstanding, customerCount };
  }, [debts]);

  const openAddModal = (phone?: string, name?: string) => {
    setModalInitial(phone ? { phone, name } : undefined);
    setModalOpen(true);
  };

  const handleSave = async (vals: DebtFormValues) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    const existing = debts.find((d) => d.phone === vals.phone);
    if (existing && existing.name && vals.name && existing.name !== vals.name) {
      alert("Phone number already exists with a different name. Please use the same name or a different phone number.");
      setSaving(false);
      return;
    }

    try {
      const response = await apiPost<DebtApiRecord>("/api/debts", {
        customer_name: vals.name || existing?.name || "",
        customer_phone: vals.phone,
        amount: Number(vals.amount),
        date: vals.date,
        note: vals.note,
      });

      if (!response.data) {
        throw new Error("Failed to save debt");
      }

      const savedDebt = toStoredDebt(response.data);
      setDebts((s) => [savedDebt, ...s]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save debt");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDebt = async (phone: string, debtId: string) => {
    if (!window.confirm("Are you sure you want to delete this debt?")) {
      return;
    }

    try {
      await apiDelete("/api/debts", { id: debtId });
      setDebts((s) => s.filter((d) => !(d.phone === phone && d.id === debtId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete debt");
    }
  };

  const handleMarkPaid = async (phone: string, debtId: string) => {
    try {
      const response = await apiPatch<StoredDebt>("/api/debts", { id: debtId, paid: true });
      if (!response.data) {
        throw new Error("Failed to update debt");
      }
      setDebts((s) => s.map((d) => (d.id === debtId ? { ...d, paid: true } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark debt as paid");
    }
  };

  if (authLoading || roleLoading || subscriptionLoading || loading) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="w-full min-w-0 space-y-8 px-2 sm:px-4 lg:px-6 animate-pulse">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="h-9 w-28 rounded-2xl bg-theme-surface" />
                <div className="h-4 w-72 rounded-xl bg-theme-surface/80" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-11 w-32 rounded-2xl bg-theme-surface" />
                <div className="h-11 w-28 rounded-2xl bg-theme-surface" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-theme-surface bg-theme-card p-4 shadow-soft">
                  <div className="h-3 w-20 rounded-full bg-theme-surface" />
                  <div className="mt-3 h-7 w-24 rounded-xl bg-theme-surface" />
                  <div className="mt-2 h-3 w-28 rounded-full bg-theme-surface/80" />
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-theme-surface bg-theme-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <div className="h-5 w-28 rounded-full bg-theme-surface" />
                <div className="h-10 w-32 rounded-2xl bg-theme-surface" />
              </div>
              <div className="mt-5 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-14 rounded-2xl bg-theme-surface/80" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isOwner && !subscriptionActive) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-3xl rounded-3xl border border-yellow-200 bg-yellow-50 p-8 text-yellow-900 shadow-sm">
            <h1 className="text-3xl font-bold">Subscription required</h1>
            <p className="mt-4 text-sm text-yellow-800">
              Debt management requires an active tenant subscription. Please request a subscription in Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (roleIsError) {
    const roleErrorMessage = roleError instanceof Error ? roleError.message : "Failed to verify access";
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-7xl">
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
              <h2 className="text-2xl font-bold">Access error</h2>
              <p className="mt-2">{roleErrorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-7xl">
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-900 shadow-sm">
              <h2 className="text-2xl font-bold">Owner access required</h2>
              <p className="mt-2">Only owners can view and manage debt records.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <SalesRouteGuard />
      <Sidebar />

      <div className="flex-1 p-6">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <section className="rounded-3xl border border-theme-stroke bg-theme-surface p-6 shadow-sm">
            {error && (
              <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1.5fr_auto] lg:items-start">
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">Debt Notebook</h2>
                  <p className="text-sm text-theme-secondary">Manage customer debts and save them to the database</p>
                </div>
                <div className="max-w-md">
                  <DebouncedDebtSearch value={query} onChange={setQuery} />
                </div>
              </div>

              <div className="flex flex-col items-start gap-4 sm:items-end">
                <Button variant="primary" size="md" icon={<Plus />} onClick={() => openAddModal()}>
                  Add Debt
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                        filter === "all" ? "border-blue-700 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      All customers
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter("unpaid")}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        filter === "unpaid" ? "border-rose-500 bg-rose-500/10 text-rose-200" : "border-theme-stroke bg-theme-card text-theme-secondary"
                      }`}
                    >
                      Unpaid only
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-theme-secondary">Sort:</span>
                    <button
                      type="button"
                      onClick={() => setSortBy("latest")}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                        sortBy === "latest" ? "border-blue-700 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Latest
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy("high-balance")}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        sortBy === "high-balance" ? "border-rose-500 bg-rose-500/10 text-rose-200" : "border-theme-stroke bg-theme-card text-theme-secondary"
                      }`}
                    >
                      High balance
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-theme-stroke bg-theme-card p-4">
                <div className="text-xs text-theme-secondary">Customers</div>
                <div className="mt-2 text-xl font-semibold">{debtStats.customerCount}</div>
              </div>
              <div className="rounded-2xl border border-theme-stroke bg-theme-card p-4">
                <div className="text-xs text-theme-secondary">Paid total</div>
                <div className="mt-2 text-xl font-semibold">${debtStats.totalPaid.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-theme-stroke bg-theme-card p-4">
                <div className="text-xs text-theme-secondary">Outstanding total</div>
                <div className="mt-2 text-xl font-semibold">${debtStats.totalOutstanding.toFixed(2)}</div>
              </div>
            </div>
          </section>

          <section className="relative grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <DebtCard
                key={c.phone}
                customer={c}
                businessName={businessName}
                onAdd={openAddModal}
                onDeleteDebt={handleDeleteDebt}
                onMarkPaid={handleMarkPaid}
              />
            ))}
          </section>
        </div>
      </div>

      <DebtModal open={modalOpen} initial={modalInitial} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
