import { useEffect, useState } from "react";
import { Product } from "../../../types";

type Props = {
  editItem: Product | null;
  categories: string[];
  setEditItem: (item: Product | null) => void;
  saveEdit: (product: Product) => void;
};

export default function EditProductModal({
  editItem,
  categories,
  setEditItem,
  saveEdit,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editItem) return;
    setName(editItem.name);
    setCategory(editItem.category || categories[0] || "");
    setPrice(editItem.price);
    setError(null);
  }, [editItem, categories]);

  if (!editItem) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    if (price <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    saveEdit({
      ...editItem,
      name: name.trim(),
      category,
      price,
    });
  };

  return (
    <div className="modal">
      <div className="box">
        <h2 className="text-xl font-semibold mb-4">Edit Product</h2>

        <label className="block mb-3 text-sm text-gray-300">
          Name
          <input
            className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block mb-3 text-sm text-gray-300">
          Category
          <select
            className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-4 text-sm text-gray-300">
          Price
          <input
            className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
            type="number"
            min={0.01}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEditItem(null)}
            className="rounded-xl border border-white/10 px-4 py-2 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-green-600 px-4 py-2 text-white"
          >
            Save
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        .box {
          background: #0f172a;
          padding: 24px;
          border-radius: 12px;
          width: 420px;
          color: white;
        }
      `}</style>
    </div>
  );
}