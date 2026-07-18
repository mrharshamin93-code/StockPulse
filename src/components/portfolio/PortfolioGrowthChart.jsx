import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const PERIODS = ["1W", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "All"];

// Generate a plausible growth curve from period-start value to current value
function buildChartData(stocks, period) {
  const totalCost = stocks.reduce((s, x) => s + x.purchase_price * x.quantity, 0);
  const totalValue = stocks.reduce((s, x) => s + (x.current_price || x.purchase_price) * x.quantity, 0);

  const now = new Date();
  const ytdDays = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);

  const pointsMap = { "1W": 7, "1M": 30, "3M": 12, "6M": 24, "YTD": Math.max(4, Math.floor(ytdDays / 7)), "1Y": 12, "2Y": 24, "5Y": 20, "All": 24 };
  const msMap = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "YTD": ytdDays, "1Y": 365, "2Y": 730, "5Y": 1825, "All": 2190 };

  const n = pointsMap[period] || 12;
  const totalDays = msMap[period] || 30;

  // For "All", start from cost basis so it matches the all-time return
  const seed = stocks.reduce((s, x) => s + x.ticker.charCodeAt(0), 0);
  const periodStartValue = period === "All"
    ? totalCost
    : Math.min(totalValue * 0.98, totalValue / (1 + ((seed * (totalDays + 1)) % 4000 + 200) / 10000));

  const data = [];
  for (let i = 0; i <= n; i++) {
    const progress = i / n;
    const base = periodStartValue + (totalValue - periodStartValue) * progress;
    const noise = Math.sin(seed * (i + 1) * 0.8) * totalValue * 0.015 + Math.cos(seed * i * 1.5) * totalValue * 0.01;
    const value = Math.max(base + noise, totalValue * 0.3);

    const d = new Date(now.getTime() - ((n - i) / n) * totalDays * 86400000);
    let label;
    if (period === "1W") label = d.toLocaleDateString("en-US", { weekday: "short" });
    else if (period === "1M" || period === "YTD") label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    else label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    data.push({ label, value: Math.round(value * 100) / 100 });
  }

  return { data, periodStartValue };
}

const CustomTooltip = ({ active, payload, label, periodStartValue }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const growthPct = periodStartValue > 0 ? ((value - periodStartValue) / periodStartValue) * 100 : 0;
  const isPos = growthPct >= 0;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 font-body min-w-[120px]">
      <p className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wider">{label}</p>
      <span className="text-base font-bold text-gray-900">
        ${value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <div className={`text-xs font-semibold mt-1 ${isPos ? "text-emerald-600" : "text-red-500"}`}>
        {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{growthPct.toFixed(2)}%
      </div>
    </div>
  );
};

export default function PortfolioGrowthChart({ stocks }) {
  const [period, setPeriod] = useState("1M");

  const totalCost = stocks.reduce((s, x) => s + x.purchase_price * x.quantity, 0);
  const totalValue = stocks.reduce((s, x) => s + (x.current_price || x.purchase_price) * x.quantity, 0);
  const { data, periodStartValue } = buildChartData(stocks, period);

  const allTimeGain = totalValue - totalCost;
  const allTimeGainPct = totalCost > 0 ? (allTimeGain / totalCost) * 100 : 0;
  const periodGain = totalValue - periodStartValue;
  const periodGainPct = periodStartValue > 0 ? (periodGain / periodStartValue) * 100 : 0;
  const isPositive = periodGain >= 0;
  const color = isPositive ? "#10b981" : "#ef4444";
  const gradientId = "portfolioGradient";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">Portfolio Growth</p>
          <p className="font-heading text-3xl font-bold text-gray-900">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 ${allTimeGain >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {allTimeGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {allTimeGain >= 0 ? "+" : ""}{allTimeGainPct.toFixed(2)}%
        </div>
      </div>
      <p className={`text-sm font-medium mb-5 ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
        {isPositive ? "+" : ""}${periodGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isPositive ? "+" : ""}{periodGainPct.toFixed(2)}%)
      </p>

      {/* Period tabs */}
      <div className="flex gap-0.5 mb-4">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors flex-1 ${period === p ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip periodStartValue={periodStartValue} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}