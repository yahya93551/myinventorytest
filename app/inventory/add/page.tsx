//app/inventory/add/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AddProductForm from "../components/AddProductForm";
import { supabase } from "@/lib/supabase";

type Product = {
  id?: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

export default function AddPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(true);

  // ================= CATEGORIES =================
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);

      const { data, error } = await supabase.from("categories").select("name");
      if (error) {
        setMessage("Failed to load categories: " + error.message);
        setCategories([]);
      } else {
        setCategories(data?.map((c: any) => c.name) || []);
      }

      setLoadingCategories(false);
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories]);

  // ================= ADD PRODUCT =================
  const router = useRouter();

  const addProduct = async (product: Omit<Product, "id">) => {
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) {
        setMessage("❌ Session expired. Please log in again.");
        router.push("/login");
        return false;
      }

      const token = data.session.access_token;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(product),
      });

      const dataResponse = await res.json();
      if (!res.ok) {
        setMessage("❌ " + (dataResponse.error || "Failed to add product"));
        return false;
      }

      return true;
    } catch (error) {
      console.error(error);
      setMessage("❌ Network error");
      return false;
    }
  };

  const addProductHandler = async () => {
    if (loading) return;

    if (!name.trim() || price <= 0 || stock < 0) {
      setMessage("⚠️ Fill all fields correctly");
      return;
    }

    setLoading(true);
    setMessage("");

    const success = await addProduct({
      name: name.trim(),
      category,
      price,
      stock,
    });

    if (success) {
      setMessage("✅ Product added successfully");
      setName("");
      setPrice(0);
      setStock(0);
    }

    setLoading(false);
  };

  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  return (
    <div className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}>
      <Sidebar dark={dark} setDark={setDark} />
      <div className="flex-1 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/inventory"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm text-cyan-400 hover:bg-slate-800"
          >
            ← Back to Inventory
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Add Product</h1>
            <p className="text-gray-400 mt-2">
              Create new products
            </p>
          </div>
        </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-white/10 text-center">
          {message}
        </div>
      )}

      <AddProductForm
        name={name}
        setName={setName}
        category={category}
        setCategory={setCategory}
        price={price}
        setPrice={setPrice}
        stock={stock}
        setStock={setStock}
        categories={categories}
        loadingCategories={loadingCategories}
        addProductHandler={addProductHandler}
      />

      {loading && (
        <p className="mt-3 text-gray-400 text-center">
          Adding product...
        </p>
      )}
      </div>
    </div>
  );
}