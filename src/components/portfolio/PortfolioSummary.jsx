// src/components/portfolio/PortfolioSummary.jsx

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
    }
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
      stock?.quantity
    );

    const purchasePrice =
      getValidNumber(
        stock?.purchase_price
      );

    const currentPrice =
      getValidNumber(
        stock?.current_price
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
              totalValue
            )
          : "—",

      icon: Wallet,

      color:
        "text-foreground",
    },

    {
      label: "Total Return",

      value:
        gainPct !== null
          ? `${
              isPositive
                ? "+"
                : ""
            }${gainPct.toFixed(
              2
            )}%`
          : "—",

      icon: BarChart3,

      color:
        gainPct === null
          ? "text-muted-foreground"
          : isPositive
            ? "text-emerald-600"
            : "text-red-600",
    },

    {
      label: "Total Growth",

      value:
        totalGain !== null
          ? `${
              isPositive
                ? "+"
                : "-"
            }${formatCurrency(
              Math.abs(
                totalGain
              )
            )}`
          : "—",

      icon:
        totalGain === null ||
        isPositive
          ? TrendingUp
          : TrendingDown,

      color:
        totalGain === null
          ? "text-muted-foreground"
          : isPositive
            ? "text-emerald-600"
            : "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 p-2">
      {stats.map((stat) => {
        const Icon =
          stat.icon;

        return (
          <div
            key={stat.label}
            className="
              flex
              min-w-0
              flex-col
              items-center
              justify-center
              rounded-[18px]
              bg-background/45
              px-2
              py-4
              text-center
              transition-colors
              duration-150
            "
          >
            <div className="mb-1.5 flex min-w-0 items-center justify-center gap-1">
              <Icon
                size={13}
                strokeWidth={2}
                className="shrink-0 text-muted-foreground"
              />

              <span
                className="
                  truncate
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.07em]
                  text-muted-foreground
                "
              >
                {stat.label}
              </span>
            </div>

            <p
              className={[
                "max-w-full truncate text-[15px] font-bold tracking-[-0.25px]",
                stat.color,
              ].join(" ")}
            >
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
