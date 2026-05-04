"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Product, Sale, Category, LoadingState } from "../types";

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: true,
    error: null,
  });

  const [sellItem, setSellItem] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState(1);

  // ================= FETCH =================
  const fetchData = useCallback(async () => {
    setLoading({ isLoading: true, error: null });

    const { data: products } = await supabase.from("products").select("*");
    const { data: sales } = await supabase.from("sales").select("*");
    const { data: categories } = await supabase.from("categories").select("*");

    setProducts(products || []);
    setSales(sales || []);
    setCategories(categories?.map((c) => c.name) || []);

    setLoading({ isLoading: false, error: null });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ================= ADD PRODUCT =================
  const addProduct = useCallback(async (product: Omit<Product, "id">): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from("products").insert({
      ...product,
      user_id: user?.id,
    });

    if (!error) await fetchData();
    return !error;
  }, [fetchData]);

  // ================= UPDATE =================
  const updateProduct = useCallback(async (id: string, updates: Partial<Product>): Promise<boolean> => {
    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id);

    if (!error) await fetchData();
    return !error;
  }, [fetchData]);

  // ================= DELETE =================
  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (!error) await fetchData();
    return !error;
  }, [fetchData]);

  // ================= RESTOCK =================
  const restockProduct = useCallback(async (id: string, amount: number): Promise<boolean> => {
    const product = products.find((p) => p.id === id);
    if (!product) return false;

    const { error } = await supabase
      .from("products")
      .update({ stock: product.stock + amount })
      .eq("id", id);

    if (!error) await fetchData();
    return !error;
  }, [products, fetchData]);

  // ================= SELL =================
  const sellProduct = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;
    if (quantity > product.stock) return false; // prevent negative stock

    const user = (await supabase.auth.getUser()).data.user;

    // Update stock
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: product.stock - quantity })
      .eq("id", productId);

    // Insert sale (without 'date' – Supabase auto-fills created_at)
    const { error: saleError } = await supabase.from("sales").insert({
      product_id: productId,
      product_name: product.name,
      quantity,
      total: quantity * product.price,
      user_id: user?.id,
    });

    if (!updateError && !saleError) {
      await fetchData();
      return true;
    }

    // If sale insertion failed, roll back stock update
    if (saleError) {
      await supabase
        .from("products")
        .update({ stock: product.stock })
        .eq("id", productId);
    }

    return false;
  }, [products, fetchData]);

  // ================= SELL FLOW =================
  const openSell = (product: Product) => {
    setSellItem(product);
    setSellQty(1);
  };

  const confirmSell = async (): Promise<boolean> => {
    if (!sellItem) return false;
    const success = await sellProduct(sellItem.id, sellQty);
    if (success) {
      setSellItem(null);
      setSellQty(1);
    }
    return success;
  };

  // ================= CATEGORY =================
  const addCategory = useCallback(async (name: Category): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from("categories").insert({
      name,
      user_id: user?.id,
    });

    if (!error) await fetchData();
    return !error;
  }, [fetchData]);

  const updateCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
  };

  // ================= HELPERS =================
  const getProductById = (id: string) =>
    products.find((p) => p.id === id);

  const getLowStockProducts = () =>
    products.filter((p) => p.stock > 0 && p.stock < 10);

  const getOutOfStockProducts = () =>
    products.filter((p) => p.stock === 0);

  return {
    products,
    categories,
    sales,
    loading,

    addProduct,
    updateProduct,
    deleteProduct,
    restockProduct,
    sellProduct,

    addCategory,
    updateCategories,

    getProductById,
    getLowStockProducts,
    getOutOfStockProducts,

    sellItem,
    sellQty,
    setSellQty,
    setSellItem,
    openSell,
    confirmSell,   // returns boolean
  };
}