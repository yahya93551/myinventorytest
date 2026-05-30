"use client";

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTheme } from "@/lib/theme-context";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { useSubscription } from "@/hooks/useSubscription";
import DebtModal, { DebtFormValues } from "../../components/DebtModal";
import DebtCard, { DebtRecord } from "../../components/DebtCard";
import Button from "../../components/Button";
import { Search, Plus } from "lucide-react";

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
  const [debts, setDebts] = useState<StoredDebt[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<DebtFormValues> | undefined>(undefined);
  const [query, setQuery] = useState("");
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

  const customers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; debts: DebtRecord[] }>();
    debts.forEach((d) => {
      const existing = map.get(d.phone);
      const rec = { name: d.name || existing?.name || "", phone: d.phone, debts: existing ? [...existing.debts, { id: d.id, amount: d.amount, date: d.date, note: d.note, paid: d.paid }] : [{ id: d.id, amount: d.amount, date: d.date, note: d.note, paid: d.paid }] };
      map.set(d.phone, rec);
    });
    let arr = Array.from(map.values());

    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
    }

    // sort by latest debt date desc
    arr.sort((a, b) => {
      const aDate = a.debts[a.debts.length - 1]?.date || "";
      const bDate = b.debts[b.debts.length - 1]?.date || "";
      return bDate.localeCompare(aDate);
    });

    return arr;
  }, [debts, query]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p>Loading debts...</p>
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
      <Sidebar />

      <div className="flex-1 p-6">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <section className="rounded-3xl border border-theme-stroke bg-theme-surface p-6 shadow-sm">
            {error && (
              <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Debt Notebook</h2>
                <p className="text-sm text-theme-secondary">Manage customer debts and save them to the database</p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or phone"
                    className="w-full rounded-lg border border-theme px-3 py-2 pr-10 bg-transparent focus:outline-none focus:ring-2 focus:ring-theme focus:border-theme"
                  />
                  <Search className="absolute right-3 top-2.5 text-theme-secondary" />
                </div>

                <Button variant="primary" size="md" icon={<Plus />} onClick={() => openAddModal()}>
                  Add Debt
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <DebtCard
                key={c.phone}
                customer={c}
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
