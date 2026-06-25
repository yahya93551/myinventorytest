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
import { Shield, Lock, Monitor, User, Building2, ListChecks, Layers, PlusCircle, Settings2, ChevronRight, CreditCard, Users, CheckCircle, AlertCircle, Zap, Package } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { dark } = useTheme();
  const [tenantRole, setTenantRole] = useState<string>("");
  const [subUsers, setSubUsers] = useState<Array<{ user_id: string; user_email: string; role: string; active: boolean; created_at: string }>>([]);
  const [newSubUserIdentifier, setNewSubUserIdentifier] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"accountant" | "sales">("sales");
  const [subUserMessage, setSubUserMessage] = useState<string>("");
  const [setupError, setSetupError] = useState<string>("");
  const [subUserLoading, setSubUserLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"owner" | "system" | "subuser" | "business" | "customfields" | "standardfields" | "subscription">("owner");
  const [businessType, setBusinessType] = useState<string>("custom");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
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
    if (!newSubUserIdentifier || !newSubUserPassword) {
      setSubUserMessage("Email or phone and password are required.");
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
          identifier: newSubUserIdentifier,
          password: newSubUserPassword,
          role: newSubUserRole,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create sub-user");
      }

      setNewSubUserIdentifier("");
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

  // Calculate team members count
  const teamMembersCount = subUsers.length;

  // Get subscription status display
  const subscriptionStatusDisplay = subscriptionActive ? "Active" : "Inactive";

  // Get avatar initials from email
  const getUserInitials = (email?: string) => {
    if (!email) return "?";
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "theme-dark" : "theme-light"}`}>
      <Sidebar />
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="border-b border-theme bg-theme-surface/80 backdrop-blur-sm">
          <div className="p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-4xl font-bold text-theme-primary">Settings</h1>
              <p className="text-theme-secondary mt-2 max-w-2xl text-base">Manage your team, subscription, and account preferences. All changes are saved automatically.</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Overview Stats Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* Subscription Status Card */}
              <div className="card-standard">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-theme-secondary font-medium">Subscription</p>
                    <p className="text-2xl font-bold text-theme-primary mt-2">{subscriptionStatusDisplay}</p>
                    <p className="text-xs text-theme-muted mt-2">{subscriptionActive ? "Your plan is active" : "No active plan"}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${subscriptionActive ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                    {subscriptionActive ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                  </div>
                </div>
              </div>

              {/* Team Members Card */}
              <div className="card-standard">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-theme-secondary font-medium">Team Members</p>
                    <p className="text-2xl font-bold text-theme-primary mt-2">{teamMembersCount}</p>
                    <p className="text-xs text-theme-muted mt-2">{teamMembersCount === 1 ? "1 member" : `${teamMembersCount} members`}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400">
                    <Users size={24} />
                  </div>
                </div>
              </div>

              {/* Current Role Card */}
              <div className="card-standard">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-theme-secondary font-medium">Your Role</p>
                    <p className="text-2xl font-bold text-theme-primary mt-2 capitalize">{tenantRole || "Member"}</p>
                    <p className="text-xs text-theme-muted mt-2">Account access level</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/15 text-purple-400">
                    <User size={24} />
                  </div>
                </div>
              </div>

              {/* Business Type Card */}
              <div className="card-standard">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-theme-secondary font-medium">Business Type</p>
                    <p className="text-2xl font-bold text-theme-primary mt-2 capitalize">{businessType}</p>
                    <p className="text-xs text-theme-muted mt-2">Configured settings</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400">
                    <Building2 size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-theme-primary">Quick Actions</h2>
                  <p className="text-sm text-theme-secondary"></p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((open) => !open)}
                  className="btn-secondary btn-sm"
                >
                  {quickActionsOpen ? "Hide Quick Actions" : "Show Quick Actions"}
                </button>
              </div>
              {quickActionsOpen ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.title}
                        href={action.href}
                        className="group card-interactive block p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-3 rounded-xl bg-theme-input text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all duration-200">
                            <Icon size={24} />
                          </div>
                          <ChevronRight size={20} className="text-theme-muted group-hover:text-cyan-400 transition-all duration-200" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-theme-primary">{action.title}</h3>
                          <p className="text-sm text-theme-secondary">{action.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Settings Navigation - Horizontal Sticky Tab Bar */}
            <div className="sticky top-20 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-6 pb-4 -mt-2 bg-linear-to-b from-theme-surface via-theme-surface to-transparent border-b border-theme/50">
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-min pb-2">
                  {settingTabs.map((tab) => {
                    const Icon = tab.icon;
                    const selected = activeSection === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSection(tab.id as "owner" | "system" | "subuser" | "business" | "customfields" | "standardfields" | "subscription")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                          selected
                            ? "bg-cyan-500 text-slate-950 shadow-[0_4px_12px_rgba(6,182,212,0.3)]"
                            : "text-theme-secondary hover:text-theme-primary hover:bg-theme-input"
                        }`}
                      >
                        <Icon size={16} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Setup Error Banner */}
            {setupError && (
              <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                <div className="flex gap-4">
                  <div className="p-2 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-100">Setup Required</h3>
                    <p className="mt-1 text-sm text-red-200">{setupError}</p>
                    <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
                      <p className="text-xs text-red-100 font-mono">Run this SQL in Supabase SQL editor:</p>
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950/80 p-3 text-xs text-slate-100">
{`CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
);`}
                      </pre>
                      <p className="mt-3 text-xs text-red-100">Then refresh this page.</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Content Sections */}
            <div className="space-y-8">
              {/* Owner Settings */}
              {activeSection === "owner" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Owner Settings</h2>
                    <p className="text-theme-secondary mt-1">Your account and tenant-level information.</p>
                  </div>

                  {/* Profile Card */}
                  <div className="card-standard max-w-2xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      {/* Avatar */}
                      <div className="shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                          {getUserInitials(user?.email)}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-xs text-theme-muted font-medium uppercase tracking-wide">Email Address</p>
                          <p className="text-lg font-medium text-theme-primary mt-1">{user?.email || "Unknown"}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                          <div>
                            <p className="text-xs text-theme-muted font-medium uppercase tracking-wide">Tenant Role</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-cyan-500/15 text-cyan-300">
                                {tenantRole ? tenantRole.charAt(0).toUpperCase() + tenantRole.slice(1) : "Member"}
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-theme-muted font-medium uppercase tracking-wide">Member Since</p>
                            <p className="text-base font-medium text-theme-primary mt-1">
                              {user?.created_at
                                ? new Date(user.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-theme">
                      <p className="text-sm text-theme-muted">
                        To sign out, use the <span className="font-semibold text-theme-primary">Logout</span> button in the sidebar.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Subscription Management */}
              {activeSection === "subscription" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Subscription Management</h2>
                    <p className="text-theme-secondary mt-1">View and manage your subscription details.</p>
                  </div>

                  <div className="card-standard">
                    {tenantRole === "admin" ? <AdminSubscriptionManager /> : <SubscriptionStatus />}
                  </div>
                </section>
              )}

              {/* System Controls */}
              {activeSection === "system" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">System Controls</h2>
                    <p className="text-theme-secondary mt-1">Quick overview of your inventory and sales configuration.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Inventory Sharing Card */}
                    <div className="card-standard">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
                          <Package size={20} />
                        </div>
                        <h3 className="text-base font-semibold text-theme-primary">Inventory Sharing</h3>
                      </div>
                      <p className="text-sm text-theme-secondary">Sub-user roles control who can sell and view your inventory.</p>
                    </div>

                    {/* Sales Activity Card */}
                    <div className="card-standard">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-green-500/15 text-green-400 shrink-0">
                          <Zap size={20} />
                        </div>
                        <h3 className="text-base font-semibold text-theme-primary">Sales Activity</h3>
                      </div>
                      <p className="text-sm text-theme-secondary">Review daily activity and revenue on the reports page.</p>
                    </div>

                    {/* Team Permissions Card */}
                    <div className="card-standard">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/15 text-purple-400 shrink-0">
                          <Users size={20} />
                        </div>
                        <h3 className="text-base font-semibold text-theme-primary">Team Permissions</h3>
                      </div>
                      <p className="text-sm text-theme-secondary">Owners can create accountant and sales accounts below.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Sub-user Management */}
              {activeSection === "subuser" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Team Management</h2>
                    <p className="text-theme-secondary mt-1">Create and manage sub-users with different roles and permissions.</p>
                  </div>

                  {tenantRole !== "owner" ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Owner Access Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">
                            Only the tenant owner can create sub-users. Your current role is{" "}
                            <span className="font-medium">{tenantRole || "Member"}</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : subscriptionLoading ? (
                    <div className="card-standard">
                      <div className="flex gap-3 items-center">
                        <div className="animate-spin h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                        <p className="text-theme-secondary">Checking subscription status...</p>
                      </div>
                    </div>
                  ) : !subscriptionActive ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Active Subscription Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">Your tenant needs an active subscription before you can create sub-users.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Create Sub-user Form */}
                      <div className="card-standard">
                        <h3 className="text-lg font-semibold text-theme-primary mb-4">Create New Member</h3>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className="block text-sm font-medium text-theme-primary mb-2">Email or Phone</label>
                            <input
                              value={newSubUserIdentifier}
                              onChange={(e) => setNewSubUserIdentifier(e.target.value)}
                              placeholder="user@example.com or +1234567890"
                              className="input-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-theme-primary mb-2">Password</label>
                            <input
                              type="password"
                              value={newSubUserPassword}
                              onChange={(e) => setNewSubUserPassword(e.target.value)}
                              placeholder="Secure password"
                              className="input-base"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-theme-primary mb-2">Role</label>
                            <select
                              value={newSubUserRole}
                              onChange={(e) => setNewSubUserRole(e.target.value as "accountant" | "sales")}
                              className="select-base"
                            >
                              <option value="sales">Sales</option>
                              <option value="accountant">Accountant</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={createSubUser}
                          disabled={subUserLoading}
                          className="btn-primary mt-4"
                        >
                          {subUserLoading ? "Creating..." : "Create Member"}
                        </button>

                        {subUserMessage && (
                          <p className={`mt-4 text-sm ${subUserMessage.includes("successfully") ? "text-green-400" : "text-red-400"}`}>
                            {subUserMessage}
                          </p>
                        )}
                      </div>

                      {/* Team Members Table */}
                      <div>
                        <h3 className="text-lg font-semibold text-theme-primary mb-4">Team Members</h3>

                        {subUserLoading && !subUsers.length ? (
                          <div className="card-standard">
                            <p className="text-theme-secondary text-center py-8">Loading team members...</p>
                          </div>
                        ) : subUsers.length === 0 ? (
                          <div className="card-standard">
                            <p className="text-theme-secondary text-center py-8">No team members yet. Create one above to get started.</p>
                          </div>
                        ) : (
                          <div className="card-standard overflow-hidden">
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-theme text-sm">
                                    <th className="text-left py-4 px-6 font-semibold text-theme-secondary">Email</th>
                                    <th className="text-left py-4 px-6 font-semibold text-theme-secondary">Role</th>
                                    <th className="text-left py-4 px-6 font-semibold text-theme-secondary">Status</th>
                                    <th className="text-left py-4 px-6 font-semibold text-theme-secondary">Created</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-theme">
                                  {subUsers.map((member) => (
                                    <tr key={member.user_id} className="hover:bg-theme-input/50 transition-colors">
                                      <td className="py-4 px-6 text-theme-primary font-medium">{member.user_email}</td>
                                      <td className="py-4 px-6">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300">
                                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                        </span>
                                      </td>
                                      <td className="py-4 px-6">
                                        <span className="inline-flex items-center gap-2">
                                          <span className={`w-2 h-2 rounded-full ${member.active ? "bg-green-500" : "bg-red-500"}`}></span>
                                          <span className="text-theme-secondary text-sm">{member.active ? "Active" : "Inactive"}</span>
                                        </span>
                                      </td>
                                      <td className="py-4 px-6 text-theme-muted text-sm">
                                        {new Date(member.created_at).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                              {subUsers.map((member) => (
                                <div key={member.user_id} className="border border-theme rounded-lg p-4 hover:bg-theme-input/30 transition-colors">
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-theme-muted font-medium">Email</p>
                                      <p className="font-medium text-theme-primary truncate">{member.user_email}</p>
                                    </div>
                                    <span className={`shrink-0 w-3 h-3 rounded-full mt-1 ${member.active ? "bg-green-500" : "bg-red-500"}`}></span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm text-theme-muted font-medium">Role</p>
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 mt-1">
                                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-theme-muted font-medium">Created</p>
                                      <p className="text-sm text-theme-secondary">
                                        {new Date(member.created_at).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Business Settings */}
              {activeSection === "business" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Business Type</h2>
                    <p className="text-theme-secondary mt-1">Configure your business settings and preferences.</p>
                  </div>

                  {tenantRole !== "owner" ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Owner Access Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">Only the tenant owner can manage business settings.</p>
                        </div>
                      </div>
                    </div>
                  ) : subscriptionLoading ? (
                    <div className="card-standard">
                      <div className="flex gap-3 items-center">
                        <div className="animate-spin h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                        <p className="text-theme-secondary">Checking subscription status...</p>
                      </div>
                    </div>
                  ) : !subscriptionActive ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Active Subscription Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">Your tenant needs an active subscription to update business settings.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card-standard">
                      <BusinessSettingsForm onBusinessTypeChange={setBusinessType} />
                    </div>
                  )}
                </section>
              )}

              {/* Standard Fields */}
              {activeSection === "standardfields" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Standard Fields</h2>
                    <p className="text-theme-secondary mt-1">Manage and customize your standard inventory fields.</p>
                  </div>

                  {tenantRole !== "owner" ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Owner Access Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">
                            Only the tenant owner can manage standard fields. Your current role is{" "}
                            <span className="font-medium">{tenantRole || "Member"}</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : subscriptionLoading ? (
                    <div className="card-standard">
                      <div className="flex gap-3 items-center">
                        <div className="animate-spin h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                        <p className="text-theme-secondary">Checking subscription status...</p>
                      </div>
                    </div>
                  ) : !subscriptionActive ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Active Subscription Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">Your tenant needs an active subscription to manage standard fields.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card-standard">
                      <StandardFieldManager businessType={businessType} />
                    </div>
                  )}
                </section>
              )}

              {/* Custom Fields */}
              {activeSection === "customfields" && (
                <section>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-theme-primary">Custom Fields</h2>
                    <p className="text-theme-secondary mt-1">Create and manage custom fields for your inventory.</p>
                  </div>

                  {tenantRole !== "owner" ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Owner Access Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">
                            Only the tenant owner can manage custom fields. Your current role is{" "}
                            <span className="font-medium">{tenantRole || "Member"}</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : subscriptionLoading ? (
                    <div className="card-standard">
                      <div className="flex gap-3 items-center">
                        <div className="animate-spin h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                        <p className="text-theme-secondary">Checking subscription status...</p>
                      </div>
                    </div>
                  ) : !subscriptionActive ? (
                    <div className="card-standard border-yellow-500/30 bg-yellow-500/10">
                      <div className="flex gap-4">
                        <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400 shrink-0">
                          <AlertCircle size={20} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-100">Active Subscription Required</h3>
                          <p className="text-sm text-yellow-100/80 mt-1">Your tenant needs an active subscription to manage custom fields.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card-standard">
                      <CustomFieldsManager businessType={businessType} />
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

