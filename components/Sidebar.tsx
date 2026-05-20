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
  Settings,
  Menu,
  X,
  Plus,
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
    `w-full text-left px-3 py-3 rounded-2xl transition duration-200 flex items-center gap-3 ${
      active
        ? dark
          ? "bg-white/15 text-white shadow-[0_12px_40px_-20px_rgba(255,255,255,0.25)]"
          : "bg-slate-200 text-slate-950 shadow-sm"
        : dark
        ? "text-slate-300 hover:bg-white/10 hover:text-white"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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

      {/* SIDEBAR */}
      <div
        className={`
          fixed lg:static z-50 top-0 left-0 h-full max-h-screen
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

        {/* THEME */}
        <button
          onClick={() => setDark(!dark)}
          className="mt-6 w-full rounded-xl border border-theme bg-theme-card py-2 text-theme-secondary transition hover:bg-theme-surface flex items-center justify-center gap-2"
        >
          {dark ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
          {!collapsed && <span>Toggle Theme</span>}
        </button>

        <button
          onClick={handleLogout}
          className="mt-3 w-full bg-red-600 py-2 rounded-xl flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}