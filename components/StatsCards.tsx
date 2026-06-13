"use client";

import type { ReactNode } from "react";
import { Product } from "@/types";
import { Package, DollarSign, TrendingUp, Zap } from "lucide-react";

type StatsCard = {
  title: string;
  value: string | number;
  fullValue?: string;
  icon: ReactNode;
  subtext?: string;
  trend?: "up" | "down";
};

type OwnerMetrics = {
  taken_not_sold_total?: number;
  taken_not_sold_count?: number;
  unpaid_debts_total?: number;
  unpaid_debts_count?: number;
};

export default function StatsCards({ products, visibleFieldNames, ownerMetrics }: { products: Product[]; visibleFieldNames?: string[]; ownerMetrics?: OwnerMetrics }) {
  const total = products.length;
  const totalCost = products.reduce((acc, p) => acc + (p.cost_price ?? 0) * p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const potentialProfit = Math.max(0, totalSellValue - totalCost);
  const profitMargin = totalSellValue > 0 ? ((potentialProfit / totalSellValue) * 100).toFixed(1) : "0";

  const formatCurrencyShort = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
    if (abs >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `$${value.toFixed(0)}`;
  };

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
      value: formatCurrencyShort(totalCost),
      fullValue: `$${totalCost.toFixed(2)}`,
      icon: <DollarSign className="w-5 h-5" />,
      subtext: "Total cost value",
    });
  }

  if (showSell) {
    cards.push({
      title: "Sell Value",
      value: formatCurrencyShort(totalSellValue),
      fullValue: `$${totalSellValue.toFixed(2)}`,
      icon: <Zap className="w-5 h-5" />,
      subtext: "If sold today",
    });
  }

  if (showProfit) {
    cards.push({
      title: "Potential Profit",
      value: formatCurrencyShort(potentialProfit),
      fullValue: `$${potentialProfit.toFixed(2)}`,
      icon: <TrendingUp className="w-5 h-5" />,
      subtext: `${profitMargin}% margin`,
      trend: "up",
    });
  }

  // Owner-only metrics (taken but not sold, unpaid debts)
  if (ownerMetrics) {
    if (typeof ownerMetrics.taken_not_sold_total === "number") {
      cards.push({
        title: "Taken (not sold)",
        value: ownerMetrics.taken_not_sold_total,
        icon: <Package className="w-5 h-5" />,
        subtext: `${ownerMetrics.taken_not_sold_count ?? 0} allocations`,
      });
    }

    if (typeof ownerMetrics.unpaid_debts_total === "number") {
      cards.push({
        title: "Unpaid Debts",
        value: `$${(ownerMetrics.unpaid_debts_total || 0).toFixed(2)}`,
        icon: <DollarSign className="w-5 h-5" />,
        subtext: `${ownerMetrics.unpaid_debts_count ?? 0} unpaid`,
      });
    }
  }

  const StatCard = ({ title, value, fullValue, icon, subtext, trend }: StatsCard) => (
    <div className="card-compact px-3 py-3 hover:shadow-hover hover:bg-theme-surface group min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-theme-secondary font-medium">{title}</p>
          <h2 className="text-lg sm:text-xl font-bold text-theme-primary mt-2" title={fullValue}>{value}</h2>
          {subtext && (
            <p className="text-xs text-theme-muted mt-1 truncate">{subtext}</p>
          )}
        </div>
        <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/25 transition-all duration-200">
          {icon}
        </div>
      </div>
      {trend === "up" && (
        <div className="mt-2 flex items-center gap-1 text-green-400 text-[11px] font-semibold">
          <TrendingUp className="w-4 h-4" />
          Positive trend
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}