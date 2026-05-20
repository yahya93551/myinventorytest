"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/lib/theme-context";

type Props = {
  children: ReactNode;
  initialPage?: string;
};

export default function DashboardShell({ children, initialPage }: Props) {
  const { dark } = useTheme();

  return (
    <div className={`flex min-h-screen ${dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-950"}`}>
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
} 
