"use client";

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Inventory from "./inventory/Inventory";
import Dashboard from "../components/Dashboard";
import Categories from "../components/Categories";
import SalesPage from "./sales/page";
import AddPage from "./inventory/add/page"; // ✅ ADD THIS

import { useInventory } from "../hooks/useInventory";

// auth
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Page() {
  const inventory = useInventory();

  // ✅ ALL PAGES CONTROLLED HERE
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(true);

  const router = useRouter();

  // ================= AUTH PROTECTION =================
  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login");
      }
    };

    checkUser();
  }, [router]);

  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}>

      {/* ================= SIDEBAR ================= */}
      <Sidebar
        page={page}
        setPage={setPage}
        dark={dark}
        setDark={setDark}
      />

      {/* ================= MAIN CONTENT ================= */}
      <div className="flex-1 p-4 sm:p-6">

        {/* DASHBOARD */}
        {page === "dashboard" && <Dashboard />}

        {/* INVENTORY */}
        {page === "inventory" && (
          <Inventory {...inventory} />
        )}

        {/* SALES */}
        {page === "sales" && (
          <SalesPage sales={inventory.sales} loading={inventory.loading} />
        )}

        {/* CATEGORIES */}
        {page === "categories" && (
          <Categories
            categories={inventory.categories}
            loading={inventory.loading.isLoading}
            error={inventory.loading.error}
            addCategory={inventory.addCategory}
          />
        )}

        {/* ✅ ADD PRODUCT (FIXED) */}
        {page === "add" && (
          <AddPage />
        )}
    
      </div>
    </div>
  );
}