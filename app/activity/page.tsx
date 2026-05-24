"use client";

import React, { useMemo, useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ActivityLog from "@/components/ActivityLog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";
import { apiGet } from "@/lib/apiClient";
import Card from "@/components/Card";

const ACTIONS = ["", "CREATE", "SELL", "LOAD", "RESTOCK", "BULK_CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];
const ENTITIES = ["", "product", "sale", "user", "settings", "category"];

export default function ActivityPage() {
  const { dark } = useTheme();
  const { loading } = useRequireAuth();
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [tenantRole, setTenantRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiGet<{ role: string }>("/api/tenant-role")
      .then((res) => {
        if (!mounted) return;
        setTenantRole(res.data?.role || null);
      })
      .catch(() => {
        if (!mounted) return;
        setTenantRole(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filterSummary = useMemo(() => {
    const summary: string[] = [];
    if (selectedAction) summary.push(`Action: ${selectedAction}`);
    if (selectedEntity) summary.push(`Entity: ${selectedEntity}`);
    if (performedBy) summary.push(`User: ${performedBy}`);
    return summary.join(" • ");
  }, [selectedAction, selectedEntity, performedBy]);

  if (loading || tenantRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking access...</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <Sidebar />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-theme mb-2">Activity Log</h1>
          <p className="text-theme-secondary">Monitor all actions performed in your inventory system</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          <label className="block">
            <span className="text-theme-secondary text-sm">Action</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-3 py-2 text-theme-primary"
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action || "All actions"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-theme-secondary text-sm">Entity</span>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-3 py-2 text-theme-primary"
            >
              {ENTITIES.map((entity) => (
                <option key={entity} value={entity}>
                  {entity || "All entities"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-theme-secondary text-sm">Performed by</span>
            <input
              type="text"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="User email or ID"
              className="mt-2 w-full rounded-2xl border border-theme bg-theme-input px-3 py-2 text-theme-primary"
            />
          </label>
        </div>

        {filterSummary ? (
          <div className="mb-4 rounded-2xl border border-theme p-3 bg-theme-surface text-theme-secondary text-sm">
            Showing logs for {filterSummary}
          </div>
        ) : null}

        <div className="space-y-4">
          {tenantRole !== "owner" ? (
            <Card className="p-6 text-center">
              <div className="text-xl font-semibold">Access denied</div>
              <div className="text-theme-secondary mt-2">Only the tenant owner can view activity logs.</div>
            </Card>
          ) : (
            <ActivityLog perPage={20} action={selectedAction || undefined} entity={selectedEntity || undefined} performedBy={performedBy || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
