import { useEffect, useState } from "react";
import { Product, CustomField } from "../../../types";
import { CustomFieldInput } from "@/components/CustomFieldInput";
import { getVisibleSystemFields } from "@/lib/customFields";

type Props = {
  editItem: Product | null;
  categories: string[];
  customFields?: CustomField[];
  setEditItem: (item: Product | null) => void;
  saveEdit: (product: Product) => void;
};

export default function EditProductModal({
  editItem,
  categories,
  customFields = [],
  setEditItem,
  saveEdit,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [costPrice, setCostPrice] = useState(0);
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const visibleStandardFields = getVisibleSystemFields(customFields);

  useEffect(() => {
    if (!editItem) return;
    setName(editItem.name);
    setCategory(editItem.category || categories[0] || "");
    setCostPrice((editItem as any).cost_price ?? 0);
    setPrice(editItem.price);
    setStock(editItem.stock);
    setCustomData(editItem.custom_data || {});
    setError(null);
  }, [editItem, categories]);

  if (!editItem) return null;

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomData({
      ...customData,
      [fieldName]: value,
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    const costPriceVisible = visibleStandardFields.some((field) => field.field_name === "cost_price");
    const priceVisible = visibleStandardFields.some((field) => field.field_name === "price");
    const stockVisible = visibleStandardFields.some((field) => field.field_name === "stock");

    if (costPriceVisible && costPrice < 0) {
      setError("Cost price cannot be negative.");
      return;
    }

    if (priceVisible && price <= 0) {
      setError("Sell price must be greater than 0.");
      return;
    }

    if (stockVisible && stock < 0) {
      setError("Stock cannot be negative.");
      return;
    }

    saveEdit({
      ...editItem,
      name: name.trim(),
      category,
      cost_price: costPrice,
      price,
      stock,
      custom_data: customData,
    });
  };

  return (
    <div className="modal">
      <div className="box">
        <h2 className="text-xl font-semibold mb-4">Edit Product</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleStandardFields.map((field) => {
            switch (field.field_name) {
              case "name":
                return (
                  <label key={field.id} className="block text-sm text-gray-300">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={field.is_required}
                    />
                  </label>
                );
              case "category":
                return (
                  <label key={field.id} className="block text-sm text-gray-300">
                    {field.display_name}
                    <select
                      className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required={field.is_required}
                    >
                      {categories.map((cat, index) => (
                        <option key={`${cat}-${index}`} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              case "cost_price":
                return (
                  <label key={field.id} className="block text-sm text-gray-300">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
                      type="number"
                      min={0}
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(Number(e.target.value))}
                      required={field.is_required}
                    />
                  </label>
                );
              case "price":
                return (
                  <label key={field.id} className="block text-sm text-gray-300">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
                      type="number"
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      required={field.is_required}
                    />
                  </label>
                );
              case "stock":
                return (
                  <label key={field.id} className="block text-sm text-gray-300">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-slate-900 p-2 text-white border border-white/10"
                      type="number"
                      min={0}
                      step={1}
                      value={stock}
                      onChange={(e) => setStock(Number(e.target.value))}
                    />
                  </label>
                );
              default:
                return null;
            }
          })}

          {/* Custom Fields */}
          {customFields
            .filter((field) => !field.is_system && field.is_visible)
            .map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={customData?.[field.field_name]}
                onChange={(value) => handleCustomFieldChange(field.field_name, value)}
                disabled={false}
              />
            ))}
        </div>

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