"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BulkSaleItem,
  Product,
  ProductForm,
  Sale,
  Category,
  LoadingState,
  ProductSchema,
  CategorySchema,
} from "../types";

const ProductFormSchema = ProductSchema.omit({ id: true, user_id: true });
const ProductUpdateSchema = ProductSchema.partial().omit({ id: true, user_id: true }).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided for update",
  }
);

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

  const formatZodError = (issues: { message: string }[]) =>
    issues.map((issue) => issue.message).join(", ");

  const authUser = useCallback(async () => {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (authError || !user) {
      setLoading({ isLoading: false, error: "Authentication required" });
      return null;
    }

    return user;
  }, []);

  const handleMutationError = useCallback(
    (error: string) => {
      setLoading({ isLoading: false, error });
      return false;
    },
    []
  );

  // ================= ADD PRODUCT =================
  const addProduct = useCallback(
    async (product: ProductForm): Promise<boolean> => {
      const parseResult = ProductFormSchema.safeParse(product);
      if (!parseResult.success) {
        return handleMutationError(formatZodError(parseResult.error.issues));
      }

      const user = await authUser();
      if (!user) return false;

      const { error } = await supabase.from("products").insert({
        ...product,
        user_id: user.id,
      });

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, fetchData, handleMutationError]
  );

  // ================= UPDATE =================
  const updateProduct = useCallback(
    async (id: string, updates: Partial<ProductForm>): Promise<boolean> => {
      if (Object.keys(updates).length === 0) {
        return handleMutationError("No changes provided");
      }

      const parseResult = ProductUpdateSchema.safeParse(updates);
      if (!parseResult.success) {
        return handleMutationError(formatZodError(parseResult.error.issues));
      }

      const user = await authUser();
      if (!user) return false;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("user_id")
        .eq("id", id)
        .single();

      if (productError || !product) {
        return handleMutationError("Product not found");
      }

      if (product.user_id !== user.id) {
        return handleMutationError("You can only edit products you own");
      }

      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id);

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, fetchData, handleMutationError]
  );

  // ================= DELETE =================
  const deleteProduct = useCallback(
    async (id: string): Promise<boolean> => {
      const user = await authUser();
      if (!user) return false;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("user_id")
        .eq("id", id)
        .single();

      if (productError || !product) {
        return handleMutationError("Product not found");
      }

      if (product.user_id !== user.id) {
        return handleMutationError("You can only delete products you own");
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, fetchData, handleMutationError]
  );

  // ================= RESTOCK =================
  const restockProduct = useCallback(
    async (id: string, amount: number): Promise<boolean> => {
      if (amount <= 0) {
        return handleMutationError("Restock amount must be greater than zero");
      }

      const product = products.find((p) => p.id === id);
      if (!product) {
        return handleMutationError("Product not found");
      }

      const user = await authUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("products")
        .update({ stock: product.stock + amount })
        .eq("id", id)
        .select();

      if (!error && data?.length) {
        await fetchData();
        return true;
      }

      return handleMutationError(error?.message || "Failed to update stock");
    },
    [products, authUser, fetchData, handleMutationError]
  );

  // ================= SELL =================
  const sellProduct = useCallback(
    async (productId: string, quantity: number): Promise<boolean> => {
      if (quantity <= 0) {
        return handleMutationError("Sale quantity must be at least 1");
      }

      const product = products.find((p) => p.id === productId);
      if (!product) {
        return handleMutationError("Product not found");
      }

      const user = await authUser();
      if (!user) return false;

      const { data: updatedProducts, error: updateError } = await supabase
        .from("products")
        .update({ stock: product.stock - quantity })
        .eq("id", productId)
        .gte("stock", quantity)
        .select();

      if (updateError) {
        return handleMutationError(updateError.message);
      }

      if (!updatedProducts?.length) {
        return handleMutationError("Insufficient stock for this sale");
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
        return handleMutationError(saleError.message);
      }

      await fetchData();
      return true;
    },
    [products, authUser, fetchData, handleMutationError]
  );

  const sellProducts = useCallback(
    async (items: BulkSaleItem[]): Promise<boolean> => {
      const normalizedItems = items.reduce((acc, item) => {
        const existing = acc.find((entry) => entry.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as BulkSaleItem[]);

      if (normalizedItems.length === 0) {
        return handleMutationError("No items selected for sale");
      }

      const user = await authUser();
      if (!user) return false;

      const rollbackStack: Array<{ id: string; stock: number }> = [];

      for (const item of normalizedItems) {
        if (item.quantity <= 0) {
          return handleMutationError("Sale quantities must be greater than zero");
        }

        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          return handleMutationError(`Product not found: ${item.productId}`);
        }

        const { data: updatedProducts, error: updateError } = await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", item.productId)
          .gte("stock", item.quantity)
          .select();

        if (updateError) {
          for (const rollback of rollbackStack) {
            await supabase.from("products").update({ stock: rollback.stock }).eq("id", rollback.id);
          }
          return handleMutationError(updateError.message);
        }

        if (!updatedProducts?.length) {
          for (const rollback of rollbackStack) {
            await supabase.from("products").update({ stock: rollback.stock }).eq("id", rollback.id);
          }
          return handleMutationError(`Insufficient stock for ${product.name}`);
        }

        rollbackStack.push({ id: product.id, stock: product.stock });
      }

      const salesRows = normalizedItems.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        return {
          product_id: item.productId,
          product_name: product.name,
          quantity: item.quantity,
          total: item.quantity * product.price,
          user_id: user.id,
        };
      });

      const { error: saleError } = await supabase.from("sales").insert(salesRows);
      if (saleError) {
        for (const rollback of rollbackStack) {
          await supabase.from("products").update({ stock: rollback.stock }).eq("id", rollback.id);
        }
        return handleMutationError(saleError.message);
      }

      await fetchData();
      return true;
    },
    [products, authUser, fetchData, handleMutationError]
  );

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
  const addCategory = useCallback(
    async (name: Category): Promise<boolean> => {
      const parseResult = CategorySchema.safeParse(name);
      if (!parseResult.success) {
        return handleMutationError(formatZodError(parseResult.error.issues));
      }

      if (categories.includes(name)) {
        return handleMutationError("Category already exists");
      }

      const user = await authUser();
      if (!user) return false;

      const { error } = await supabase.from("categories").insert({
        name,
        user_id: user.id,
      });

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, categories, fetchData, handleMutationError]
  );

  const updateCategory = useCallback(
    async (oldName: Category, newName: Category): Promise<boolean> => {
      const parseResult = CategorySchema.safeParse(newName);
      if (!parseResult.success) {
        return handleMutationError(formatZodError(parseResult.error.issues));
      }

      if (oldName === newName) {
        return true;
      }

      if (categories.includes(newName)) {
        return handleMutationError("Category already exists");
      }

      const user = await authUser();
      if (!user) return false;

      const { error } = await supabase
        .from("categories")
        .update({ name: newName })
        .eq("name", oldName)
        .eq("user_id", user.id);

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, categories, fetchData, handleMutationError]
  );

  const deleteCategory = useCallback(
    async (name: Category): Promise<boolean> => {
      const user = await authUser();
      if (!user) return false;

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("name", name)
        .eq("user_id", user.id);

      if (!error) {
        await fetchData();
        return true;
      }

      return handleMutationError(error.message);
    },
    [authUser, fetchData, handleMutationError]
  );

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
    sellProducts,

    addCategory,
    updateCategory,
    deleteCategory,
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