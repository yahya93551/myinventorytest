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
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState(0);
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [canEditCostPrice, setCanEditCostPrice] = useState(false);
  const [canEditPrice, setCanEditPrice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleStandardFields = getVisibleSystemFields(customFields);

  useEffect(() => {
    if (!editItem) return;
    setName(editItem.name);
    setCategory(editItem.category || categories[0] || "");
    setCostPrice((editItem as any).cost_price ?? "");
    setPrice(editItem.price ?? "");
    setStock(editItem.stock);
    setCustomData(editItem.custom_data || {});
    setCanEditCostPrice(false);
    setCanEditPrice(false);
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

    if (costPriceVisible && canEditCostPrice) {
      if (costPrice === "") {
        setError("Cost price is required.");
        return;
      }
      if (costPrice < 0) {
        setError("Cost price cannot be negative.");
        return;
      }
    }

    if (priceVisible && canEditPrice) {
      if (price === "") {
        setError("Sell price is required.");
        return;
      }
      if (price <= 0) {
        setError("Sell price must be greater than 0.");
        return;
      }
    }

    if (stockVisible && stock < 0) {
      setError("Stock cannot be negative.");
      return;
    }

    saveEdit({
      ...editItem,
      name: name.trim(),
      category,
      cost_price: canEditCostPrice ? (costPrice === "" ? 0 : costPrice) : (editItem as any).cost_price,
      price: canEditPrice ? (price === "" ? 0 : price) : editItem.price,
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
                  <label key={field.id} className="block text-sm text-theme-secondary">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-theme-card p-2 text-theme-primary border border-theme"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={field.is_required}
                    />
                  </label>
                );
              case "category":
                return (
                  <label key={field.id} className="block text-sm text-theme-secondary">
                    {field.display_name}
                    <select
                      className="mt-2 block w-full rounded bg-theme-card p-2 text-theme-primary border border-theme"
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
                  <label key={field.id} className="block text-sm text-theme-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <span>{field.display_name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (canEditCostPrice) {
                            setCostPrice((editItem as any).cost_price ?? 0);
                          }
                          setCanEditCostPrice((prev) => !prev);
                        }}
                        className="rounded-full border border-theme bg-theme-input px-3 py-1 text-xs font-semibold text-theme-primary transition hover:bg-theme-surface"
                      >
                        {canEditCostPrice ? "Lock" : "Edit"}
                      </button>
                    </div>
                    <input
                      className="mt-2 block w-full rounded bg-theme-card p-2 text-theme-primary border border-theme disabled:cursor-not-allowed disabled:opacity-60"
                      type="number"
                      min={0}
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      required={field.is_required}
                      disabled={!canEditCostPrice}
                    />
                  </label>
                );
              case "price":
                return (
                  <label key={field.id} className="block text-sm text-theme-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <span>{field.display_name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (canEditPrice) {
                            setPrice(editItem.price);
                          }
                          setCanEditPrice((prev) => !prev);
                        }}
                        className="rounded-full border border-theme bg-theme-input px-3 py-1 text-xs font-semibold text-theme-primary transition hover:bg-theme-surface"
                      >
                        {canEditPrice ? "Lock" : "Edit"}
                      </button>
                    </div>
                    <input
                      className="mt-2 block w-full rounded bg-theme-card p-2 text-theme-primary border border-theme disabled:cursor-not-allowed disabled:opacity-60"
                      type="number"
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      required={field.is_required}
                      disabled={!canEditPrice}
                    />
                  </label>
                );
              case "stock":
                return (
                  <label key={field.id} className="block text-sm text-theme-secondary">
                    {field.display_name}
                    <input
                      className="mt-2 block w-full rounded bg-theme-card p-2 text-theme-primary border border-theme disabled:cursor-not-allowed disabled:opacity-60"
                      type="number"
                      min={0}
                      step={1}
                      value={stock}
                      disabled
                      title="Stock cannot be changed from the edit form"
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
            className="rounded-xl border border-theme px-4 py-2 text-theme-secondary"
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
          background: var(--surface-card);
          padding: 24px;
          border-radius: 12px;
          width: 420px;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}