"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BulkSellModal from "@/app/inventory/BulkSellModal";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Product, Sale } from "../../types";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function SellMultiplePage() {
  const { loading } = useRequireAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingProducts(true);
      try {
        const res = await apiGet<Product[]>('/api/products?limit=1000');
        // API may return { products, count } or direct array. Handle both.
        const payload = res?.data as any;
        const items: Product[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.products)
          ? payload.products
          : [];
        setProducts(items);
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to load products' });
      } finally {
        setLoadingProducts(false);
      }
    };

    if (!loading) load();
  }, [loading]);

  const handleConfirm = async (items: Array<{ productId: string; quantity: number }>, metadata?: Record<string, any>) => {
    try {
      const res = await apiPost('/api/sales/bulk', { items, metadata });
      if (res.success) {
        setMessage({ type: 'success', text: 'Bulk sale completed successfully.' });
        return true;
      }
      setMessage({ type: 'error', text: res.error || 'Bulk sale failed' });
      return false;
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Bulk sale failed' });
      return false;
    }
  };

  const showMessage = (type: "success" | "error", text: string) => setMessage({ type, text });

  return (
    <div className="min-h-screen bg-theme-bg text-theme-primary">
      <Sidebar />
      <main className="p-6 lg:pl-72">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-semibold mb-4">Sell Multiple Items</h1>
          <p className="mb-6 text-theme-secondary">A dedicated page for selling multiple items at once. Uses the existing bulk sell UI.</p>

          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-700/20 text-green-300' : 'bg-red-700/20 text-red-300'}`}>
              {message.text}
            </div>
          )}

          <BulkSellModal
            isOpen={true}
            pageMode={true}
            products={products}
            onClose={() => window.history.back()}
            onConfirm={handleConfirm}
            showMessage={showMessage}
          />

          {loadingProducts && <p className="text-theme-secondary">Loading products...</p>}
        </div>
      </main>
    </div>
  );
}
