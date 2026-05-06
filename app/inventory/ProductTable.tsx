import { Product } from "../../types";
import { ShoppingCart, Plus, Edit, Trash2 } from "lucide-react";

export default function ProductTable({
  products = [],
  openSell,
  onEdit,
  onRestock,
  onDelete,
  loading = false,
}: {
  products?: Product[];
  openSell: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onRestock?: (product: Product) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}) {
  return (
    <div className="w-full max-h-[70vh] overflow-auto rounded-2xl bg-white/10">

      <table className="min-w-[800px] w-full text-sm">

        <thead className="sticky top-0 bg-slate-900 z-10">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3 text-left">Price</th>
            <th className="p-3 text-left">Stock</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-gray-400">
                <div className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Loading products...
                </div>
              </td>
            </tr>
          ) : products.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-400">
                No inventory items found.
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.id} className="border-t border-white/10">

                <td className="p-3 whitespace-nowrap">{p.name}</td>
                <td className="p-3 whitespace-nowrap">{p.category}</td>
                <td className="p-3 whitespace-nowrap">${p.price}</td>
                <td className="p-3 whitespace-nowrap">{p.stock}</td>

                <td className="p-3 flex flex-wrap gap-2">

                  <button
                    onClick={() => p.stock > 0 && openSell(p)}
                    className={`flex items-center gap-1 ${p.stock === 0 ? "text-gray-500 cursor-not-allowed" : "text-green-400"}`}
                    disabled={p.stock === 0}
                  >
                    <ShoppingCart size={16} />
                    {p.stock === 0 ? "Out of stock" : "Sell"}
                  </button>

                  <button
                    onClick={() => onRestock?.(p)}
                    className="text-indigo-400 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Restock
                  </button>

                  <button
                    onClick={() => onEdit?.(p)}
                    className="text-yellow-400 flex items-center gap-1"
                  >
                    <Edit size={16} />
                    Edit
                  </button>

                  <button
                    onClick={() => onDelete?.(p.id)}
                    className="text-red-400 flex items-center gap-1"
                  >
                    <Trash2 size={16} />
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