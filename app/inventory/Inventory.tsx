"use client";

import { useEffect, useState } from "react";
import { Product, ProductWithCustomData, CustomField, BulkSaleItem, ProductForm } from "../../types";
import ProductTable from "./ProductTable";
import SellModal from "./SellModal";
import BulkSellModal from "./BulkSellModal";

import AddProductForm from "./components/AddProductForm";
import RestockModal from "./components/RestockModal";
import LoadModal from "./components/LoadModal";
import DropModal from "./components/DropModal";
import EditProductModal from "./components/EditProductModal";
import { getVisibleSystemFieldNames } from "@/lib/customFields";
import { apiGet } from "@/lib/apiClient";
import { supabase } from "@/lib/supabase";


type InventoryProps = {
  products: ProductWithCustomData[];
  customFields?: CustomField[];
  categories: string[];
  loading: {
    isLoading: boolean;
    error: string | null;
  };

  updateProduct: (id: string, updates: Partial<ProductForm>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  restockProduct: (id: string, amount: number) => Promise<boolean>;

  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  openSell: (product: Product) => void;
  confirmSell: (metadata?: {
    order_id?: string;
    customer_name?: string;
    customer_address?: string;
    customer_phone?: string;
  }) => Promise<boolean>;
  sellProducts: (items: BulkSaleItem[], metadata?: {
    order_id?: string;
    customer_name?: string;
    customer_address?: string;
    customer_phone?: string;
  }) => Promise<boolean>;
  addProduct: (product: ProductForm) => Promise<boolean>;
  loadProduct: (id: string, quantity: number, reason?: string) => Promise<boolean>;
  dropProduct: (id: string, quantity: number) => Promise<boolean>;
  
  // Pagination
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
};

export default function Inventory(props: InventoryProps) {
  const {
    products,
    customFields = [],
    categories,
    loading,
    updateProduct,
    deleteProduct,
    restockProduct,
    loadProduct,
    dropProduct,
    sellItem,
    sellQty,
    setSellQty,
    setSellItem,
    openSell,
    confirmSell,
    sellProducts,
    addProduct,
    currentPage,
    totalCount,
    itemsPerPage,
    totalPages,
    setCurrentPage,
  } = props;

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories?.[0] ?? "");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [customData, setCustomData] = useState<Record<string, any>>({});

  const [editItem, setEditItem] = useState<Product | null>(null);
  const [restockItem, setRestockItem] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(1);
  const [loadItem, setLoadItem] = useState<Product | null>(null);
  const [loadAmount, setLoadAmount] = useState(1);
  const [loadNote, setLoadNote] = useState("");
  const [dropItem, setDropItem] = useState<Product | null>(null);
  const [dropAmount, setDropAmount] = useState(1);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [tenantRole, setTenantRole] = useState<string>("");
  const [storageBucketExists, setStorageBucketExists] = useState<boolean | null>(null);

  const visibleStandardFieldNames = getVisibleSystemFieldNames(customFields);
  const totalProducts = products.length;
  const lowStockCount = products.filter((product) => product.stock > 0 && product.stock < 5).length;
  const outOfStockCount = products.filter((product) => product.stock === 0).length;

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories]);

  useEffect(() => {
    const loadTenantRole = async () => {
      try {
        const result = await apiGet<{ role: string }>("/api/tenant-role");
        setTenantRole(result.data?.role ?? "");
      } catch (error) {
        console.error("Failed to load tenant role:", error);
      }
    };

    loadTenantRole();
  }, []);

  // Lightweight check to detect whether the `product-images` storage bucket exists.
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.storage.from('product-images').list('', { limit: 1 });
        if (error) {
          console.warn('Storage bucket check:', error.message);
          setStorageBucketExists(false);
        } else {
          setStorageBucketExists(true);
        }
      } catch (err) {
        console.warn('Storage bucket check error:', err);
        setStorageBucketExists(false);
      }
    })();
  }, []);

  // =====================================================
  // ✅ API FUNCTION
  // =====================================================
  const addProductHandler = async (imageFile?: File | null) => {
    if (!name.trim()) {
      showMessage("error", "Product name is required");
      return;
    }

    const costPriceVisible = visibleStandardFieldNames.includes("cost_price");
    const priceVisible = visibleStandardFieldNames.includes("price");
    const stockVisible = visibleStandardFieldNames.includes("stock");

    const parsedCostPrice = costPrice === "" ? 0 : costPrice;
    const parsedPrice = price === "" ? 0 : price;
    const parsedStock = stock === "" ? 0 : stock;

    if (costPriceVisible && costPrice === "") {
      showMessage("error", "Cost price is required");
      return;
    }

    if (costPriceVisible && parsedCostPrice < 0) {
      showMessage("error", "Cost price cannot be negative");
      return;
    }

    if (priceVisible && price === "") {
      showMessage("error", "Sell price is required");
      return;
    }

    if (priceVisible && parsedPrice <= 0) {
      showMessage("error", "Sell price must be greater than 0");
      return;
    }

    if (stockVisible && stock === "") {
      showMessage("error", "Stock is required");
      return;
    }

    if (stockVisible && parsedStock < 0) {
      showMessage("error", "Stock cannot be negative");
      return;
    }

    let imageUrl: string | undefined;

    if (imageFile) {
      if (storageBucketExists === false) {
        console.warn('Skipping image upload: product-images bucket missing');
        showMessage('error', 'Image upload skipped: storage bucket not found');
      } else {
        try {
          const filePath = `products/${Date.now()}_${imageFile.name}`;
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imageFile, { upsert: false });

          if (uploadError) {
            console.warn('Image upload skipped:', uploadError.message);
            showMessage('error', 'Image upload failed (product created without image).');
          } else {
            const { data: urlData } = await supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (!urlData?.publicUrl) {
              console.warn('Failed to get public URL for uploaded image.');
              showMessage('error', 'Image uploaded but URL retrieval failed.');
            } else {
              imageUrl = urlData.publicUrl;
            }
          }
        } catch (err) {
          console.warn('Image upload (non-critical):', err);
          showMessage('error', 'Image upload failed (product created without image).');
        }
      }
    }

    const success = await addProduct({
      name: name.trim(),
      category,
      cost_price: parsedCostPrice,
      price: parsedPrice,
      stock: parsedStock,
      custom_data: customData,
      image_url: imageUrl,
    });

    if (success) {
      setName("");
      setCostPrice("");
      setPrice("");
      setStock("");
      setCustomData({});
      showMessage("success", "Product added successfully");
      setIsAddModalOpen(false);
    } else {
      showMessage("error", "Failed to add product");
    }
  };

  // =====================================================
  // EDIT
  // =====================================================
  const saveEdit = async (id: string, updates: Partial<ProductForm>) => {
    if (Object.keys(updates).length === 0) {
      showMessage("error", "No changes made to save.");
      return;
    }

    const success = await updateProduct(id, updates);

    if (success) {
      showMessage("success", "Product updated successfully");
      setEditItem(null);
    } else {
      showMessage("error", "Failed to update product");
    }
  };

  // =====================================================
  // DELETE
  // =====================================================
  const deleteProductHandler = async (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const confirmed = confirm(
      `Delete ${product.name}? This will delete only your own product.`
    );
    if (!confirmed) return;

    const success = await deleteProduct(id);

    if (success) {
      showMessage("success", "Product deleted successfully");
    } else {
      showMessage("error", "Failed to delete product. Only your own products can be removed.");
    }
  };

  // =====================================================
  // RESTOCK
  // =====================================================
  const openRestockModal = (product: Product) => {
    setRestockItem(product);
    setRestockAmount(1);
  };

  const saveRestock = async () => {
    if (!restockItem) return;

    if (restockAmount <= 0) {
      showMessage("error", "Restock amount must be greater than 0");
      return;
    }

    const success = await restockProduct(restockItem.id, restockAmount);

    if (success) {
      showMessage("success", "Stock updated successfully");
    } else {
      showMessage("error", "Failed to restock product");
    }

    setRestockItem(null);
    setRestockAmount(1);
  };

  const openLoadModal = (product: Product) => {
    setLoadItem(product);
    setLoadAmount(1);
    setLoadNote("");
  };

  const saveLoad = async () => {
    if (!loadItem) return;

    if (loadAmount <= 0) {
      showMessage("error", "Quantity must be greater than 0");
      return;
    }

    if (loadAmount > loadItem.stock) {
      showMessage("error", "Quantity cannot exceed available stock");
      return;
    }

    const success = await loadProduct(loadItem.id, loadAmount, loadNote);

    if (success) {
      showMessage("success", "Stock taken successfully");
    } else {
      showMessage("error", "Failed to take stock from product");
    }

    setLoadItem(null);
    setLoadAmount(1);
    setLoadNote("");
  };

  const openDropModal = (product: Product) => {
    setDropItem(product);
    setDropAmount(1);
  };

  const saveDrop = async () => {
    if (!dropItem) return;

    const available = dropItem.allocated_quantity ?? 0;
    if (dropAmount <= 0 || dropAmount > available) {
      showMessage("error", "Quantity must be between 1 and the taken stock amount");
      return;
    }

    const success = await dropProduct(dropItem.id, dropAmount);

    if (success) {
      showMessage("success", "Taken stock dropped successfully");
    } else {
      showMessage("error", "Failed to drop taken stock");
    }

    setDropItem(null);
    setDropAmount(1);
  };

  return (
    <div className="w-full min-w-0 space-y-8 px-2 sm:px-4 lg:px-6">

      {loading.isLoading && (
        <div className="p-3 rounded-xl text-sm font-medium bg-sky-500/10 text-sky-200">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Loading inventory...
          </span>
        </div>
      )}

      {loading.error && (
        <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-300">
          Error loading inventory: {loading.error}
        </div>
      )}

      {/* MESSAGE */}
      {message && (
        <div
          className={`p-3 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">Inventory</h2>
          <p className="mt-2 text-sm text-theme-secondary">
            Manage products, stock, and sales from one dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(tenantRole === 'owner' || tenantRole === 'accountant') && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-2xl bg-theme-accent px-5 py-3 min-h-11 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400"
            >
              + Add Product
            </button>
          )}
          <button
            onClick={() => setBulkSellOpen(true)}
            className="rounded-2xl border border-theme bg-theme-card px-5 py-3 min-h-11 text-sm font-semibold text-theme-primary transition hover:bg-theme-surface"
          >
            Sell multiple items
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 py-4">
        <div className="rounded-2xl border-theme bg-theme-card p-2 shadow-soft">
          <p className="text-[9px] uppercase tracking-[0.16em] text-theme-secondary">Products</p>
          <p className="mt-1 text-base font-semibold text-theme-primary">{totalProducts}</p>
          <p className="mt-1 text-[10px] text-theme-secondary">Total inventory items.</p>
        </div>
        <div className="rounded-2xl border-theme bg-theme-card p-2 shadow-soft">
          <p className="text-[9px] uppercase tracking-[0.16em] text-theme-secondary">Low stock</p>
          <p className="mt-1 text-base font-semibold text-theme-primary">{lowStockCount}</p>
          <p className="mt-1 text-[10px] text-theme-secondary">Products below threshold.</p>
        </div>
        <div className="rounded-2xl border-theme bg-theme-card p-2 shadow-soft">
          <p className="text-[9px] uppercase tracking-[0.16em] text-theme-secondary">Out of stock</p>
          <p className="mt-1 text-base font-semibold text-theme-primary">{outOfStockCount}</p>
          <p className="mt-1 text-[10px] text-theme-secondary">Need restocking now.</p>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl border border-theme bg-theme-card p-6 shadow-2xl">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-theme-primary">Add Product</h3>
                <p className="mt-1 text-sm text-theme-secondary">Create a new product without leaving the page.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-2xl border border-theme bg-theme-input px-4 py-2 text-sm font-semibold text-theme-primary transition hover:bg-theme-surface"
              >
                Close
              </button>
            </div>

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
              loadingCategories={false}
              customFields={customFields}
              customData={customData}
              setCustomData={setCustomData}
              addProductHandler={addProductHandler}
            />
          </div>
        </div>
      )}

      {/* TABLE */}
      <section>
        <div className="rounded-2xl overflow-y-auto max-h-none md:max-h-[65vh] bg-theme-card border border-theme shadow-soft">
          <ProductTable
            products={products}
            customFields={customFields}
            loading={loading.isLoading}
            openSell={openSell}
            onEdit={setEditItem}
            onRestock={openRestockModal}
            onLoad={openLoadModal}
            onDrop={openDropModal}
            onDelete={deleteProductHandler}
            canEdit={tenantRole === 'owner' || tenantRole === 'accountant'}
            canDelete={tenantRole === 'owner' || tenantRole === 'accountant'}
            canRestock={tenantRole === 'owner'}
            canLoad={
              tenantRole === 'accountant' ||
              tenantRole === 'sales'
            }
            tenantRole={tenantRole}
          />
        </div>
      </section>

      {/* PAGINATION */}
      {totalCount > 0 && (
        <section className="flex items-center justify-between gap-4">
          <div className="text-sm text-theme-secondary">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} products
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      currentPage === page
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* MODALS */}
      <SellModal
        sellItem={sellItem}
        sellQty={sellQty}
        setSellQty={setSellQty}
        setSellItem={setSellItem}
        confirmSell={confirmSell}
        tenantRole={tenantRole}
      />

      <BulkSellModal
        isOpen={bulkSellOpen}
        products={products}
        onClose={() => setBulkSellOpen(false)}
        onConfirm={sellProducts}
        showMessage={showMessage}
      />

      <EditProductModal
        editItem={editItem}
        categories={categories}
        customFields={customFields}
        setEditItem={setEditItem}
        saveEdit={saveEdit}
      />

      <RestockModal
        restockItem={restockItem}
        restockAmount={restockAmount}
        setRestockAmount={setRestockAmount}
        setRestockItem={setRestockItem}
        saveRestock={saveRestock}
      />

      <LoadModal
        loadItem={loadItem}
        loadAmount={loadAmount}
        loadNote={loadNote}
        setLoadAmount={setLoadAmount}
        setLoadNote={setLoadNote}
        setLoadItem={setLoadItem}
        saveLoad={saveLoad}
      />

      <DropModal
        dropItem={dropItem}
        dropAmount={dropAmount}
        setDropAmount={setDropAmount}
        setDropItem={setDropItem}
        saveDrop={saveDrop}
      />
    </div>
  );
}