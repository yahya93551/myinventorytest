import { useMemo, useState, useEffect } from "react";
import { ProductWithCustomData, CustomField } from "../../types";
import { Search, ShoppingCart, Plus, Minus, Edit, Trash2, AlertCircle, DollarSign, Tag, SlidersHorizontal, MoreHorizontal } from "lucide-react";
import { getVisibleStandardFields } from "@/lib/customFields";

export default function ProductTable({
  products = [],
  customFields = [],
  openSell,
  onEdit,
  onRestock,
  onLoad,
  onReturn,
  onDrop,
  onDelete,
  loading = false,
  canEdit = true,
  canDelete = true,
  canRestock = false,
  canLoad = false,
  tenantRole = "",
  searchQuery = "",
  onSearch,
}: {
  products?: ProductWithCustomData[];
  customFields?: CustomField[];
  openSell: (product: ProductWithCustomData) => void;
  onEdit?: (product: ProductWithCustomData) => void;
  onRestock?: (product: ProductWithCustomData) => void;
  onLoad?: (product: ProductWithCustomData) => void;
  onReturn?: (product: ProductWithCustomData) => void;
  onDrop?: (product: ProductWithCustomData) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canRestock?: boolean;
  canLoad?: boolean;
  tenantRole?: string;
  searchQuery?: string;
  onSearch: (value: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      onSearch(localSearch || "");
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, onSearch]);
  const allVisibleFields = getVisibleStandardFields(customFields);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const stockStatus = product.stock === 0 ? "out" : product.stock <= 5 ? "critical" : product.stock < 20 ? "low" : "in";
      const statusMatches = filterStatus === "all" || filterStatus === stockStatus;
      return statusMatches;
    });
  }, [products, filterStatus]);

  // Calculate total columns
  const totalCols = allVisibleFields.length + 2; // +1 for image +1 for actions

  const getStockDisplay = (product: ProductWithCustomData) => {
    const stockValue = Number(product.stock ?? 0);
    const remainderValue = Number(product.stockRemainder ?? product.stock_remainder ?? 0);
    const baseUnit = product.baseUnit?.trim() ?? product.base_unit?.trim();
    const convertedUnit = product.convertedUnit?.trim() ?? product.converted_unit?.trim();
    const conversionRate = Number(product.conversionRate ?? product.conversion_rate ?? 0);

    if (!baseUnit && !convertedUnit && conversionRate <= 0) {
      return `${stockValue}`;
    }

    if (baseUnit && convertedUnit && conversionRate > 0) {
      const totalConverted = stockValue * conversionRate + remainderValue;
      if (remainderValue > 0) {
        return `${stockValue} ${baseUnit} + ${remainderValue} ${convertedUnit} · ${totalConverted} ${convertedUnit}`;
      }
      return `${stockValue} ${baseUnit} · ${totalConverted} ${convertedUnit}`;
    }

    if (baseUnit) {
      return `${stockValue} ${baseUnit}`;
    }

    return `${stockValue}`;
  };

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
              {getStockDisplay(product)}
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

  const renderSecondaryActions = (product: ProductWithCustomData) => (
    <div className="flex flex-col gap-2 p-2">
      {canRestock && (
        <button
          type="button"
          onClick={() => onRestock?.(product)}
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10"
          title="Load goods into stock"
        >
          <Plus className="w-4 h-4" />
          Load
        </button>
      )}

      {canLoad && (
        <button
          type="button"
          onClick={() => onLoad?.(product)}
          disabled={product.stock === 0}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
            product.stock === 0
              ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
              : "border-amber-500/20 bg-amber-500/5 text-amber-200 hover:bg-amber-500/10"
          }`}
          title={product.stock === 0 ? "Out of stock" : "Take from stock"}
        >
          <Minus className="w-4 h-4" />
          Take
        </button>
      )}

      {onReturn && (tenantRole === "owner" || tenantRole === "sales") && (
        <button
          type="button"
          onClick={() => onReturn(product)}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/10"
          title="Return sold product to inventory"
        >
          ↩
          Return
        </button>
      )}

      {canLoad && tenantRole === "sales" && onDrop && (
        <button
          type="button"
          onClick={() => onDrop(product)}
          disabled={(product.allocated_quantity ?? 0) === 0}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
            (product.allocated_quantity ?? 0) === 0
              ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
              : "border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10"
          }`}
          title={
            (product.allocated_quantity ?? 0) === 0
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
          type="button"
          onClick={() => onEdit?.(product)}
          className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/10"
          title="Edit product"
        >
          <Edit className="w-4 h-4" />
          Edit
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete?.(product.id)}
          className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
          title="Delete product"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}
    </div>
  );

  const hasSecondaryActions =
    canRestock ||
    canLoad ||
    (onReturn && (tenantRole === "owner" || tenantRole === "sales")) ||
    (canLoad && tenantRole === "sales" && onDrop) ||
    canEdit ||
    canDelete;

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="inventory-search" className="sr-only">
              Search inventory
            </label>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-theme-accent">
              <Search className="h-5 w-5" />
            </span>
            <input
              id="inventory-search"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Search inventory by name, category, price..."
              className="w-full rounded-2xl border border-theme/50 bg-theme-surface px-4 py-3 pl-14 text-base text-theme-primary outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          <div className="relative flex shrink-0 items-center">
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

                    <div className="relative group">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-theme/40 bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-secondary transition hover:border-theme/60 hover:bg-theme/5"
                        title="More actions"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        More
                      </button>
                      <div className="invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto absolute right-0 z-20 mt-2 min-w-[12rem] rounded-2xl border border-theme/50 bg-theme-card p-2 shadow-soft transition-all duration-200">
                        {canRestock && (
                          <button
                            type="button"
                            onClick={() => onRestock?.(p)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-blue-200 transition hover:bg-blue-500/10"
                            title="Load goods into stock"
                          >
                            <Plus className="w-4 h-4" />
                            Load
                          </button>
                        )}

                        {canLoad && (
                          <button
                            type="button"
                            onClick={() => onLoad?.(p)}
                            disabled={p.stock === 0}
                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                              p.stock === 0
                                ? "cursor-not-allowed text-slate-500"
                                : "text-amber-200 hover:bg-amber-500/10"
                            }`}
                            title={p.stock === 0 ? "Out of stock" : "Take from stock"}
                          >
                            <Minus className="w-4 h-4" />
                            Take
                          </button>
                        )}

                        {onReturn && (tenantRole === "owner" || tenantRole === "sales") && (
                          <button
                            type="button"
                            onClick={() => onReturn(p)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-violet-200 transition hover:bg-violet-500/10"
                            title="Return sold product to inventory"
                          >
                            ↩
                            Return
                          </button>
                        )}

                        {canLoad && tenantRole === "sales" && onDrop && (
                          <button
                            type="button"
                            onClick={() => onDrop(p)}
                            disabled={(p.allocated_quantity ?? 0) === 0}
                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                              (p.allocated_quantity ?? 0) === 0
                                ? "cursor-not-allowed text-slate-500"
                                : "text-rose-200 hover:bg-rose-500/10"
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
                            type="button"
                            onClick={() => onEdit?.(p)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-amber-200 transition hover:bg-amber-400/10"
                            title="Edit product"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete?.(p.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
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
                    <div className="flex items-center justify-center">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
                      ) : (
                        <div className="w-20 h-20 bg-theme-surface rounded-lg flex items-center justify-center text-xs text-theme-secondary">No image</div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-foreground">{product.name}</div>
                        <span className="inline-flex rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sky-200">
                          {product.category || "Uncategorized"}
                        </span>
                      </div>

                      <div className="rounded-2xl bg-theme-surface p-3">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 text-theme-secondary">
                            <DollarSign className="w-4 h-4 text-sky-300" />
                            <span className="text-xs uppercase tracking-[0.15em]">Selling</span>
                          </div>
                          <div className="text-sm font-semibold text-foreground">${parseFloat(String(product.price ?? 0)).toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-theme-surface p-3">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 text-theme-secondary">
                            <Tag className="w-4 h-4 text-emerald-300" />
                            <span className="text-xs uppercase tracking-[0.15em]">Cost</span>
                          </div>
                          <div className="text-sm font-semibold text-foreground">${parseFloat(String(product.cost_price ?? 0)).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-2 text-center">
                      <div className="text-xs uppercase tracking-[0.15em] text-theme-secondary">Stock</div>
                      <div
                        className={`inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-sm font-semibold ${
                          product.stock === 0
                            ? "bg-red-500/20 text-red-300"
                            : product.stock < 10
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {product.stock}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const available = tenantRole === "sales" ? product.allocated_quantity ?? 0 : product.stock;
                        const disabled = available === 0;
                        return (
                          <button
                            onClick={() => !disabled && openSell(product)}
                            disabled={disabled}
                            className={`group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border text-sm font-semibold transition min-h-11 ${
                              disabled
                                ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                            }`}
                            title={
                              disabled
                                ? tenantRole === "sales"
                                  ? "No taken stock available"
                                  : "Out of stock"
                                : "Sell this product"
                            }
                          >
                            <ShoppingCart className="w-5 h-5" />
                            Sell
                          </button>
                        );
                      })()}

                      {canRestock && (
                        <button
                          onClick={() => onRestock?.(product)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 transition min-h-11"
                          title="Load goods into stock"
                        >
                          <Plus className="w-5 h-5" />
                          Load
                        </button>
                      )}

                      {canLoad && (
                        <button
                          onClick={() => onLoad?.(product)}
                          disabled={product.stock === 0}
                          className={`group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border text-sm font-semibold transition min-h-11 ${
                            product.stock === 0
                              ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                              : "border-amber-500/20 bg-amber-500/5 text-amber-200 hover:bg-amber-500/10"
                          }`}
                          title={product.stock === 0 ? "Out of stock" : "Take from stock"}
                        >
                          <Minus className="w-5 h-5" />
                          Take
                        </button>
                      )}

                      {onReturn && (tenantRole === "owner" || tenantRole === "sales") && (
                        <button
                          onClick={() => onReturn(product)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-sm font-semibold text-violet-200 hover:bg-violet-500/10 transition min-h-11"
                          title="Return sold product to inventory"
                        >
                          ↩
                          Return
                        </button>
                      )}

                      {canLoad && tenantRole === "sales" && onDrop && (
                        <button
                          onClick={() => onDrop(product)}
                          disabled={(product.allocated_quantity ?? 0) === 0}
                          className={`group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border text-sm font-semibold transition min-h-11 ${
                            (product.allocated_quantity ?? 0) === 0
                              ? "border-slate-700 bg-slate-950/40 text-slate-500 cursor-not-allowed"
                              : "border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10"
                          }`}
                          title={
                            (product.allocated_quantity ?? 0) === 0
                              ? "No taken stock available to drop"
                              : "Drop taken stock"
                          }
                        >
                          <Trash2 className="w-5 h-5" />
                          Drop
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={() => onEdit?.(product)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition min-h-11"
                          title="Edit product details"
                        >
                          <Edit className="w-5 h-5" />
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => onDelete?.(product.id)}
                          className="group inline-flex items-center justify-center gap-2 w-full px-3 py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 transition min-h-11"
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