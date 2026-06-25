//app/hooks/useInventory.ts
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/apiClient";
import { useTenantRole } from "@/hooks/useTenantRole";
import {
  BulkSaleItem,
  Product,
  ProductForm,
  Sale,
  SaleMetadata,
  Category,
  LoadingState,
  ProductSchema,
  CategorySchema,
} from "../types";

const formatZodError = (issues: any[]) =>
  issues
    .map((issue) => `${issue.path?.join?.(".") || "input"}: ${issue.message}`)
    .join(", ");

const ProductFormSchema = ProductSchema.omit({ id: true, user_id: true });
const ProductUpdateSchema = ProductSchema.partial().omit({ id: true, user_id: true }).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided for update",
  }
);

export function useInventory() {
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [sellItem, setSellItem] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState<number | "">(1);
  const queryClient = useQueryClient();

  // ================= FETCH PRODUCTS WITH PAGINATION =================
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["products", currentPage],
    queryFn: async () => {
      const response = await apiGet<{ products: Product[]; count: number }>(
        `/api/products?page=${currentPage}&per_page=${itemsPerPage}`
      );
      return {
        products: response.data?.products || [],
        count: response.data?.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // ================= FETCH SALES =================
  const {
    data: salesData,
    isLoading: salesLoading,
    error: salesError,
  } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const response = await apiGet<Sale[]>("/api/sales?limit=100");
      return response.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // ================= FETCH CATEGORIES =================
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiGet<string[]>("/api/categories");
      return response.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // ================= TENANT ROLE (for owner-only metrics) =================
  const tenantRoleQuery = useTenantRole();

  // ================= FETCH OWNER METRICS =================
  const {
    data: ownerMetricsData,
    isLoading: ownerMetricsLoading,
    error: ownerMetricsError,
  } = useQuery({
    queryKey: ["ownerMetrics"],
    enabled: !!tenantRoleQuery.data && tenantRoleQuery.data.role === "owner",
    queryFn: async () => {
      const resp = await apiGet<Record<string, any>>("/api/analytics/owner-metrics");
      return resp.data || {};
    },
    staleTime: 1000 * 60 * 2,
  });

  // ================= ADD PRODUCT MUTATION =================
  const addProductMutation = useMutation({
    mutationFn: async (product: ProductForm) => {
      const parseResult = ProductFormSchema.safeParse(product);
      if (!parseResult.success) {
        throw new Error(formatZodError(parseResult.error.issues));
      }

      const resp = await apiPost<any>("/api/products", product);
      // return created product data if available
      return resp?.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCurrentPage(1);
    },
  });

  // ================= UPDATE PRODUCT MUTATION =================
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductForm> }) => {
      if (Object.keys(updates).length === 0) {
        throw new Error("No changes provided");
      }

      const parseResult = ProductUpdateSchema.safeParse(updates);
      if (!parseResult.success) {
        throw new Error(formatZodError(parseResult.error.issues));
      }

      await apiPatch<void>("/api/products", { id, updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["products", currentPage] });
    },
    onError: (error) => {
      console.error("[useInventory] updateProduct failed:", error);
    },
  });

  // ================= DELETE PRODUCT MUTATION =================
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete<void>("/api/products", { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCurrentPage(1);
    },
  });

  // ================= RESTOCK PRODUCT MUTATION =================
  const restockProductMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      if (amount <= 0) {
        throw new Error("Restock amount must be greater than zero");
      }

      await apiPost<void>("/api/products/restock", { id, amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // ================= LOAD PRODUCT MUTATION =================
  const loadProductMutation = useMutation({
    mutationFn: async ({ id, quantity, reason }: { id: string; quantity: number; reason?: string }) => {
      if (quantity <= 0) {
        throw new Error("Quantity must be greater than zero");
      }

      await apiPost<void>("/api/products/load", { id, quantity, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // ================= DROP TAKEN STOCK MUTATION =================
  const dropProductMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (!id) {
        throw new Error("Product not specified");
      }
      if (quantity <= 0) {
        throw new Error("Quantity to drop must be greater than zero");
      }
      await apiPost<void>("/api/products/drop", { id, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // ================= SELL PRODUCT MUTATION =================
  const sellProductMutation = useMutation({
    mutationFn: async ({ productId, quantity, metadata }: { productId: string; quantity: number; metadata?: SaleMetadata }) => {
      if (quantity <= 0) {
        throw new Error("Sale quantity must be at least 1");
      }

      const product = productsData?.products.find((p) => p.id === productId);
      if (!product) {
        throw new Error("Product not found");
      }

      await apiPost<void>("/api/sales", {
        product_id: productId,
        quantity,
        ...metadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });

  // ================= BULK SELL MUTATION =================
  const sellProductsMutation = useMutation({
    mutationFn: async (payload: { items: BulkSaleItem[]; metadata?: SaleMetadata }) => {
      const normalizedItems = payload.items.reduce((acc, item) => {
        const existing = acc.find((entry) => entry.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as BulkSaleItem[]);

      if (normalizedItems.length === 0) {
        throw new Error("No items selected for sale");
      }

      const products = productsData?.products || [];
      const missing = normalizedItems.find((item) => !products.some((p) => p.id === item.productId));
      if (missing) {
        throw new Error(`Product not found: ${missing.productId}`);
      }

      await apiPost<void>("/api/sales", {
        items: normalizedItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        ...payload.metadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setCurrentPage(1);
    },
  });

  // ================= ADD CATEGORY MUTATION =================
  const addCategoryMutation = useMutation({
    mutationFn: async (name: Category) => {
      if ((categoriesData || []).includes(name)) {
        throw new Error("Category already exists");
      }

      await apiPost<string>("/api/categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  // ================= UPDATE CATEGORY MUTATION =================
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: Category; newName: Category }) => {
      if (oldName === newName) {
        return;
      }

      if ((categoriesData || []).includes(newName)) {
        throw new Error("Category already exists");
      }

      await apiPatch<void>("/api/categories", { oldName, newName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  // ================= DELETE CATEGORY MUTATION =================
  const deleteCategoryMutation = useMutation({
    mutationFn: async (name: Category) => {
      await apiDelete<void>("/api/categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  // ================= HELPERS =================
  const getProductById = (id: string) =>
    (productsData?.products || []).find((p) => p.id === id);

  const getLowStockProducts = () =>
    (productsData?.products || []).filter((p) => p.stock > 0 && p.stock < 10);

  const getOutOfStockProducts = () =>
    (productsData?.products || []).filter((p) => p.stock === 0);

  // ================= SELL FLOW =================
  const openSell = (product: Product) => {
    setSellItem(product);
    setSellQty(1);
  };

  const confirmSell = async (metadata?: SaleMetadata): Promise<boolean> => {
    if (!sellItem) return false;
    const quantity = typeof sellQty === "number" ? sellQty : 0;
    if (quantity < 1) return false;

    await sellProductMutation.mutateAsync({
      productId: sellItem.id,
      quantity,
      metadata,
    });
    setSellItem(null);
    setSellQty(1);
    return true;
  };

  // ================= COMPATIBILITY WRAPPERS =================
  // Returns the created product object on success, or null on failure
  const addProductWithResult = async (product: ProductForm): Promise<Product | null> => {
    try {
      const created = await addProductMutation.mutateAsync(product);
      return created as Product | null;
    } catch (err) {
      console.error('[useInventory] addProductWithResult failed', err);
      return null;
    }
  };

  // Backwards-compatible wrapper used by other callers: returns boolean
  const addProduct = async (product: ProductForm): Promise<boolean> => {
    try {
      const created = await addProductWithResult(product);
      return !!created;
    } catch {
      return false;
    }
  };

  const updateProduct = async (id: string, updates: Partial<ProductForm>): Promise<boolean> => {
    try {
      await updateProductMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      await deleteProductMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const restockProduct = async (id: string, amount: number): Promise<boolean> => {
    try {
      await restockProductMutation.mutateAsync({ id, amount });
      return true;
    } catch {
      return false;
    }
  };

  const loadProduct = async (id: string, quantity: number, reason?: string): Promise<boolean> => {
    try {
      await loadProductMutation.mutateAsync({ id, quantity, reason });
      return true;
    } catch {
      return false;
    }
  };

  const dropProduct = async (productId: string, quantity: number): Promise<boolean> => {
    try {
      await dropProductMutation.mutateAsync({ id: productId, quantity });
      return true;
    } catch {
      return false;
    }
  };

  const sellProduct = async (
    productId: string,
    quantity: number,
    metadata?: SaleMetadata
  ): Promise<boolean> => {
    try {
      await sellProductMutation.mutateAsync({ productId, quantity, metadata });
      return true;
    } catch {
      return false;
    }
  };

  const sellProducts = async (
    items: BulkSaleItem[],
    metadata?: SaleMetadata
  ): Promise<boolean> => {
    try {
      await sellProductsMutation.mutateAsync({ items, metadata });
      return true;
    } catch {
      return false;
    }
  };

  const addCategory = async (name: Category): Promise<boolean> => {
    try {
      await addCategoryMutation.mutateAsync(name);
      return true;
    } catch {
      return false;
    }
  };

  const updateCategory = async (oldName: Category, newName: Category): Promise<boolean> => {
    try {
      await updateCategoryMutation.mutateAsync({ oldName, newName });
      return true;
    } catch {
      return false;
    }
  };

  const deleteCategory = async (name: Category): Promise<boolean> => {
    try {
      await deleteCategoryMutation.mutateAsync(name);
      return true;
    } catch {
      return false;
    }
  };

  const updateCategories = (newCategories: Category[]) => {
    return;
  };

  // ================= LOADING STATE =================
  const loading: LoadingState = {
    isLoading:
      productsLoading || salesLoading || categoriesLoading,
    error:
      productsError?.message ||
      salesError?.message ||
      categoriesError?.message ||
      ownerMetricsError?.message ||
      addCategoryMutation.error?.message ||
      updateCategoryMutation.error?.message ||
      deleteCategoryMutation.error?.message ||
      null,
  };

  return {
    products: productsData?.products || [],
    categories: categoriesData || [],
    sales: salesData || [],
    loading,

    currentPage,
    totalCount: productsData?.count || 0,
    itemsPerPage,
    setCurrentPage,
    totalPages: Math.ceil((productsData?.count || 0) / itemsPerPage),

    addProduct,
    addProductWithResult,
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
    confirmSell,
    loadProduct,
    dropProduct,
    ownerMetrics: ownerMetricsData || null,
  };
}