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
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="page-container py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
 
