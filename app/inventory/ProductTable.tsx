import { ProductWithCustomData, CustomField } from "../../types";
import { ShoppingCart, Plus, Edit, Trash2 } from "lucide-react";
import { getVisibleTableFields } from "@/lib/customFields";

export default function ProductTable({
  products = [],
  customFields = [],
  openSell,
  onEdit,
  onRestock,
  onDelete,
  loading = false,
}: {
  products?: ProductWithCustomData[];
  customFields?: CustomField[];
  openSell: (product: ProductWithCustomData) => void;
  onEdit?: (product: ProductWithCustomData) => void;
  onRestock?: (product: ProductWithCustomData) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}) {
  const allVisibleFields = getVisibleTableFields(customFields);

  // Calculate total columns
  const totalCols = allVisibleFields.length + 1; // +1 for actions

  const renderFieldValue = (field: CustomField, product: ProductWithCustomData) => {
    let value;
    if (field.is_system) {
      value = (product as any)[field.field_name];
    } else {
      value = product.custom_data?.[field.field_name];
    }

    if (value === undefined || value === null) {
      return "—";
    }

    // Special rendering for system fields
    if (field.is_system) {
      switch (field.field_name) {
        case "cost_price":
        case "price":
          return `$${parseFloat(value).toFixed(2)}`;
        case "stock":
          return (
            <span
              className={`px-2 py-1 rounded text-xs font-semibold ${
                value === 0
                  ? "bg-red-500/20 text-red-300"
                  : value < 10
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              {value}
            </span>
          );
        default:
          return String(value);
      }
    }

    // Custom field rendering
    switch (field.field_type) {
      case "currency":
        return `$${parseFloat(value).toFixed(2)}`;
      case "checkbox":
        return value ? "✓" : "—";
      case "date":
        return new Date(value).toLocaleDateString();
      case "number":
        return parseFloat(value).toString();
      default:
        return String(value);
    }
  };

  if (allVisibleFields.length === 0) {
    return (
      <div className="w-full max-h-[70vh] overflow-auto rounded-2xl bg-theme-card border border-theme p-8 text-center shadow-soft">
        <div className="text-theme-secondary">
          <h3 className="text-lg font-semibold mb-2">Create Your Table</h3>
          <p>Go to Settings to configure your product fields and start managing your inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-h-[70vh] overflow-auto rounded-2xl bg-theme-card border border-theme shadow-soft">
      <table className="min-w-full w-full text-sm">
        <thead className="sticky top-0 bg-theme-surface backdrop-blur-xl z-10">
          <tr>
            {allVisibleFields.map((field) => (
              <th key={field.id} className="p-3 text-left whitespace-nowrap text-theme-secondary" title={field.description}>
                {field.display_name}
              </th>
            ))}
            <th className="p-3 text-left whitespace-nowrap">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={totalCols} className="p-8 text-center text-theme-secondary">
                <div className="inline-flex items-center gap-2 text-theme-secondary">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Loading products...
                </div>
              </td>
            </tr>
          ) : products.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="p-6 text-center text-theme-secondary">
                No inventory items found.
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.id} className="border-t border-theme hover:bg-theme-surface-soft transition-colors duration-150">
                {allVisibleFields.map((field) => (
                  <td
                    key={field.id}
                    className="p-3 whitespace-nowrap text-theme-primary"
                    title={field.is_system ? String((p as any)[field.field_name]) : String(p.custom_data?.[field.field_name])}
                  >
                    {renderFieldValue(field, p)}
                  </td>
                ))}

                <td className="p-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => p.stock > 0 && openSell(p)}
                    className={`flex items-center gap-1 text-xs ${
                      p.stock === 0 ? "text-gray-500 cursor-not-allowed" : "text-green-400 hover:text-green-300"
                    } transition`}
                    disabled={p.stock === 0}
                    title={p.stock === 0 ? "Out of stock" : "Load goods to sell"}
                  >
                    <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                    Load Goods
                  </button>

                  <button
                    onClick={() => onRestock?.(p)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                    title="Add to stock"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    Restock
                  </button>

                  <button
                    onClick={() => onEdit?.(p)}
                    className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition"
                    title="Edit product"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => onDelete?.(p.id)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                    title="Delete product"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}