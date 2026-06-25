"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useRequireAuth, logout } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";
import { useSubscription } from "@/hooks/useSubscription";
import { apiGet, apiPost } from "@/lib/apiClient";
import { BusinessSettings } from "@/types";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { dark } = useTheme();
  const [tenantRole, setTenantRole] = useState<string>("");
  const [subUsers, setSubUsers] = useState<Array<{ user_id: string; user_email: string; role: string; active: boolean; created_at: string }>>([]);
  const [newSubUserIdentifier, setNewSubUserIdentifier] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"accountant" | "sales">("sales");
  const [subUserMessage, setSubUserMessage] = useState<string>("");
  const [subUserLoading, setSubUserLoading] = useState(false);
  const [businessType, setBusinessType] = useState<string>("custom");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessContactName, setBusinessContactName] = useState("");
  const [businessContactPhone, setBusinessContactPhone] = useState("");
  const [businessContactEmail, setBusinessContactEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessMessage, setBusinessMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { isActive: subscriptionActive, loading: subscriptionLoading } = useSubscription();
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
        const result = await apiGet<{ role: string }>('/api/tenant-role');
        setTenantRole(result.data?.role ?? '');
      } catch (error) {
        console.error('Tenant role fetch error:', error instanceof Error ? error.message : error);
      }
    };

    if (!loading && user) {
      loadTenantRole();
    }
  }, [loading, user]);

  useEffect(() => {
    const loadBusinessSettings = async () => {
      if (subscriptionLoading) return;
      if (!subscriptionActive) {
        setBusinessLoading(false);
        return;
      }

      setBusinessLoading(true);
      try {
        const result = await apiGet<BusinessSettings>("/api/business-settings");
        const settings = result.data || {
          business_type: "custom",
          business_name: undefined,
          business_address: undefined,
          business_contact_name: undefined,
          business_contact_phone: undefined,
          business_contact_email: undefined,
          business_website: undefined,
        };

        setBusinessType(settings.business_type ?? "custom");
        setBusinessName(settings.business_name ?? "");
        setBusinessAddress(settings.business_address ?? "");
        setBusinessContactName(settings.business_contact_name ?? "");
        setBusinessContactPhone(settings.business_contact_phone ?? "");
        setBusinessContactEmail(settings.business_contact_email ?? "");
        setBusinessWebsite(settings.business_website ?? "");
      } catch (error) {
        console.error("Business settings fetch error:", error instanceof Error ? error.message : error);
      } finally {
        setBusinessLoading(false);
      }
    };

    if (!loading && user) {
      loadBusinessSettings();
    }
  }, [loading, user]);

  const handleSaveBusinessInfo = async () => {
    setBusinessMessage("");
    setBusinessSaving(true);

    if (!subscriptionActive) {
      setBusinessMessage("Active subscription required to save business information.");
      setBusinessSaving(false);
      return;
    }

    try {
      await apiPost<BusinessSettings>("/api/business-settings", {
        business_type: businessType || "custom",
        business_name: businessName || undefined,
        business_address: businessAddress || undefined,
        business_contact_name: businessContactName || undefined,
        business_contact_phone: businessContactPhone || undefined,
        business_contact_email: businessContactEmail || undefined,
        business_website: businessWebsite || undefined,
      });

      setBusinessMessage("Business information saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save business information.";
      setBusinessMessage(message);
      console.error("Business settings save error:", message);
    } finally {
      setBusinessSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("All password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordMessage("New password must be different from current password.");
      return;
    }

    setPasswordLoading(true);
    try {
      // First verify current password by attempting to sign in
      if (!user?.email) {
        setPasswordMessage("Unable to verify your identity.");
        setPasswordLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordMessage("Current password is incorrect.");
        setPasswordLoading(false);
        return;
      }

      // If verification successful, update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordMessage(updateError.message);
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMessage("Password updated successfully.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password.";
      setPasswordMessage(message);
      console.error("Password update error:", message);
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    const loadSubUsers = async () => {
      if (tenantRole !== "owner") return;
      if (subscriptionLoading) return;
      if (!subscriptionActive) {
        setSubUsers([]);
        setSubUserMessage("Subscription required to manage sub-users. Request one from Settings.");
        setSubUserLoading(false);
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

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-950"}`}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold">User Profile</h1>
            <p className="text-theme-secondary mt-2">View your account details and sign out.</p>
          </div>
        </div>

        <div className="max-w-xl rounded-2xl border border-theme bg-theme-card p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-theme-secondary">Email</p>
              <p className="text-lg font-medium">{user?.email || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-theme-secondary">User ID</p>
              <p className="text-sm break-all">{user?.id || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-theme-secondary">Role</p>
              <p className="text-lg font-medium">{tenantRole || user?.app_metadata?.provider || "User"}</p>
            </div>
            <div>
              <p className="text-sm text-theme-secondary">Created</p>
              <p className="text-lg font-medium">{user?.created_at ? new Date(user.created_at).toLocaleString() : "N/A"}</p>
            </div>
          </div>

          <div className="mt-8 text-sm text-theme-secondary">Use the Logout button in the sidebar to sign out.</div>
        </div>

          <div className="mt-10 rounded-2xl border border-theme bg-theme-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Change Password</h2>
              <p className="text-sm text-theme-secondary mt-1">Update your account password securely from your profile.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Change Password
            </button>
          </div>
          {!showPasswordModal && passwordMessage && (
            <p className="mt-4 text-sm text-theme-secondary">{passwordMessage}</p>
          )}
        </div>

        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-theme bg-theme-card p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Change Password</h2>
                  <p className="text-sm text-theme-secondary mt-1">Enter your current password and choose a secure new password.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMessage("");
                  }}
                  className="text-sm font-semibold text-theme-secondary hover:text-theme-primary"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <div>
                  <label className="block text-sm text-theme-secondary mb-2">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-theme-secondary mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-theme-secondary mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMessage("");
                  }}
                  className="rounded-2xl border border-theme px-4 py-3 text-sm font-semibold text-theme-primary hover:bg-theme-input"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={passwordLoading}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>

              {passwordMessage && (
                <p className="mt-4 text-sm text-theme-secondary">{passwordMessage}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-theme bg-theme-card p-6">
          <h2 className="text-2xl font-semibold">Business Information</h2>
          <p className="text-sm text-theme-secondary mt-1">Register or update your business name, address, and contact details.</p>

          {businessLoading ? (
            <p className="mt-6 text-sm text-theme-secondary">Loading business info...</p>
          ) : (
            <div className="mt-6 grid gap-4">
              <div>
                <label className="block text-sm text-theme-secondary mb-2">Business Name</label>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business name"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-secondary mb-2">Business Address</label>
                <input
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Address"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-secondary mb-2">Contact Name</label>
                <input
                  value={businessContactName}
                  onChange={(e) => setBusinessContactName(e.target.value)}
                  placeholder="Contact person"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-secondary mb-2">Contact Phone</label>
                <input
                  value={businessContactPhone}
                  onChange={(e) => setBusinessContactPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-secondary mb-2">Contact Email</label>
                <input
                  value={businessContactEmail}
                  onChange={(e) => setBusinessContactEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-secondary mb-2">
                  Website <span className="text-xs text-theme-secondary">(optional)</span>
                </label>
                <input
                  value={businessWebsite}
                  onChange={(e) => setBusinessWebsite(e.target.value)}
                  placeholder="Website (optional)"
                  className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSaveBusinessInfo}
            disabled={businessLoading || businessSaving}
            className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
          >
            {businessSaving ? "Saving..." : "Save Business Info"}
          </button>

          {subscriptionLoading ? (
            <p className="mt-4 text-sm text-theme-secondary">Checking subscription status...</p>
          ) : !subscriptionActive ? (
            <div className="mt-4 rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-yellow-100">
              <p className="font-semibold">Active subscription required</p>
              <p className="mt-2 text-sm text-yellow-100/80">
                Your tenant must have an active subscription to update business information. Request one from <Link href="/settings" className="font-semibold text-cyan-100 underline">Settings → Subscription</Link>.
              </p>
            </div>
          ) : null}

          {businessMessage && (
            <p className="mt-4 text-sm text-theme-secondary">{businessMessage}</p>
          )}
          {tenantRole !== "owner" && (
            <p className="mt-3 text-sm text-yellow-100/80">Only the tenant owner can update business information.</p>
          )}
        </div>
      </main>
    </div>
  );
}
