"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useRequireAuth, logout } from "@/hooks/useRequireAuth";
import { BusinessSettingsForm } from "@/components/BusinessSettingsForm";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { StandardFieldManager } from "@/components/StandardFieldManager";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const [dark, setDark] = useState(true);
  const [tenantRole, setTenantRole] = useState<string>("");
  const [subUsers, setSubUsers] = useState<Array<{ user_id: string; user_email: string; role: string; active: boolean; created_at: string }>>([]);
  const [newSubUserEmail, setNewSubUserEmail] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"accountant" | "sales">("sales");
  const [subUserMessage, setSubUserMessage] = useState<string>("");
  const [setupError, setSetupError] = useState<string>("");
  const [subUserLoading, setSubUserLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"owner" | "system" | "subuser" | "business" | "customfields" | "standardfields">("owner");
  const [businessType, setBusinessType] = useState<string>("custom");
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    router.push("/login");
  };

  useEffect(() => {
    const loadTenantRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          return;
        }

        const res = await fetch("/api/tenant-role", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await res.json();
        if (!res.ok) {
          console.error("Tenant role load error:", result.error);
          if (result.error?.includes("tenant schema")) {
            setSetupError(
              "Tenant schema is not installed. Run the Supabase tenant migration before using sub-users."
            );
          }
          return;
        }

        setTenantRole(result.data?.role ?? "");
      } catch (err) {
        console.error(err);
      }
    };

    if (!loading && user) {
      loadTenantRole();
    }
  }, [loading, user]);

  useEffect(() => {
    const loadSubUsers = async () => {
      if (tenantRole !== "owner") return;

      setSubUserLoading(true);
      setSubUserMessage("");

      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("Authentication required");

        const res = await fetch("/api/subusers", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Failed to load sub-users");
        }

        setSubUsers(result.data || []);
      } catch (err) {
        console.error(err);
        setSubUserMessage(err instanceof Error ? err.message : "Unable to load sub-users");
      } finally {
        setSubUserLoading(false);
      }
    };

    loadSubUsers();
  }, [tenantRole]);

  const createSubUser = async () => {
    if (!newSubUserEmail || !newSubUserPassword) {
      setSubUserMessage("Email and password are required.");
      return;
    }

    setSubUserLoading(true);
    setSubUserMessage("");

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Authentication required");

      const res = await fetch("/api/subusers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newSubUserEmail,
          password: newSubUserPassword,
          role: newSubUserRole,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create sub-user");
      }

      setNewSubUserEmail("");
      setNewSubUserPassword("");
      setNewSubUserRole("sales");
      setSubUserMessage("Sub-user created successfully.");
      setSubUsers((current) => [...current, result.data]);
    } catch (err) {
      console.error(err);
      setSubUserMessage(err instanceof Error ? err.message : "Failed to create sub-user");
    } finally {
      setSubUserLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-950"}`}>
      <Sidebar dark={dark} setDark={setDark} />
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-gray-400 mt-2">Manage your team, sub-users, and account settings.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/settings/mfa"
              className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-5 text-left text-sm text-slate-100 transition hover:border-cyan-500 hover:bg-slate-800"
            >
              <h3 className="font-semibold text-white">Security</h3>
              <p className="mt-2 text-slate-300">Manage multi-factor authentication settings for your account.</p>
            </Link>
            <Link
              href="/settings/gdpr"
              className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-5 text-left text-sm text-slate-100 transition hover:border-cyan-500 hover:bg-slate-800"
            >
              <h3 className="font-semibold text-white">Privacy</h3>
              <p className="mt-2 text-slate-300">Request data exports and account deletion workflows for GDPR compliance.</p>
            </Link>
            <Link
              href="/settings/sessions"
              className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-5 text-left text-sm text-slate-100 transition hover:border-cyan-500 hover:bg-slate-800"
            >
              <h3 className="font-semibold text-white">Sessions</h3>
              <p className="mt-2 text-slate-300">Review and revoke active sessions across devices.</p>
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              { id: "owner", label: "Owner Settings" },
              { id: "business", label: "Business Type" },
              { id: "standardfields", label: "Standard Fields" },
              { id: "customfields", label: "Custom Fields" },
              { id: "system", label: "System Controls" },
              { id: "subuser", label: "Create Sub-user" },
            ].map((tab) => {
              const selected = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id as "owner" | "system" | "subuser" | "business" | "customfields" | "standardfields")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selected ? "bg-cyan-500 text-slate-950" : "border border-white/10 bg-slate-900/80 text-slate-100 hover:bg-slate-800"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {setupError && (
          <section className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
            <h2 className="text-2xl font-semibold text-red-100">Setup Required</h2>
            <p className="mt-2 text-sm text-red-200">{setupError}</p>
            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-100">
              <p>Run this SQL in Supabase SQL editor:</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950/80 p-3 text-xs text-slate-100">
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'accountant', 'sales')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
              </pre>
              <p className="mt-3 text-red-100/80">Then refresh this page.</p>
            </div>
          </section>
        )}

        <div className="mt-6 space-y-6">
          {activeSection === "owner" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">Owner Settings</h2>
              <p className="text-sm text-gray-400">Your account and tenant-level controls.</p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="text-lg font-medium">{user?.email || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Tenant Role</p>
                  <p className="text-lg font-medium">{tenantRole || "Member"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Joined</p>
                  <p className="text-lg font-medium">{user?.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-8 w-full rounded-xl bg-red-600 px-4 py-3 text-white"
              >
                Logout
              </button>
            </section>
          )}

          {activeSection === "system" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">System Controls</h2>
              <p className="text-sm text-gray-400">Quick links for inventory and sales configuration.</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm text-gray-400">Inventory sharing</p>
                  <p className="mt-1 text-sm text-white/80">Sub-user roles control who can sell and view inventory.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm text-gray-400">Sales activity</p>
                  <p className="mt-1 text-sm text-white/80">Use the reports page to review daily activity and revenue.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm text-gray-400">Team permissions</p>
                  <p className="mt-1 text-sm text-white/80">Owners can create accountant and sales accounts from below.</p>
                </div>
              </div>
            </section>
          )}

          {activeSection === "subuser" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">Create a Sub-user</h2>
              <p className="text-sm text-gray-400">Use this form to add a new sales or accountant team member.</p>

              {tenantRole !== "owner" ? (
                <div className="mt-6 rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can create sub-users. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <input
                      value={newSubUserEmail}
                      onChange={(e) => setNewSubUserEmail(e.target.value)}
                      placeholder="Sub-user email"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    />
                    <input
                      type="password"
                      value={newSubUserPassword}
                      onChange={(e) => setNewSubUserPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    />
                    <select
                      value={newSubUserRole}
                      onChange={(e) => setNewSubUserRole(e.target.value as "accountant" | "sales")}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    >
                      <option value="sales">Sales</option>
                      <option value="accountant">Accountant</option>
                    </select>
                  </div>

                  <button
                    onClick={createSubUser}
                    disabled={subUserLoading}
                    className="mt-4 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                  >
                    {subUserLoading ? "Creating..." : "Create Sub-user"}
                  </button>

                  {subUserMessage && (
                    <p className="mt-4 text-sm text-white/80">{subUserMessage}</p>
                  )}

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold">Team members</h3>
                    {subUserLoading && !subUsers.length ? (
                      <p className="mt-3 text-sm text-gray-400">Loading sub-users...</p>
                    ) : subUsers.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-400">No sub-users found.</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {subUsers.map((member) => (
                          <div key={member.user_id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-400">Email</p>
                                <p className="font-medium">{member.user_email}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-400">Role</p>
                                <p className="font-medium capitalize">{member.role}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-gray-500">Added: {new Date(member.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {activeSection === "business" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <BusinessSettingsForm onBusinessTypeChange={setBusinessType} />
            </section>
          )}

          {activeSection === "standardfields" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              {tenantRole !== "owner" ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can manage standard fields. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : (
                <StandardFieldManager businessType={businessType} />
              )}
            </section>
          )}

          {activeSection === "customfields" && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              {tenantRole !== "owner" ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can manage custom fields. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : (
                <CustomFieldsManager businessType={businessType} />
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

