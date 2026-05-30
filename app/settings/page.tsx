"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/lib/theme-context";
import { useRequireAuth, logout } from "@/hooks/useRequireAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { BusinessSettingsForm } from "@/components/BusinessSettingsForm";
import { CustomFieldsManager } from "@/components/CustomFieldsManager";
import { StandardFieldManager } from "@/components/StandardFieldManager";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { AdminSubscriptionManager } from "@/components/AdminSubscriptionManager";
import { supabase } from "@/lib/supabase";
import { Shield, Lock, Monitor, User, Building2, ListChecks, Layers, PlusCircle, Settings2, ChevronRight, CreditCard } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { dark } = useTheme();
  const [tenantRole, setTenantRole] = useState<string>("");
  const [subUsers, setSubUsers] = useState<Array<{ user_id: string; user_email: string; role: string; active: boolean; created_at: string }>>([]);
  const [newSubUserEmail, setNewSubUserEmail] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"accountant" | "sales">("sales");
  const [subUserMessage, setSubUserMessage] = useState<string>("");
  const [setupError, setSetupError] = useState<string>("");
  const [subUserLoading, setSubUserLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"owner" | "system" | "subuser" | "business" | "customfields" | "standardfields" | "subscription">("owner");
  const [businessType, setBusinessType] = useState<string>("custom");
  const router = useRouter();
  const { isActive: subscriptionActive, loading: subscriptionLoading } = useSubscription();

  const quickActions = [
    {
      href: "/settings/mfa",
      title: "Security",
      description: "Manage multi-factor authentication settings for your account.",
      icon: Shield,
    },
    {
      href: "/settings/gdpr",
      title: "Privacy",
      description: "Request data exports and account deletion workflows for GDPR compliance.",
      icon: Lock,
    },
    {
      href: "/settings/sessions",
      title: "Sessions",
      description: "Review and revoke active sessions across devices.",
      icon: Monitor,
    },
  ];

  const settingTabs = [
    { id: "owner", label: "Owner Settings", icon: User },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "business", label: "Business Type", icon: Building2 },
    { id: "standardfields", label: "Standard Fields", icon: ListChecks },
    { id: "customfields", label: "Custom Fields", icon: Layers },
    { id: "system", label: "System Controls", icon: Settings2 },
    { id: "subuser", label: "Create Sub-user", icon: PlusCircle },
  ];

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

      // Don't attempt to load if subscription status is still resolving
      if (subscriptionLoading) return;

      // If subscription is inactive, show helpful message instead of attempting fetch
      if (!subscriptionActive) {
        setSubUsers([]);
        setSubUserMessage("Subscription required to manage sub-users.");
        return;
      }

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

        if (res.status === 403) {
          setSubUsers([]);
          setSubUserMessage("Subscription required to manage sub-users.");
          return;
        }

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
  }, [tenantRole, subscriptionActive, subscriptionLoading]);

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
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-theme-secondary mt-2 max-w-2xl">Manage your team, sub-users, and account settings with a responsive, device-friendly interface.</p>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group rounded-3xl border border-theme bg-theme-card p-5 text-left text-sm text-theme-primary transition hover:border-cyan-500"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-theme-input text-cyan-300 transition group-hover:bg-cyan-500 group-hover:text-slate-950">
                      <Icon size={22} />
                    </span>
                    <ChevronRight size={20} className="text-theme-muted transition group-hover:text-cyan-300" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-theme-primary">{action.title}</h3>
                  <p className="mt-2 text-sm text-theme-secondary">{action.description}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {settingTabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id as "owner" | "system" | "subuser" | "business" | "customfields" | "standardfields" | "subscription")}
                  className={`group flex items-center gap-3 rounded-3xl border px-4 py-4 text-left text-sm font-semibold transition ${selected ? "border-transparent bg-cyan-500 text-slate-950 shadow-[0_10px_30px_-18px_rgba(6,182,212,0.8)]" : "border-theme bg-theme-card text-theme-secondary hover:border-white/30 hover:bg-theme-surface"}`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl border ${selected ? "border-transparent bg-cyan-500 text-slate-950" : "border-white/10 bg-theme-input text-cyan-300"}`}>
                    <Icon size={18} />
                  </span>
                  <span>{tab.label}</span>
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
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              <h2 className="text-2xl font-semibold text-theme-primary">Owner Settings</h2>
              <p className="text-sm text-theme-secondary">Your account and tenant-level controls.</p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-theme-secondary">Email</p>
                  <p className="text-lg font-medium">{user?.email || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Tenant Role</p>
                  <p className="text-lg font-medium">{tenantRole || "Member"}</p>
                </div>
                <div>
                  <p className="text-sm text-theme-secondary">Joined</p>
                  <p className="text-lg font-medium">{user?.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}</p>
                </div>
              </div>

              <div className="mt-8 text-sm text-theme-secondary">Use the Logout button in the sidebar to sign out.</div>
            </section>
          )}

          {activeSection === "subscription" && (
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              <h2 className="text-2xl font-semibold text-theme-primary mb-4">Subscription Management</h2>
              {tenantRole === "admin" ? (
                <AdminSubscriptionManager />
              ) : (
                <SubscriptionStatus />
              )}
            </section>
          )}

          {activeSection === "system" && (
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              <h2 className="text-2xl font-semibold text-theme-primary">System Controls</h2>
              <p className="text-sm text-theme-secondary">Quick links for inventory and sales configuration.</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-theme bg-theme-input p-4">
                  <p className="text-sm text-theme-secondary">Inventory sharing</p>
                  <p className="mt-1 text-sm text-theme-muted">Sub-user roles control who can sell and view inventory.</p>
                </div>
                <div className="rounded-2xl border border-theme bg-theme-input p-4">
                  <p className="text-sm text-theme-secondary">Sales activity</p>
                  <p className="mt-1 text-sm text-theme-muted">Use the reports page to review daily activity and revenue.</p>
                </div>
                <div className="rounded-2xl border border-theme bg-theme-input p-4">
                  <p className="text-sm text-theme-secondary">Team permissions</p>
                  <p className="mt-1 text-sm text-theme-muted">Owners can create accountant and sales accounts from below.</p>
                </div>
              </div>
            </section>
          )}

          {activeSection === "subuser" && (
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              <h2 className="text-2xl font-semibold text-theme-primary">Create a Sub-user</h2>
              <p className="text-sm text-theme-secondary">Use this form to add a new sales or accountant team member.</p>

              {tenantRole !== "owner" ? (
                <div className="mt-6 rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can create sub-users. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : subscriptionLoading ? (
                <div className="mt-6 rounded-3xl border border-theme bg-theme-input p-6 text-theme-secondary">
                  <p>Checking subscription status...</p>
                </div>
              ) : !subscriptionActive ? (
                <div className="mt-6 rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Active subscription required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Your tenant needs an active subscription before you can create sub-users.</p>
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <input
                      value={newSubUserEmail}
                      onChange={(e) => setNewSubUserEmail(e.target.value)}
                      placeholder="Sub-user email"
                      className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    />
                    <input
                      type="password"
                      value={newSubUserPassword}
                      onChange={(e) => setNewSubUserPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                    />
                    <select
                      value={newSubUserRole}
                      onChange={(e) => setNewSubUserRole(e.target.value as "accountant" | "sales")}
                      className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
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
                    <p className="mt-4 text-sm text-theme-muted">{subUserMessage}</p>
                  )}

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold">Team members</h3>
                    {subUserLoading && !subUsers.length ? (
                      <p className="mt-3 text-sm text-theme-secondary">Loading sub-users...</p>
                    ) : subUsers.length === 0 ? (
                      <p className="mt-3 text-sm text-theme-secondary">No sub-users found.</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {subUsers.map((member) => (
                          <div key={member.user_id} className="rounded-2xl border border-theme bg-theme-card p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-theme-secondary">Email</p>
                                <p className="font-medium">{member.user_email}</p>
                              </div>
                              <div>
                                <p className="text-sm text-theme-secondary">Role</p>
                                <p className="font-medium capitalize">{member.role}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-theme-secondary">Added: {new Date(member.created_at).toLocaleString()}</p>
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
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              {tenantRole !== "owner" ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can manage business settings.</p>
                </div>
              ) : subscriptionLoading ? (
                <div className="rounded-3xl border border-theme bg-theme-input p-6 text-theme-secondary">
                  <p>Checking subscription status...</p>
                </div>
              ) : !subscriptionActive ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Active subscription required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Your tenant needs an active subscription to update business settings.</p>
                </div>
              ) : (
                <BusinessSettingsForm onBusinessTypeChange={setBusinessType} />
              )}
            </section>
          )}

          {activeSection === "standardfields" && (
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              {tenantRole !== "owner" ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can manage standard fields. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : subscriptionLoading ? (
                <div className="rounded-3xl border border-theme bg-theme-input p-6 text-theme-secondary">
                  <p>Checking subscription status...</p>
                </div>
              ) : !subscriptionActive ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Active subscription required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Your tenant needs an active subscription to manage standard fields.</p>
                </div>
              ) : (
                <StandardFieldManager businessType={businessType} />
              )}
            </section>
          )}

          {activeSection === "customfields" && (
            <section className="rounded-3xl border border-theme bg-theme-card p-6">
              {tenantRole !== "owner" ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Owner access required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Only the tenant owner can manage custom fields. Your current role is <span className="font-medium">{tenantRole || "Member"}</span>.</p>
                </div>
              ) : subscriptionLoading ? (
                <div className="rounded-3xl border border-theme bg-theme-input p-6 text-theme-secondary">
                  <p>Checking subscription status...</p>
                </div>
              ) : !subscriptionActive ? (
                <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-6 text-yellow-100">
                  <p className="font-semibold">Active subscription required</p>
                  <p className="mt-2 text-sm text-yellow-100/80">Your tenant needs an active subscription to manage custom fields.</p>
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

