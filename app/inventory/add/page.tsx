"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Sidebar from "@/components/Sidebar";
import AddProductForm from "../components/AddProductForm";
import BulkUploadProducts from "@/components/BulkUploadProducts";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useTheme } from "@/lib/theme-context";
import { getVisibleSystemFieldNames } from "@/lib/customFields";

type Product = {
  id?: string;
  name: string;
  category: string;
  cost_price: number;
  price: number;
  stock: number;
  custom_data?: Record<string, any>;
};

export default function AddPage() {
  const { loading } = useRequireAuth();
  const { dark } = useTheme();

  const router = useRouter();

  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [name, setName] = useState("");
  const [category, setCategory] =
    useState("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [customData, setCustomData] = useState<Record<string, any>>({});

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const customFieldsQuery = useCustomFields();
  const customFields = customFieldsQuery.data || [];
  const visibleStandardFieldNames = getVisibleSystemFieldNames(customFields);

  // ================= LOAD CATEGORIES =================
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);

      try {
        const response = await apiGet<string[]>("/api/categories");
        setCategories(response.data || []);
      } catch (err) {
        setMessage(
          err instanceof Error
            ? `❌ ${err.message}`
            : "❌ Failed to load categories"
        );
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    if (!loading) {
      fetchCategories();
    }
  }, [loading]);

  // ================= DEFAULT CATEGORY =================
  useEffect(() => {
    if (
      !category &&
      categories.length > 0
    ) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  // ================= ADD PRODUCT =================
  const addProduct = async (
    product: Omit<Product, "id">
  ) => {
    try {
      await apiPost<void>("/api/products", product);
      return true;
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Network error"
      );
      return false;
    }
  };

  // ================= HANDLE SUBMIT =================
  const addProductHandler =
    async () => {
      if (isSubmitting) return;

      const costPriceVisible = visibleStandardFieldNames.includes("cost_price");
      const priceVisible = visibleStandardFieldNames.includes("price");
      const stockVisible = visibleStandardFieldNames.includes("stock");

      const parsedCostPrice = costPrice === "" ? 0 : costPrice;
      const parsedPrice = price === "" ? 0 : price;
      const parsedStock = stock === "" ? 0 : stock;

      if (!name.trim() || !category.trim() || (costPriceVisible && parsedCostPrice < 0) || (priceVisible && parsedPrice <= 0) || (stockVisible && parsedStock < 0)) {
        setMessage("⚠️ Fill all fields correctly");
        return;
      }

      setIsSubmitting(true);

      setMessage("");

      const success =
        await addProduct({
          name: name.trim(),
          category,
          cost_price: Number(costPrice),
          price: Number(price),
          stock: Number(stock),
          custom_data: customData,
        });

      if (success) {
        setMessage(
          "✅ Product added successfully"
        );

        setName("");
        setPrice("");
        setStock("");
        setCostPrice("");
        setCustomData({});

        if (categories.length > 0) {
          setCategory(categories[0]);
        }
      }

      setIsSubmitting(false);
    };

  // ================= THEME =================
  const theme = dark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-100 text-slate-950";

  // ================= AUTH LOADING =================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />

          <p>
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen items-start flex-col lg:flex-row ${theme}`}
    >
      <Sidebar />

      <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4">
          <Link
            href="/inventory"
            className="inline-flex w-fit items-center rounded-full bg-slate-900 px-4 py-2 text-sm text-cyan-400 hover:bg-slate-800 transition"
          >
            ← Back to Inventory
          </Link>

          <div>
            <h1 className="text-3xl font-bold">
              Add Product
            </h1>

            <p className="text-theme-secondary mt-2">
              Create new products
            </p>
          </div>
        </div>

        {/* MESSAGE */}
        {message && (
          <div
            className={`mb-4 rounded-2xl border p-4 text-center ${
              message.startsWith("✅")
                ? "bg-green-500/10 border-green-500/20 text-green-100"
                : message.startsWith("⚠️")
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-100"
                : "bg-red-500/10 border-red-500/20 text-red-100"
            }`}
          >
            {message}
          </div>
        )}

        {/* FORM */}
        <AddProductForm
          name={name}
          setName={setName}
          category={category}
          setCategory={setCategory}
          costPrice={costPrice}
          setCostPrice={setCostPrice}
          price={price}
          setPrice={setPrice}
          stock={stock}
          setStock={setStock}
          categories={categories}
          loadingCategories={
            loadingCategories
          }
          customFields={customFields}
          customData={customData}
          setCustomData={setCustomData}
          addProductHandler={
            addProductHandler
          }
        />

        {/* LOADING */}
        {isSubmitting && (
          <div className="mt-4 flex items-center justify-center gap-2 text-theme-secondary">
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />

            <p>Adding product...</p>
          </div>
        )}

        {/* DIVIDER */}
        <div className="my-12">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-theme/20" />
            <span className="text-theme-secondary text-sm font-semibold">OR</span>
            <div className="flex-1 h-px bg-theme/20" />
          </div>
        </div>

        {/* BULK UPLOAD SECTION */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Bulk Upload Products
          </h2>
          <p className="text-theme-secondary mb-4">
            Upload multiple products at once using JSON or CSV files
          </p>
          <BulkUploadProducts />
        </div>
      </div>
    </div>
  );
}