"use client";

import { useEffect, useState } from "react";
import { Product, BulkSaleItem, ProductForm } from "../../types";
import ProductTable from "./ProductTable";
import SellModal from "./SellModal";
import BulkSellModal from "./BulkSellModal";

import AddProductForm from "./components/AddProductForm";
import RestockModal from "./components/RestockModal";
import EditProductModal from "./components/EditProductModal";

import { supabase } from "@/lib/supabase";

type InventoryProps = {
  products: Product[];
  categories: string[];
  loading: {
    isLoading: boolean;
    error: string | null;
  };

  updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  restockProduct: (id: string, amount: number) => Promise<boolean>;

  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  openSell: (product: Product) => void;
  confirmSell: () => void;
  sellProducts: (items: BulkSaleItem[]) => Promise<boolean>;
  addProduct: (product: ProductForm) => Promise<boolean>;
  
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
    categories,
    loading,
    updateProduct,
    deleteProduct,
    restockProduct,
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
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [note, setNote] = useState("");

  const [editItem, setEditItem] = useState<Product | null>(null);
  const [restockItem, setRestockItem] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(1);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories]);

  // =====================================================
  // ✅ API FUNCTION
  // =====================================================
  const addProductHandler = async () => {
    if (!name.trim()) {
      showMessage("error", "Product name is required");
      return;
    }

    if (price <= 0) {
      showMessage("error", "Price must be greater than 0");
      return;
    }

    if (stock < 0) {
      showMessage("error", "Stock cannot be negative");
      return;
    }

    const success = await addProduct({
      name: name.trim(),
      category,
      price,
      stock,
      notes: note.trim() || undefined,
    });

    if (success) {
      setName("");
      setPrice(0);
      setStock(0);
      setNote("");
      showMessage("success", "Product added successfully");
    } else {
      showMessage("error", "Failed to add product");
    }
  };

  // =====================================================
  // EDIT
  // =====================================================
  const saveEdit = async (data: Product) => {
    const success = await updateProduct(data.id, data);

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

  return (
    <div className="w-full space-y-8 px-2 sm:px-4 lg:px-6">

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold">Inventory</h2>
        <button
          onClick={() => setBulkSellOpen(true)}
          className="rounded-2xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Sell multiple items
        </button>
      </div>

      {/* ADD PRODUCT */}
      <section>
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
          loadingCategories={false}
          addProductHandler={addProductHandler}
        />
      </section>

      {/* TABLE */}
      <section>
        <div className="rounded-2xl overflow-auto max-h-[65vh] bg-white/5">
          <ProductTable
            products={products}
            loading={loading.isLoading}
            openSell={openSell}
            onEdit={setEditItem}
            onRestock={openRestockModal}
            onDelete={deleteProductHandler}
          />
        </div>
      </section>

      {/* PAGINATION */}
      {totalCount > 0 && (
        <section className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
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
    </div>
  );
}