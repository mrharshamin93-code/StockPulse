import React from "react";
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export default function PortfolioSummary({ stocks = [] }) {
  const totalValue = stocks.reduce((sum, s) => {
    return sum + ((s.current_price || s.purchase_price || 0) * (s.quantity || 0));
  }, 0);

  const totalCost = stocks.reduce((sum, s) => {
    return sum + ((s.purchase_price || 0) * (s.quantity || 0));
  }, 0);

  const totalGain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const isPositive = totalGain >= 0;

  const stats = [
    {
      label: "Portfolio Value",
      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Wallet,
      color: "text-gray-900"
    },
    {
      label: "Total Return",
      value: `${isPositive ? "+" : ""}${gainPct.toFixed(2)}%`,
      icon: BarChart3,
      color: isPositive ? "text-emerald-600" : "text-red-600"
    },
    {
      label: "Total Growth",
      value: `${isPositive ? "+" : ""}$${totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? "text-emerald-600" : "text-red-600"
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div 
          key={stat.label} 
          className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <stat.icon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
              {stat.label}
            </span>
          </div>
          <p className={`text-base font-heading font-bold ${stat.color}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
