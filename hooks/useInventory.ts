"use client";

import { useCallback, useEffect, useState } from "react";
import { Product, Sale, Category, ProductSchema, SaleSchema, CategorySchema, LoadingState } from "../types";

interface InventoryHookReturn {
  // State
  products: Product[];
  categories: Category[];
  sales: Sale[];
  loading: LoadingState;

  // Product operations
  addProduct: (product: Omit<Product, 'id'>) => Promise<boolean>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  restockProduct: (id: string, amount: number) => Promise<boolean>;

  // Sale operations
  sellProduct: (productId: string, quantity: number) => Promise<boolean>;

  // Category operations
  addCategory: (category: Category) => Promise<boolean>;
  updateCategories: (categories: Category[]) => void;

  // Utility
  getProductById: (id: string) => Product | undefined;
  getLowStockProducts: () => Product[];
  getOutOfStockProducts: () => Product[];

  // ✅ REQUIRED BY Inventory.tsx
  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  openSell: (product: Product) => void;
  confirmSell: () => void;
}

// Storage keys
const STORAGE_KEYS = {
  PRODUCTS: 'inventory_products',
  CATEGORIES: 'inventory_categories',
  SALES: 'inventory_sales',
} as const;

// Default data
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: crypto.randomUUID(),
    name: "Laptop",
    category: "Electronics",
    price: 1299,
    stock: 18,
  },
  {
    id: crypto.randomUUID(),
    name: "Coffee Beans",
    category: "Food",
    price: 15,
    stock: 42,
  },
  {
    id: crypto.randomUUID(),
    name: "Handbag",
    category: "Fashion",
    price: 249,
    stock: 10,
  },
];

const DEFAULT_CATEGORIES: Category[] = ["Electronics", "Food", "Fashion"];

export function useInventory(): InventoryHookReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: true,
    error: null,
  });

  // ✅ Sell modal state (kept)
  const [sellItem, setSellItem] = useState<Product | null>(null);
  const [sellQty, setSellQty] = useState(1);

  // Safe localStorage
  const safeLocalStorage = {
    get: <T>(key: string, fallback: T): T => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch {
        return fallback;
      }
    },
    set: (key: string, value: any): boolean => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };

  // Load data
  useEffect(() => {
    try {
      setLoading({ isLoading: true, error: null });

      const storedProducts = safeLocalStorage.get(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
      const storedCategories = safeLocalStorage.get(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      const storedSales = safeLocalStorage.get(STORAGE_KEYS.SALES, []);

      setProducts(storedProducts);
      setCategories(storedCategories);
      setSales(storedSales);

      setLoading({ isLoading: false, error: null });
    } catch {
      setProducts(DEFAULT_PRODUCTS);
      setCategories(DEFAULT_CATEGORIES);
      setSales([]);
      setLoading({ isLoading: false, error: "Failed to load" });
    }
  }, []);

  // Persist
  useEffect(() => {
    if (!loading.isLoading) {
      safeLocalStorage.set(STORAGE_KEYS.PRODUCTS, products);
    }
  }, [products, loading.isLoading]);

  useEffect(() => {
    if (!loading.isLoading) {
      safeLocalStorage.set(STORAGE_KEYS.CATEGORIES, categories);
    }
  }, [categories, loading.isLoading]);

  useEffect(() => {
    if (!loading.isLoading) {
      safeLocalStorage.set(STORAGE_KEYS.SALES, sales);
    }
  }, [sales, loading.isLoading]);

  // Product ops
  const addProduct = useCallback(async (productData: Omit<Product, 'id'>) => {
    const newProduct = { ...productData, id: crypto.randomUUID() };
    setProducts(prev => [newProduct, ...prev]);
    return true;
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    return true;
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    return true;
  }, []);

  const restockProduct = useCallback(async (id: string, amount: number) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, stock: p.stock + amount } : p
      )
    );
    return true;
  }, []);

  // ✅ SELL PRODUCT (must come BEFORE confirmSell)
  const sellProduct = useCallback(async (productId: string, quantity: number): Promise<boolean> => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product || quantity <= 0 || quantity > product.stock) return false;

      await updateProduct(productId, { stock: product.stock - quantity });

      const newSale = {
        id: crypto.randomUUID(),
        productId,
        productName: product.name,
        quantity,
        total: quantity * product.price,
        date: new Date().toISOString(),
      };

      setSales(prev => [newSale, ...prev]);
      return true;
    } catch (error) {
      console.error("Error selling product:", error);
      return false;
    }
  }, [products, updateProduct]);

  // ✅ OPEN SELL
  const openSell = useCallback((product: Product) => {
    setSellItem(product);
    setSellQty(1);
  }, []);

  // ✅ CONFIRM SELL (NOW CORRECT ORDER)
  const confirmSell = useCallback(async () => {
    if (!sellItem) return;

    await sellProduct(sellItem.id, sellQty);

    setSellItem(null);
    setSellQty(1);
  }, [sellItem, sellQty, sellProduct]);

  // Category ops
  const addCategory = useCallback(async (category: Category) => {
    if (categories.includes(category)) return false;
    setCategories(prev => [...prev, category]);
    return true;
  }, [categories]);

  const updateCategories = useCallback((newCategories: Category[]) => {
    setCategories(newCategories);
  }, []);

  // Utilities
  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getLowStockProducts = useCallback(() => {
    return products.filter(p => p.stock > 0 && p.stock < 10);
  }, [products]);

  const getOutOfStockProducts = useCallback(() => {
    return products.filter(p => p.stock === 0);
  }, [products]);

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

    // ✅ REQUIRED
    sellItem,
    sellQty,
    setSellQty,
    setSellItem,
    openSell,
    confirmSell,
  };
}