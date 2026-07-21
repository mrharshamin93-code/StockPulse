import React from "react";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

function getValidNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function formatCurrency(value) {
  return `$${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

export default function PortfolioSummary({
  stocks = [],
}) {
  let totalValue = 0;
  let totalCost = 0;
  let marketPricesAvailable =
    stocks.length > 0;

  for (const stock of stocks) {
    const quantity = getValidNumber(
      stock?.quantity,
    );

    const purchasePrice =
      getValidNumber(
        stock?.purchase_price,
      );

    const currentPrice =
      getValidNumber(
        stock?.current_price,
      );

    if (
      quantity === null ||
      quantity < 0 ||
      purchasePrice === null ||
      purchasePrice < 0
    ) {
      marketPricesAvailable = false;
      continue;
    }

    totalCost +=
      purchasePrice * quantity;

    if (
      currentPrice === null ||
      currentPrice <= 0
    ) {
      marketPricesAvailable = false;
      continue;
    }

    totalValue +=
      currentPrice * quantity;
  }

  const totalGain =
    marketPricesAvailable
      ? totalValue - totalCost
      : null;

  const gainPct =
    marketPricesAvailable &&
    totalCost > 0
      ? (totalGain / totalCost) *
        100
      : null;

  const isPositive =
    totalGain !== null &&
    totalGain >= 0;

  const stats = [
    {
      label: "Portfolio Value",
      value:
        marketPricesAvailable
          ? formatCurrency(
              totalValue,
            )
          : "—",
      icon: Wallet,
      color: "text-gray-900",
    },
    {
      label: "Total Return",
      value:
        gainPct !== null
          ? `${
              isPositive ? "+" : ""
            }${gainPct.toFixed(
              2,
            )}%`
          : "—",
      icon: BarChart3,
      color:
        gainPct === null
          ? "text-gray-400"
          : isPositive
            ? "text-emerald-600"
            : "text-red-600",
    },
    {
      label: "Total Growth",
      value:
        totalGain !== null
          ? `${
              isPositive ? "+" : "-"
            }${formatCurrency(
              Math.abs(
                totalGain,
              ),
            )}`
          : "—",
      icon:
        totalGain === null ||
        isPositive
          ? TrendingUp
          : TrendingDown,
      color:
        totalGain === null
          ? "text-gray-400"
          : isPositive
            ? "text-emerald-600"
            : "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <stat.icon className="h-3.5 w-3.5 text-gray-400" />

            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              {stat.label}
            </span>
          </div>

          <p
            className={`font-heading text-base font-bold ${stat.color}`}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
