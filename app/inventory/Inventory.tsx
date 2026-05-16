"use client";

import { useEffect, useState } from "react";
import { Product, ProductWithCustomData, CustomField, BulkSaleItem, ProductForm } from "../../types";
import ProductTable from "./ProductTable";
import SellModal from "./SellModal";
import BulkSellModal from "./BulkSellModal";

import AddProductForm from "./components/AddProductForm";
import RestockModal from "./components/RestockModal";
import EditProductModal from "./components/EditProductModal";
import { getVisibleSystemFieldNames } from "@/lib/customFields";


type InventoryProps = {
  products: ProductWithCustomData[];
  customFields?: CustomField[];
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
    customFields = [],
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
  const [costPrice, setCostPrice] = useState(0);
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [customData, setCustomData] = useState<Record<string, any>>({});

  const [editItem, setEditItem] = useState<Product | null>(null);
  const [restockItem, setRestockItem] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(1);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  // =====================================================
  // ✅ API FUNCTION
  // =====================================================
  const addProductHandler = async () => {
    if (!name.trim()) {
      showMessage("error", "Product name is required");
      return;
    }

    const costPriceVisible = visibleStandardFieldNames.includes("cost_price");
    const priceVisible = visibleStandardFieldNames.includes("price");
    const stockVisible = visibleStandardFieldNames.includes("stock");

    if (costPriceVisible && costPrice < 0) {
      showMessage("error", "Cost price cannot be negative");
      return;
    }

    if (priceVisible && price <= 0) {
      showMessage("error", "Sell price must be greater than 0");
      return;
    }

    if (stockVisible && stock < 0) {
      showMessage("error", "Stock cannot be negative");
      return;
    }

    const success = await addProduct({
      name: name.trim(),
      category,
      cost_price: costPrice,
      price,
      stock,
      custom_data: customData,
    });

    if (success) {
      setName("");
      setCostPrice(0);
      setPrice(0);
      setStock(0);
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">Inventory</h2>
          <p className="mt-2 text-sm text-slate-400">
            Manage products, stock, and sales from one dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            + Add Product
          </button>
          <button
            onClick={() => setBulkSellOpen(true)}
            className="rounded-2xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
          >
            Sell multiple items
          </button>
        </div>
      </div>

      <div className="grid gap-3 py-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Products</p>
          <p className="mt-3 text-3xl font-semibold">{totalProducts}</p>
          <p className="mt-2 text-sm text-slate-400">Total inventory items.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Low stock</p>
          <p className="mt-3 text-3xl font-semibold">{lowStockCount}</p>
          <p className="mt-2 text-sm text-slate-400">Products below threshold.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Out of stock</p>
          <p className="mt-3 text-3xl font-semibold">{outOfStockCount}</p>
          <p className="mt-2 text-sm text-slate-400">Need restocking now.</p>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/90 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Add Product</h3>
                <p className="mt-1 text-sm text-slate-400">Create a new product without leaving the page.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
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
        <div className="rounded-2xl overflow-auto max-h-[65vh] bg-white/5">
          <ProductTable
            products={products}
            customFields={customFields}
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
    </div>
  );
}