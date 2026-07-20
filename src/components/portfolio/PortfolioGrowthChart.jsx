import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PERIODS = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "2Y",
  "5Y",
  "10Y",
  "All",
];

const PERIOD_CONFIG = {
  "1D": {
    points: 24,
    totalDays: 1,
  },
  "1W": {
    points: 7,
    totalDays: 7,
  },
  "1M": {
    points: 30,
    totalDays: 30,
  },
  "3M": {
    points: 12,
    totalDays: 90,
  },
  "6M": {
    points: 24,
    totalDays: 180,
  },
  YTD: {
    points: null,
    totalDays: null,
  },
  "1Y": {
    points: 12,
    totalDays: 365,
  },
  "2Y": {
    points: 24,
    totalDays: 730,
  },
  "5Y": {
    points: 20,
    totalDays: 1825,
  },
  "10Y": {
    points: 40,
    totalDays: 3650,
  },
  All: {
    points: 48,
    totalDays: 7300,
  },
};

function getNumericValue(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatChartLabel(date, period) {
  if (period === "1D") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (period === "1W") {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
    });
  }

  if (
    period === "1M" ||
    period === "3M" ||
    period === "6M" ||
    period === "YTD"
  ) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (period === "10Y" || period === "All") {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function buildChartData(stocks, period) {
  const totalCost = stocks.reduce(
    (sum, stock) =>
      sum +
      getNumericValue(stock.purchase_price) *
        getNumericValue(stock.quantity),
    0
  );

  const totalValue = stocks.reduce(
    (sum, stock) => {
      const currentPrice =
        getNumericValue(stock.current_price) ||
        getNumericValue(stock.purchase_price);

      return (
        sum +
        currentPrice *
          getNumericValue(stock.quantity)
      );
    },
    0
  );

  const now = new Date();

  const startOfYear = new Date(
    now.getFullYear(),
    0,
    1
  );

  const ytdDays = Math.max(
    1,
    Math.floor(
      (now.getTime() -
        startOfYear.getTime()) /
        86400000
    )
  );

  const config =
    PERIOD_CONFIG[period] ||
    PERIOD_CONFIG["1M"];

  const numberOfPoints =
    period === "YTD"
      ? Math.max(
          4,
          Math.floor(ytdDays / 7)
        )
      : config.points;

  const totalDays =
    period === "YTD"
      ? ytdDays
      : config.totalDays;

  const seed = stocks.reduce(
    (sum, stock) => {
      const normalizedTicker = String(
        stock?.ticker || ""
      );

      return (
        sum +
        (normalizedTicker.charCodeAt(0) ||
          0)
      );
    },
    0
  );

  /*
   * The portfolio chart currently builds a stable,
   * deterministic curve between the selected
   * period's starting value and the current value.
   */
  const periodStartValue =
    period === "All"
      ? totalCost
      : Math.min(
          totalValue * 0.98,
          totalValue /
            (1 +
              (((seed *
                (totalDays + 1)) %
                4000) +
                200) /
                10000)
        );

  const data = [];

  for (
    let index = 0;
    index <= numberOfPoints;
    index += 1
  ) {
    const progress =
      index / numberOfPoints;

    const baseValue =
      periodStartValue +
      (totalValue -
        periodStartValue) *
        progress;

    const periodVolatility =
      period === "1D"
        ? 0.003
        : period === "1W"
          ? 0.006
          : period === "10Y" ||
              period === "All"
            ? 0.012
            : 0.015;

    const noise =
      Math.sin(
        seed *
          (index + 1) *
          0.8
      ) *
        totalValue *
        periodVolatility +
      Math.cos(
        seed *
          index *
          1.5
      ) *
        totalValue *
        (periodVolatility *
          0.65);

    const minimumValue =
      totalValue > 0
        ? totalValue * 0.3
        : 0;

    const value = Math.max(
      baseValue + noise,
      minimumValue
    );

    const date = new Date(
      now.getTime() -
        ((numberOfPoints -
          index) /
          numberOfPoints) *
          totalDays *
          86400000
    );

    data.push({
      timestamp: date.getTime(),
      label: formatChartLabel(
        date,
        period
      ),
      value:
        Math.round(value * 100) /
        100,
    });
  }

  return {
    data,
    periodStartValue,
    totalValue,
    totalCost,
  };
}

function CustomTooltip({
  active,
  payload,
  label,
  periodStartValue,
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  const value = Number(
    payload[0]?.value
  );

  if (!Number.isFinite(value)) {
    return null;
  }

  const growthPct =
    periodStartValue > 0
      ? ((value -
          periodStartValue) /
          periodStartValue) *
        100
      : 0;

  const isPositive =
    growthPct >= 0;

  return (
    <div className="min-w-[120px] rounded-xl border border-gray-200 bg-white px-4 py-3 font-body shadow-lg">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <span className="text-base font-bold text-gray-900">
        $
        {value.toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
      </span>

      <div
        className={`mt-1 text-xs font-semibold ${
          isPositive
            ? "text-emerald-600"
            : "text-red-500"
        }`}
      >
        {isPositive ? "▲" : "▼"}{" "}
        {isPositive ? "+" : ""}
        {growthPct.toFixed(2)}%
      </div>
    </div>
  );
}

function formatYAxisValue(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "$0";
  }

  if (
    Math.abs(numericValue) >=
    1_000_000
  ) {
    return `$${(
      numericValue / 1_000_000
    ).toFixed(1)}M`;
  }

  if (
    Math.abs(numericValue) >=
    1000
  ) {
    return `$${(
      numericValue / 1000
    ).toFixed(0)}k`;
  }

  return `$${numericValue.toFixed(
    0
  )}`;
}

export default function PortfolioGrowthChart({
  stocks = [],
}) {
  const [period, setPeriod] =
    useState("1M");

  const {
    data,
    periodStartValue,
    totalValue,
    totalCost,
  } = useMemo(
    () =>
      buildChartData(
        stocks,
        period
      ),
    [stocks, period]
  );

  const allTimeGain =
    totalValue - totalCost;

  const allTimeGainPct =
    totalCost > 0
      ? (allTimeGain /
          totalCost) *
        100
      : 0;

  const periodGain =
    totalValue -
    periodStartValue;

  const periodGainPct =
    periodStartValue > 0
      ? (periodGain /
          periodStartValue) *
        100
      : 0;

  const isPositive =
    periodGain >= 0;

  const color = isPositive
    ? "#10b981"
    : "#ef4444";

  const gradientId =
    "portfolioGradient";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Portfolio Growth
          </p>

          <p className="font-heading text-3xl font-bold text-gray-900">
            $
            {totalValue.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </p>
        </div>

        <div
          className={`mt-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            allTimeGain >= 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {allTimeGain >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}

          {allTimeGain >= 0
            ? "+"
            : ""}
          {allTimeGainPct.toFixed(
            2
          )}
          %
        </div>
      </div>

      <p
        className={`mb-5 text-sm font-medium ${
          isPositive
            ? "text-emerald-600"
            : "text-red-600"
        }`}
      >
        {isPositive ? "+" : "-"}$
        {Math.abs(
          periodGain
        ).toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}{" "}
        (
        {isPositive ? "+" : ""}
        {periodGainPct.toFixed(
          2
        )}
        %)
      </p>

      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map(
          (periodOption) => (
            <button
              key={
                periodOption
              }
              type="button"
              onClick={() =>
                setPeriod(
                  periodOption
                )
              }
              className={`min-w-[38px] shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                period ===
                periodOption
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {periodOption}
            </button>
          )
        )}
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <AreaChart
            data={data}
            margin={{
              top: 4,
              right: 4,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={
                    color
                  }
                  stopOpacity={
                    0.15
                  }
                />

                <stop
                  offset="95%"
                  stopColor={
                    color
                  }
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f3f4f6"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              tick={{
                fontSize: 10,
                fill: "#9ca3af",
              }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />

            <YAxis
              domain={[
                "auto",
                "auto",
              ]}
              tickFormatter={
                formatYAxisValue
              }
              tick={{
                fontSize: 10,
                fill: "#9ca3af",
              }}
              tickLine={false}
              axisLine={false}
              width={44}
            />

            <Tooltip
              content={
                <CustomTooltip
                  periodStartValue={
                    periodStartValue
                  }
                />
              }
            />

            <Area
              type="linear"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: color,
                strokeWidth: 0,
              }}
              isAnimationActive={
                false
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
