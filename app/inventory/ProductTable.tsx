import { useMemo, useState } from "react";
import { ProductWithCustomData, CustomField } from "../../types";
import { Search, ShoppingCart, Plus, Minus, Edit, Trash2, AlertCircle, DollarSign, Tag, SlidersHorizontal } from "lucide-react";
import { getVisibleTableFields } from "@/lib/customFields";

export default function ProductTable({
  products = [],
  customFields = [],
  openSell,
  onEdit,
  onRestock,
  onLoad,
  onDrop,
  onDelete,
  loading = false,
  canEdit = true,
  canDelete = true,
  canRestock = false,
  canLoad = false,
  tenantRole = "",
}: {
  products?: ProductWithCustomData[];
  customFields?: CustomField[];
  openSell: (product: ProductWithCustomData) => void;
  onEdit?: (product: ProductWithCustomData) => void;
  onRestock?: (product: ProductWithCustomData) => void;
  onLoad?: (product: ProductWithCustomData) => void;
  onDrop?: (product: ProductWithCustomData) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestock?: boolean;
  canLoad?: boolean;
  tenantRole?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const allVisibleFields = getVisibleTableFields(customFields);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const productText = [product.name, product.category, String(product.price), String(product.cost_price)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatches = !normalizedQuery || productText.includes(normalizedQuery);
      const stockStatus = product.stock === 0 ? "out" : product.stock <= 5 ? "critical" : product.stock < 20 ? "low" : "in";
      const statusMatches = filterStatus === "all" || filterStatus === stockStatus;

      return searchMatches && statusMatches;
    });
  }, [products, searchQuery, filterStatus]);

  // Calculate total columns
  const totalCols = allVisibleFields.length + 2; // +1 for image +1 for actions

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
      <div className="w-full rounded-2xl bg-theme-card border border-theme p-8 text-center shadow-soft">
        <div className="text-theme-secondary">
          <h3 className="text-lg font-semibold mb-2">Create Your Table</h3>
          <p>Go to Settings to configure your product fields and start managing your inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-theme-card border border-theme shadow-soft">
      <div className="border-b border-theme/60 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="inventory-search" className="sr-only">
              Search inventory
            </label>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-theme-accent">
              <Search className="h-5 w-5" />
            </span>
            <input
              id="inventory-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search inventory by name, category, price..."
              className="w-full rounded-2xl border border-theme/50 bg-theme-surface px-4 py-3 pl-14 text-base text-theme-primary outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          <div className="relative flex shrink-0 items-center sm:ml-3">
            <label htmlFor="inventory-filter" className="sr-only">
              Stock status filter
            </label>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-theme/50 bg-theme-surface text-theme-secondary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <select
              id="inventory-filter"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer inventory-filter-select"
            >
              <option value="all">All</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="critical">Critical Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop / larger screens: keep existing table */}
      <div className="hidden sm:block overflow-x-auto max-w-full">
        <table className="min-w-full w-full text-sm">
          <thead className="sticky top-0 bg-theme-surface backdrop-blur-xl z-10">
            <tr>
              <th className="p-4 text-left whitespace-nowrap text-theme-secondary text-sm font-semibold">Photo</th>
              {allVisibleFields.map((field) => (
                <th key={field.id} className="p-4 text-left whitespace-nowrap text-theme-secondary text-sm font-semibold" title={field.description}>
                  {field.display_name}
                </th>
              ))}
              <th className="p-4 text-left whitespace-nowrap text-sm font-semibold">Actions</th>
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
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="p-6 text-center text-theme-secondary">
                  No matching inventory items found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} className="border-t border-theme hover:bg-theme-surface-soft transition-colors duration-150">
                      <td className="p-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-theme-surface text-theme-secondary text-xs">
                        No Image
                      </div>
                    )}
                  </td>

                  {allVisibleFields.map((field) => (
                    <td
                      key={field.id}
                      className="p-3 whitespace-nowrap text-theme-primary"
                      title={field.is_system ? String((p as any)[field.field_name]) : String(p.custom_data?.[field.field_name])}
                    >
                      {renderFieldValue(field, p)}
                    </td>
                  ))}

                  <td className="p-3 flex flex-wrap items-center gap-2">
                    {(() => {
                      const available = tenantRole === "sales" ? p.allocated_quantity ?? 0 : p.stock;
                      const disabled = available === 0;
                      return (
                        <button
                          onClick={() => !disabled && openSell(p)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            disabled
                              ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-100"
                          }`}
                          disabled={disabled}
                          title={
                            disabled
                              ? tenantRole === "sales"
                                ? "No taken stock available"
                                : "Out of stock"
                              : "Sell this product"
                          }
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Sell
                        </button>
                      );
                    })()}

                    {canRestock && (
                      <button
                        onClick={() => onRestock?.(p)}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10"
                        title="Load goods into stock"
                      >
                        <Plus className="w-4 h-4" />
                        Load
                      </button>
                    )}

                    {canLoad && (
                      <button
                        onClick={() => onLoad?.(p)}
                        disabled={p.stock === 0}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                          p.stock === 0
                            ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                            : "border-amber-500/20 bg-amber-500/5 text-amber-200 hover:bg-amber-500/10"
                        }`}
                        title={p.stock === 0 ? "Out of stock" : "Take from stock"}
                      >
                        <Minus className="w-4 h-4" />
                        Take
                      </button>
                    )}

                    {canLoad && tenantRole === "sales" && onDrop && (
                      <button
                        onClick={() => onDrop(p)}
                        disabled={(p.allocated_quantity ?? 0) === 0}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                          (p.allocated_quantity ?? 0) === 0
                            ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                            : "border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10"
                        }`}
                        title={
                          (p.allocated_quantity ?? 0) === 0
                            ? "No taken stock available to drop"
                            : "Drop taken stock"
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                        Drop
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => onEdit?.(p)}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/10"
                        title="Edit product"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => onDelete?.(p.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked rows with image and vertical actions */}
      <div className="block sm:hidden overflow-x-auto max-w-full">
        <table className="min-w-full w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-3">PRODUCT</th>
              <th className="text-left px-4 py-3">PRICE</th>
              <th className="text-left px-4 py-3">STOCK</th>
              <th className="text-left px-4 py-3">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-theme-secondary">Loading products...</td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-theme-secondary">No matching inventory items found.</td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-theme">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-theme-secondary">No image</div>
                      )}

                      <div>
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <span className="text-xs text-theme-secondary">{product.category}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {/* Selling Price - Primary */}
                      <div className="flex items-center gap-2 rounded-2xl border border-theme/20 bg-theme/5 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/60">Selling</div>
                          <div className="text-sm font-semibold text-foreground">${parseFloat(String(product.price ?? 0)).toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Cost Price - Secondary */}
                      <div className="flex items-center gap-2 rounded-2xl border border-theme/20 bg-theme/5 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/60">Cost</div>
                          <div className="text-sm font-semibold text-foreground">${parseFloat(String(product.cost_price ?? 0)).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {/* Stock Quantity Badge */}
                      <div
                        className={`inline-flex min-w-[44px] h-10 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition-all duration-200 ${
                          product.stock === 0
                            ? "bg-red-500/10 text-red-400 border border-red-500/30"
                            : product.stock <= 5
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : product.stock < 20
                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                            : "bg-green-500/10 text-green-400 border border-green-500/30"
                        }`}
                      >
                        {product.stock}
                      </div>

                      {/* Stock Status Indicator */}
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {product.stock === 0 ? (
                          <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-red-400 border border-red-500/30">
                            <AlertCircle className="w-3 h-3" />
                            <span>Out of Stock</span>
                          </div>
                        ) : product.stock <= 5 ? (
                          <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-amber-400 border border-amber-500/30">
                            <AlertCircle className="w-3 h-3 animate-pulse" />
                            <span>Critical</span>
                          </div>
                        ) : product.stock < 20 ? (
                          <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-1 text-yellow-400 border border-yellow-500/30">
                            <AlertCircle className="w-3 h-3" />
                            <span>Low</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-green-400 border border-green-500/30">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-400"></span>
                            <span>In Stock</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="flex flex-wrap gap-2">
                      {/* Primary Action: Sell */}
                      <button
                        onClick={() => openSell(product)}
                        className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15 transition min-h-[44px]"
                        title="Sell this product"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Sell
                      </button>

                      {/* Secondary Action: Load Goods */}
                      {canRestock && (
                        <button
                          onClick={() => onRestock?.(product)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 transition min-h-[44px]"
                          title="Load goods into stock"
                        >
                          <Plus className="w-5 h-5" />
                          Load
                        </button>
                      )}

                      {/* Neutral Action: Edit */}
                      {canEdit && (
                        <button
                          onClick={() => onEdit?.(product)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition min-h-[44px]"
                          title="Edit product details"
                        >
                          <Edit className="w-5 h-5" />
                          Edit
                        </button>
                      )}

                      {/* Destructive Action: Delete */}
                      {canDelete && (
                        <button
                          onClick={() => onDelete?.(product.id)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 transition min-h-[44px]"
                          title="Delete product permanently"
                        >
                          <Trash2 className="w-5 h-5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}