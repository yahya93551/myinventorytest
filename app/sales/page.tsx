"use client";

import { useInventory } from "../../hooks/useInventory";

export default function SalesPage() {
  const { sales } = useInventory();
  const total = sales.reduce((a, s) => a + s.total, 0);

  return (
    <div className="p-6 text-white">
      <h2 className="text-3xl mb-4">Sales History</h2>

      <p className="mb-4 text-xl">
        Total Revenue: ${total}
      </p>

      <div className="bg-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="p-3">Product</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-white/10">
                <td className="p-3">{s.productName}</td>
                <td>{s.quantity}</td>
                <td>${s.total}</td>
                <td>{new Date(s.date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}