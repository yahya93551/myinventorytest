"use client";

import { useEffect, useState } from "react";
import { Product } from "../../types";
import ProductTable from "./ProductTable";
import SellModal from "./SellModal";

import AddProductForm from "./components/AddProductForm";
import RestockModal from "./components/RestockModal";
import EditProductModal from "./components/EditProductModal";

import { supabase } from "@/lib/supabase";

type InventoryProps = {
  products: Product[];
  categories: string[];

  updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  restockProduct: (id: string, amount: number) => Promise<boolean>;

  sellItem: Product | null;
  sellQty: number;
  setSellQty: (qty: number) => void;
  setSellItem: (item: Product | null) => void;
  openSell: (product: Product) => void;
  confirmSell: () => void;
};

export default function Inventory(props: InventoryProps) {
  const {
    products: initialProducts,
    categories,
    updateProduct,
    deleteProduct,
    restockProduct,
    sellItem,
    sellQty,
    setSellQty,
    setSellItem,
    openSell,
    confirmSell,
  } = props;

  // 🔥 LOCAL PRODUCTS STATE (auto refresh)
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories?.[0] ?? "");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);

  const [editItem, setEditItem] = useState<Product | null>(null);
  const [restockItem, setRestockItem] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(1);

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
  const addProductAPI = async (product: Omit<Product, "id">) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showMessage("error", "You must be logged in");
        return false;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        showMessage("error", "Session expired. Please login again");
        return false;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(product),
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage("error", data.error || "Failed to add product");
        return false;
      }

      return data.data; // 🔥 return inserted product
    } catch (err) {
      console.error(err);
      showMessage("error", "Network error");
      return false;
    }
  };

  // =====================================================
  // ADD PRODUCT
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

    const newProduct = await addProductAPI({
      name: name.trim(),
      category,
      price,
      stock,
    });

    if (newProduct) {
      // 🔥 INSTANT TABLE UPDATE
      setProducts((prev) => [newProduct, ...prev]);

      setName("");
      setPrice(0);
      setStock(0);

      showMessage("success", "Product added successfully");
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

    if (confirm(`Delete ${product.name}?`)) {
      const success = await deleteProduct(id);

      if (success) {
        // 🔥 REMOVE FROM UI
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showMessage("success", "Product deleted successfully");
      } else {
        showMessage("error", "Failed to delete product");
      }
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

      <h2 className="text-2xl sm:text-3xl font-bold">Inventory</h2>

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
          addProductHandler={addProductHandler}
        />
      </section>

      {/* TABLE */}
      <section>
        <div className="rounded-2xl overflow-auto max-h-[65vh] bg-white/5">
          <ProductTable
            products={products} // 🔥 USE LOCAL STATE
            openSell={openSell}
            onEdit={setEditItem}
            onRestock={openRestockModal}
            onDelete={deleteProductHandler}
          />
        </div>
      </section>

      {/* MODALS */}
      <SellModal
        sellItem={sellItem}
        sellQty={sellQty}
        setSellQty={setSellQty}
        setSellItem={setSellItem}
        confirmSell={confirmSell}
      />

      <EditProductModal
        editItem={editItem}
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