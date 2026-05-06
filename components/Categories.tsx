//app/components/Categories.tsx
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
    if (!value) return;

    const success = await addCategory(value);

    if (success) {
      setName("");
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
            <li key={c} className="bg-white/10 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {editing === c ? (
                <div className="flex-1">
                  <input
                    className="input w-full"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Edit category"
                    disabled={loading}
                  />
                </div>
              ) : (
                <span>{c}</span>
              )}

              <div className="flex gap-2">
                {editing === c ? (
                  <>
                    <button onClick={saveEdit} className="btn-primary" disabled={loading}>
                      Save
                    </button>
                    <button onClick={cancelEdit} className="btn-secondary">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(c)} className="btn-secondary">
                      Edit
                    </button>
                    <button onClick={() => remove(c)} className="btn-danger">
                      Delete
                    </button>
                  </>
                )}
              </div>
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
        .btn-primary,
        .btn-secondary,
        .btn-danger {
          padding: 10px 16px;
          border-radius: 12px;
          border: none;
          color: white;
          cursor: pointer;
        }
        .btn-primary {
          background: linear-gradient(to right, #7c3aed, #4f46e5);
        }
        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #e5e7eb;
        }
        .btn-danger {
          background: #dc2626;
        }
      `}</style>
    </div>
  );
}