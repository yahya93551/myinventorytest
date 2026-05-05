//app/components/Categories.tsx
"use client";

import { useState } from "react";

type Props = {
  categories: string[];
  loading: boolean;
  error: string | null;
  addCategory: (category: string) => Promise<boolean>;
};

export default function Categories({ categories, loading, error, addCategory }: Props) {
  const [name, setName] = useState("");

  const add = async () => {
    const value = name.trim();
    if (!value) return;

    const success = await addCategory(value);

    if (success) {
      setName("");
    } else {
      alert("Category already exists");
    }
  };

  return (
    <div>
      <h2 className="text-3xl mb-4">Categories</h2>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New category"
          disabled={loading}
        />
        <button onClick={add} className="btn-primary" disabled={loading}>
          {loading ? "Loading..." : "Add"}
        </button>
      </div>

      {loading ? (
        <div className="mt-6 p-6 rounded-2xl bg-white/5 text-center text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Loading categories...
          </span>
        </div>
      ) : categories.length === 0 ? (
        <div className="mt-6 p-6 rounded-2xl bg-white/5 text-center text-gray-400">
          No categories yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {categories.map((c: string) => (
            <li key={c} className="bg-white/10 p-3 rounded-xl">
              {c}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .input {
          padding: 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .btn-primary {
          padding: 10px 16px;
          border-radius: 12px;
          background: linear-gradient(to right, #7c3aed, #4f46e5);
        }
      `}</style>
    </div>
  );
}