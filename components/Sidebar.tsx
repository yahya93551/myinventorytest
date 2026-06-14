//components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/hooks/useRequireAuth";
import { useTheme } from "@/lib/theme-context";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  FileText,
  Moon,
  Sun,
  User,
  Building2,
  Book,
  Settings,
  Menu,
  X,
  Plus,
  History,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, setDark } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    router.push("/login");
  };

  const sidebarBaseClasses = dark
    ? "bg-slate-950/95 text-white border-white/10 shadow-lg"
    : "bg-white/95 text-slate-950 border-slate-200 shadow-sm";

  const navClass = (active: boolean) =>
    `w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium ${
      active
        ? dark
          ? "bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10"
          : "bg-cyan-500/15 text-cyan-700"
        : dark
        ? "text-slate-300 hover:bg-white/10 hover:text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className={`lg:hidden flex items-center justify-between p-4 border-b ${dark ? "border-white/10 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
        <button onClick={() => setOpen(true)}>
          <Menu />
        </button>
        <h1 className="font-bold">Inventory</h1>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* PLACEHOLDER FOR DESKTOP LAYOUT */}
      <div className={`hidden lg:block shrink-0 ${collapsed ? "w-16" : "w-64"}`} />

      {/* SIDEBAR */}
      <div
        className={`
          fixed z-50 top-0 left-0 h-full lg:h-screen max-h-screen shrink-0
          ${collapsed ? "w-16" : "w-64"}
          ${sidebarBaseClasses}
          backdrop-blur-xl
          flex flex-col p-4 transition-all duration-300 overflow-y-auto
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* CLOSE BUTTON */}
        <div className="mb-4 flex justify-between lg:justify-end">
          <button onClick={() => setOpen(false)} className="lg:hidden">
            <X />
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block"
          >
            {collapsed ? <Menu /> : <X />}
          </button>
        </div>

        {/* BRAND */}
        <div className="mb-8 flex items-center gap-3">
          <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold">My Inventory</h1>
              <p className="text-xs text-theme-secondary">ERP System</p>
            </div>
          )}
        </div>

        {/* NAV */}
        <div className="flex-1 flex flex-col gap-2">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/")}
          >
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Dashboard</span>}
          </Link>

          <Link
            href="/inventory"
            onClick={() => setOpen(false)}
            className={navClass(pathname?.startsWith("/inventory") === true)}
          >
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Inventory</span>}
          </Link>

          <Link
            href="/inventory/add"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/inventory/add")}
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Add Product</span>}
          </Link>

          <Link
            href="/categories"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/categories")}
          >
            <Tag className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Categories</span>}
          </Link>

          <Link
            href="/sales"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/sales")}
          >
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Sales</span>}
          </Link>

          <Link
            href="/reports"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/reports")}
          >
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Reports</span>}
          </Link>

          <Link
            href="/activity"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/activity")}
          >
            <History className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Activity Log</span>}
          </Link>

          <Link
            href="/debts"
            onClick={() => setOpen(false)}
            className={navClass(pathname?.startsWith("/debts") === true)}
          >
            <Book className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Debts</span>}
          </Link>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/settings")}
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className={navClass(pathname === "/profile")}
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
            {!collapsed && <span>Profile</span>}
          </Link>
        </div>

        {/* THEME TOGGLE & LOGOUT */}
        <div className="mt-6 pt-6 border-t border-theme space-y-2">
          <button
            onClick={() => setDark(!dark)}
            className="w-full btn-md btn-secondary flex items-center justify-center gap-2"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full btn-md btn-danger flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
}