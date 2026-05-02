"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  FileText,
  Moon,
  Sun,
  Building2,
  Menu,
  X,
} from "lucide-react";

type Props = {
  page: string;
  setPage: (page: string) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
};

export default function Sidebar({
  page,
  setPage,
  dark,
  setDark,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const link = (name: string, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setPage(name)}
      className={`w-full text-left px-2 py-3 rounded-xl transition flex items-center justify-center gap-3 ${
        page === name
          ? "bg-white/20"
          : "hover:bg-white/10"
      }`}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );

  return (
    <div className={`${collapsed ? 'w-16' : 'w-full lg:w-64'} p-4 bg-slate-950/95 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300`}>
      
      {/* COLLAPSE TOGGLE */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-white/10 transition"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* BRAND */}
      <div className="mb-8 flex items-center gap-3">
        <Building2 size={24} className="text-cyan-400" />
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold">Luxury Inventory</h1>
            <p className="text-xs text-gray-400">ERP System</p>
          </div>
        )}
      </div>

      {/* NAV */}
      <div className="flex-1 flex flex-col gap-2">
        {link("dashboard", "Dashboard", <LayoutDashboard size={20} />)}
        {link("inventory", "Inventory", <Package size={20} />)}
        {link("categories", "Categories", <Tag size={20} />)}
        {link("sales", "Sales", <ShoppingCart size={20} />)}
        <Link
          href="/reports"
          className={`w-full text-left px-2 py-3 rounded-xl transition flex items-center justify-center gap-3 ${
            pathname === "/reports" ? "bg-white/20" : "hover:bg-white/10"
          }`}
          title={collapsed ? "Reports" : undefined}
        >
          <FileText size={20} />
          {!collapsed && <span>Reports</span>}
        </Link>
      </div>

      {/* THEME TOGGLE */}
      <button
        onClick={() => setDark(!dark)}
        className="mt-6 w-full bg-linear-to-r from-purple-500 to-indigo-500 py-2 rounded-xl flex items-center justify-center gap-2 px-2"
        title={collapsed ? (dark ? "Switch to Light Mode" : "Switch to Dark Mode") : undefined}
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
        {!collapsed && <span>Toggle Theme</span>}
      </button>
    </div>
  );
}