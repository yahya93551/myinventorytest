"use client";

import { useState } from "react";
import { Product } from "../types";
import { Edit, ShoppingCart, Trash2, Plus } from "lucide-react";

export default function Inventory({ products, setProducts, categories }: any) {
  const [form, setForm] = useState<any>({});
  const [editing, setEditing] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // ---------------- ADD PRODUCT ----------------
  const save = () => {
    if (!form.name) return;

    if (editing) {
      setProducts(
        products.map((p: Product) =>
          p.id === editing.id ? { ...p, ...form } : p
        )
      );
      setEditing(null);
    } else {
      setProducts([{ id: crypto.randomUUID(), ...form }, ...products]);
    }

    setForm({});
    setShowEditModal(false);
  };

  // ---------------- SELL PRODUCT ----------------
  const sell = (id: string) => {
    const product = products.find((p: Product) => p.id === id);
    if (!product) return;

    if (!confirm(`Sell 1 unit of ${product.name}?`)) return;

    setProducts(
      products.map((p: Product) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
      )
    );
  };

  // ---------------- EDIT ----------------
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm(product);
    setShowEditModal(true);
  };

  return (
    <div>
      <h2 className="text-3xl mb-4">Inventory</h2>

      {/* ADD FORM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <input
          className="input"
          placeholder="Name"
          value={form.name || ""}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          className="input"
          placeholder="Price"
          type="number"
          value={form.price || ""}
          onChange={(e) => setForm({ ...form, price: +e.target.value })}
        />

        <input
          className="input"
          placeholder="Stock"
          type="number"
          value={form.stock || ""}
          onChange={(e) => setForm({ ...form, stock: +e.target.value })}
        />

        <select
          className="input"
          value={form.category || ""}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option>Select Category</option>
          {categories.map((c: string, index: number) => (
            <option key={`${c}-${index}`}>{c}</option>
          ))}
        </select>
      </div>

      <button
        onClick={save}
        className="btn-primary mb-6 flex items-center gap-2 w-full sm:w-auto justify-center"
      >
        <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        Add Product
      </button>

      {/* TABLE */}
      <div className="bg-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="text-left">Category</th>
                <th className="text-left">Price</th>
                <th className="text-left">Stock</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {products.map((p: Product) => (
                <tr key={p.id} className="border-t border-white/10">
                  <td className="p-3">{p.name}</td>
                  <td>{p.category}</td>
                  <td>${p.price}</td>
                  <td>{p.stock}</td>

                  {/* ✅ FIXED ACTIONS */}
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => sell(p.id)}
                        className="text-green-400 hover:text-green-300 flex items-center gap-1"
                      >
                        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Sell</span>
                      </button>

                      <button
                        onClick={() =>
                          setProducts(
                            products.filter((x: Product) => x.id !== p.id)
                          )
                        }
                        className="text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-theme-card border-theme p-6 rounded-2xl w-full max-w-md">
            <h2 className="text-xl mb-4">Edit Product</h2>

            <input
              className="input w-full mb-2"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="input w-full mb-2"
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: +e.target.value })}
              type="number"
            />

            <input
              className="input w-full mb-2"
              value={form.stock || ""}
              onChange={(e) => setForm({ ...form, stock: +e.target.value })}
              type="number"
            />

            <select
              className="input w-full mb-4"
              value={form.category || ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option>Select Category</option>
              {categories.map((c: string, index: number) => (
                <option key={`${c}-${index}`}>{c}</option>
              ))}
            </select>

            <div className="flex justify-between">
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400"
              >
                Cancel
              </button>

              <button
                onClick={save}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style jsx>{`
        .input {
          padding: 10px;
          border-radius: 12px;
          background: var(--surface-input);
          border: 1px solid var(--border);
          color: var(--text-primary);
          width: 100%;
        }

        .btn-primary {
          padding: 10px 16px;
          border-radius: 12px;
          background: linear-gradient(to right, var(--color-accent-primary), var(--color-accent-secondary));
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}