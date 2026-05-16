"use client";

import type { ReactNode } from "react";
import { Product } from "@/types";
import { Package, DollarSign } from "lucide-react";

type StatsCard = {
  title: string;
  value: string | number;
  icon: ReactNode;
};

export default function StatsCards({ products, visibleFieldNames }: { products: Product[]; visibleFieldNames?: string[] }) {
  const total = products.length;
  const totalCost = products.reduce((acc, p) => acc + (p.cost_price ?? 0) * p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const potentialProfit = Math.max(0, totalSellValue - totalCost);

  const showCost = visibleFieldNames ? visibleFieldNames.includes("cost_price") : true;
  const showSell = visibleFieldNames ? visibleFieldNames.includes("price") : true;
  const showProfit = showCost && showSell;

  const cards: StatsCard[] = [
    {
      title: "Total Products",
      value: total,
      icon: <Package size={24} />,
    },
  ];

  if (showCost) {
    cards.push({
      title: "Inventory Cost",
      value: `$${totalCost.toFixed(2)}`,
      icon: <DollarSign size={24} />,
    });
  }

  if (showSell) {
    cards.push({
      title: "Inventory Sell Value",
      value: `$${totalSellValue.toFixed(2)}`,
      icon: <DollarSign size={24} />,
    });
  }

  if (showProfit) {
    cards.push({
      title: "Potential Profit",
      value: `$${potentialProfit.toFixed(2)}`,
      icon: <DollarSign size={24} />,
    });
  }

  const Card = ({ title, value, icon }: any) => (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-lg flex items-center gap-4">
      <div className="text-cyan-400">
        {icon}
      </div>
      <div>
        <p className="text-gray-300 text-sm">{title}</p>
        <h2 className="text-2xl font-bold text-white mt-1">{value}</h2>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title} title={card.title} value={card.value} icon={card.icon} />
      ))}
    </div>
  );
}