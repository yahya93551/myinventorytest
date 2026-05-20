// app/components/Categories.tsx
"use client";

import { useState } from "react";

type Props = {
  categories: string[];
  loading: boolean;
  error: string | null;
  addCategory: (category: string) => Promise<boolean>;
  updateCategory: (oldName: string, newName: string) => Promise<boolean>;
  deleteCategory: (category: string) => Promise<boolean>;
};

export default function Categories({
  categories,
  loading,
  error,
  addCategory,
  updateCategory,
  deleteCategory,
}: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const add = async () => {
    const value = name.trim();
    if (!value) {
      console.log("Category name is empty");
      return;
    }

    console.log("Adding category:", value);
    const success = await addCategory(value);
    console.log("Add category result:", success);

    if (success) {
      setName("");
    } else {
      console.log("Failed to add category");
    }
  };

  const startEdit = (category: string) => {
    setEditing(category);
    setEditValue(category);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const value = editValue.trim();
    if (!value) return;

    const success = await updateCategory(editing, value);
    if (success) {
      cancelEdit();
    }
  };

  const remove = async (category: string) => {
    if (!window.confirm(`Delete category '${category}'?`)) return;
    await deleteCategory(category);
  };

  return (
    <div>
      <h2 className="text-3xl mb-4">Categories</h2>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary placeholder:text-theme-secondary outline-none focus:border-cyan-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          disabled={loading}
        />
        <button
          onClick={add}
          className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition"
          disabled={loading}
        >
          {loading ? "Loading..." : "Add"}
        </button>
      </div>

      {loading ? (
        <div className="mt-6 p-6 rounded-2xl bg-theme-card text-center text-theme-secondary shadow-soft">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Loading categories...
          </span>
        </div>
      ) : categories?.length === 0 ? (
        <div className="mt-6 p-6 rounded-2xl bg-theme-card text-center text-theme-secondary shadow-soft">
          No categories yet.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {categories?.map((c: string, index: number) => (
            <li
              key={`${c}-${index}`}
              className="bg-theme-card border border-theme p-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              {editing === c ? (
                <div className="flex-1">
                  <input
                    className="w-full rounded-2xl border border-theme bg-theme-input px-4 py-3 text-theme-primary placeholder:text-theme-secondary outline-none focus:border-cyan-400"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Edit category"
                    disabled={loading}
                  />
                </div>
              ) : (
                <span>{c}</span>
              )}

              <div className="flex flex-wrap gap-2">
                {editing === c ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition"
                      disabled={loading}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-2xl bg-slate-800/80 px-4 py-3 text-sm text-theme-secondary hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded-2xl bg-slate-800/80 px-4 py-3 text-sm text-theme-secondary hover:bg-slate-700 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="rounded-2xl bg-red-600 px-4 py-3 text-sm text-white hover:bg-red-500 transition"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}