"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useRequireAuth, logout } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { dark } = useTheme();
  const [tenantRole, setTenantRole] = useState<string>("");
  const [subUsers, setSubUsers] = useState<Array<{ user_id: string; user_email: string; role: string; active: boolean; created_at: string }>>([]);
  const [newSubUserEmail, setNewSubUserEmail] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"accountant" | "sales">("sales");
  const [subUserMessage, setSubUserMessage] = useState<string>("");
  const [subUserLoading, setSubUserLoading] = useState(false);
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
        const { data, error } = await supabase
          .from("tenant_members")
          .select("tenant_id, role")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Tenant role fetch error:", error.message);
          return;
        }

        const membership = Array.isArray(data) ? data[0] : data;
        if (membership?.role) {
          setTenantRole(membership.role);
          return;
        }

        if (user?.email) {
          const { data: emailData, error: emailError } = await supabase
            .from("tenant_members")
            .select("tenant_id, role")
            .eq("user_email", user.email)
            .order("created_at", { ascending: false })
            .limit(1);

          const emailMembership = Array.isArray(emailData) ? emailData[0] : emailData;
          if (!emailError && emailMembership?.role) {
            setTenantRole(emailMembership.role);
            return;
          }
        }

        if ((Array.isArray(data) ? data.length === 0 : !data) && user?.id && user.email) {
          const { data: created, error: createError } = await supabase
            .from("tenant_members")
            .insert({
              tenant_id: user.id,
              user_id: user.id,
              user_email: user.email,
              role: "owner",
              active: true,
              created_by: user.id,
            })
            .select("role")
            .maybeSingle();

          if (!createError && created?.role) {
            setTenantRole(created.role);
          }
        }
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

          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl bg-red-600 px-4 py-3 text-white"
          >
            Logout
          </button>
        </div>

        {tenantRole === "owner" && (
          <div className="mt-10 rounded-2xl border border-theme bg-theme-card p-6">
            <h2 className="text-2xl font-semibold">Manage Sub-users</h2>
            <p className="text-sm text-theme-secondary">Create accountants or sales users for this account.</p>

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
              <p className="mt-4 text-sm text-theme-secondary">{subUserMessage}</p>
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
          </div>
        )}
      </main>
    </div>
  );
}
