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

    try {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*");
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("*");
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("*");

      const fetchError =
        productsError?.message || salesError?.message || categoriesError?.message || null;

      setProducts(products || []);
      setSales(sales || []);
      setCategories(categories?.map((c) => c.name) || []);
      setLoading({ isLoading: false, error: fetchError });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error fetching data";
      setProducts([]);
      setSales([]);
      setCategories([]);
      setLoading({ isLoading: false, error: message });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ================= ADD PRODUCT =================
  const addProduct = useCallback(async (product: Omit<Product, "id">): Promise<boolean> => {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (authError || !user) {
      setLoading({ isLoading: false, error: "Authentication required" });
      return false;
    }

    const { error } = await supabase.from("products").insert({
      ...product,
      user_id: user.id,
    });

    if (!error) {
      await fetchData();
      return true;
    }

    setLoading({ isLoading: false, error: error.message });
    return false;
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
    if (!product) {
      setLoading({ isLoading: false, error: "Product not found" });
      return false;
    }

    const { error } = await supabase
      .from("products")
      .update({ stock: product.stock + amount })
      .eq("id", id);

    if (!error) {
      await fetchData();
      return true;
    }

    setLoading({ isLoading: false, error: error.message });
    return false;
  }, [products, fetchData]);

  // ================= SELL =================
  const sellProduct = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setLoading({ isLoading: false, error: "Product not found" });
      return false;
    }

    if (quantity > product.stock) {
      setLoading({ isLoading: false, error: "Sale quantity exceeds available stock" });
      return false;
    }

    const { data: userData, error: authError } = await supabase.auth.getUser();
    const user = userData?.user;
    if (authError || !user) {
      setLoading({ isLoading: false, error: "Authentication required" });
      return false;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: product.stock - quantity })
      .eq("id", productId);

    if (updateError) {
      setLoading({ isLoading: false, error: updateError.message });
      return false;
    }

    const { error: saleError } = await supabase.from("sales").insert({
      product_id: productId,
      product_name: product.name,
      quantity,
      total: quantity * product.price,
      user_id: user.id,
    });

    if (saleError) {
      await supabase
        .from("products")
        .update({ stock: product.stock })
        .eq("id", productId);
      setLoading({ isLoading: false, error: saleError.message });
      return false;
    }

    await fetchData();
    return true;
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
    const { data: userData, error: authError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (authError || !user) {
      setLoading({ isLoading: false, error: "Authentication required" });
      return false;
    }

    const { error } = await supabase.from("categories").insert({
      name,
      user_id: user.id,
    });

    if (!error) {
      await fetchData();
      return true;
    }

    setLoading({ isLoading: false, error: error.message });
    return false;
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