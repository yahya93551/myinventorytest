"use client";

import type { ReactNode } from "react";
import { Product } from "@/types";
import { Package, DollarSign, TrendingUp, Zap } from "lucide-react";

type StatsCard = {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtext?: string;
  trend?: "up" | "down";
};

export default function StatsCards({ products, visibleFieldNames }: { products: Product[]; visibleFieldNames?: string[] }) {
  const total = products.length;
  const totalCost = products.reduce((acc, p) => acc + (p.cost_price ?? 0) * p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const potentialProfit = Math.max(0, totalSellValue - totalCost);
  const profitMargin = totalSellValue > 0 ? ((potentialProfit / totalSellValue) * 100).toFixed(1) : "0";

  const showCost = visibleFieldNames ? visibleFieldNames.includes("cost_price") : true;
  const showSell = visibleFieldNames ? visibleFieldNames.includes("price") : true;
  const showProfit = showCost && showSell;

  const cards: StatsCard[] = [
    {
      title: "Total Products",
      value: total,
      icon: <Package className="w-5 h-5" />,
      subtext: "In inventory",
    },
  ];

  if (showCost) {
    cards.push({
      title: "Inventory Cost",
      value: `$${totalCost.toFixed(2)}`,
      icon: <DollarSign className="w-5 h-5" />,
      subtext: "Total cost value",
    });
  }

  if (showSell) {
    cards.push({
      title: "Sell Value",
      value: `$${totalSellValue.toFixed(2)}`,
      icon: <Zap className="w-5 h-5" />,
      subtext: "If sold today",
    });
  }

  if (showProfit) {
    cards.push({
      title: "Potential Profit",
      value: `$${potentialProfit.toFixed(2)}`,
      icon: <TrendingUp className="w-5 h-5" />,
      subtext: `${profitMargin}% margin`,
      trend: "up",
    });
  }

  const StatCard = ({ title, value, icon, subtext, trend }: StatsCard) => (
    <div className="card-standard hover:shadow-hover hover:bg-theme-surface group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-body-sm text-theme-secondary font-medium">{title}</p>
          <h2 className="text-h3 font-bold text-theme-primary mt-2">{value}</h2>
          {subtext && (
            <p className="text-body-sm text-theme-muted mt-1">{subtext}</p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/25 transition-all duration-200">
          {icon}
        </div>
      </div>
      {trend === "up" && (
        <div className="mt-3 flex items-center gap-1 text-green-400 text-xs font-semibold">
          <TrendingUp className="w-4 h-4" />
          Positive trend
        </div>
      )}
    </div>
  );

  return (
    <div className="grid-cards mb-8">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}