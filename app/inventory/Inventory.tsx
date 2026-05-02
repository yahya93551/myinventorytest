"use client";

import { useEffect, useState } from "react";
import { Product } from "../../types";
import ProductTable from "./ProductTable";
import SellModal from "./SellModal";

import AddProductForm from "./components/AddProductForm";
import RestockModal from "./components/RestockModal";
import EditProductModal from "./components/EditProductModal";

type InventoryProps = {
  products: Product[];
  categories: string[];
  addProduct: (product: Omit<Product, "id">) => Promise<boolean>;
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
    products,
    categories,
    addProduct,
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

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories?.[0] ?? "");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);

  const [editItem, setEditItem] = useState<Product | null>(null);

  const [restockItem, setRestockItem] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(1);

  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories]);

  const addProductHandler = async () => {
    if (!name.trim() || price <= 0 || stock < 0) return;

    const success = await addProduct({
      name: name.trim(),
      category,
      price,
      stock,
    });

    if (success) {
      setName("");
      setPrice(0);
      setStock(0);
    }
  };

  const saveEdit = async (data: Product) => {
    await updateProduct(data.id, data);
    setEditItem(null);
  };

  const deleteProductHandler = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    if (confirm(`Delete ${product.name}?`)) {
      await deleteProduct(id);
    }
  };

  const openRestockModal = (product: Product) => {
    setRestockItem(product);
    setRestockAmount(1);
  };

  const saveRestock = async () => {
    if (!restockItem) return;

    await restockProduct(restockItem.id, restockAmount);

    setRestockItem(null);
    setRestockAmount(1);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Inventory</h2>

      {/* ADD PRODUCT */}
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

      {/* TABLE */}
      <ProductTable
        products={products}
        openSell={openSell}
        onEdit={setEditItem}
        onRestock={openRestockModal}
        onDelete={deleteProductHandler}
      />

      {/* SELL MODAL */}
      <SellModal
        sellItem={sellItem}
        sellQty={sellQty}
        setSellQty={setSellQty}
        setSellItem={setSellItem}
        confirmSell={confirmSell}
      />

      {/* EDIT MODAL */}
      <EditProductModal
        editItem={editItem}
        setEditItem={setEditItem}
        saveEdit={saveEdit}
      />

      {/* RESTOCK MODAL */}
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