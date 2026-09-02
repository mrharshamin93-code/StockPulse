import React, { useEffect, useMemo, useState } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Loader2, TrendingDown, TrendingUp } from "lucide-react";

import { getCandlesRange } from "@/lib/financialDatasets";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

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
  "1D": { resolution: "30", requestDays: 7, displayDays: 1 },
  "1W": { resolution: "D", requestDays: 14, displayDays: 7 },
  "1M": { resolution: "D", requestDays: 45, displayDays: 30 },
  "3M": { resolution: "D", requestDays: 110, displayDays: 90 },
  "6M": { resolution: "D", requestDays: 200, displayDays: 180 },
  YTD: { resolution: "D", requestDays: null, displayDays: null },
  "1Y": { resolution: "D", requestDays: 390, displayDays: 365 },
  "2Y": { resolution: "W", requestDays: 780, displayDays: 730 },
  "5Y": { resolution: "W", requestDays: 1900, displayDays: 1825 },
  "10Y": { resolution: "M", requestDays: 3720, displayDays: 3650 },
  All: { resolution: "M", requestDays: null, displayDays: null },
};

const MAX_RENDERED_POINTS = 180;
const FETCH_BATCH_SIZE = 5;
const EPSILON = 1e-8;

function getValidNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTransactionType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "buy" || type === "sell") return type;
  return null;
}

function normalizeHoldings(stocks) {
  const grouped = new Map();

  for (const stock of stocks || []) {
    const ticker = normalizeTicker(stock?.ticker);
    const quantity = getValidNumber(stock?.quantity);
    const purchasePrice = getValidNumber(stock?.purchase_price);
    const currentPrice = getValidNumber(stock?.current_price);
    const createdAt = getTimestamp(stock?.created_at);
    const updatedAt = getTimestamp(stock?.updated_at);

    if (
      !ticker ||
      quantity === null ||
      quantity <= 0 ||
      purchasePrice === null ||
      purchasePrice <= 0 ||
      createdAt === null
    ) {
      continue;
    }

    const existing = grouped.get(ticker) || {
      ticker,
      quantity: 0,
      totalCost: 0,
      createdAt,
      updatedAt: null,
      currentPrice: null,
    };

    existing.quantity += quantity;
    existing.totalCost += purchasePrice * quantity;
    existing.createdAt = Math.min(existing.createdAt, createdAt);

    if (
      currentPrice !== null &&
      currentPrice > 0 &&
      (existing.updatedAt === null || (updatedAt || createdAt) >= existing.updatedAt)
    ) {
      existing.currentPrice = currentPrice;
      existing.updatedAt = updatedAt || createdAt;
    }

    grouped.set(ticker, existing);
  }

  return Array.from(grouped.values()).map((holding) => ({
    ...holding,
    purchasePrice: holding.totalCost / holding.quantity,
  }));
}

function normalizeTransactions(rows) {
  return (rows || [])
    .map((row) => {
      const ticker = normalizeTicker(row?.ticker);
      const type = normalizeTransactionType(row?.type);
      const quantity = getValidNumber(row?.quantity);
      const price = getValidNumber(row?.price);
      const timestamp = getTimestamp(row?.created_at);

      if (
        !ticker ||
        !type ||
        quantity === null ||
        quantity <= 0 ||
        price === null ||
        price <= 0 ||
        timestamp === null
      ) {
        return null;
      }

      return {
        id: row?.id || `${ticker}-${timestamp}-${type}-${quantity}-${price}`,
        ticker,
        type,
        quantity,
        price,
        timestamp,
        synthetic: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function reconcileTransactionsWithHoldings(transactions, holdings) {
  const result = [...transactions];
  const byTicker = new Map();

  for (const transaction of transactions) {
    if (!byTicker.has(transaction.ticker)) byTicker.set(transaction.ticker, []);
    byTicker.get(transaction.ticker).push(transaction);
  }

  for (const holding of holdings) {
    const tickerTransactions = byTicker.get(holding.ticker) || [];
    const transactionQuantity = tickerTransactions.reduce((total, transaction) => {
      return total + (transaction.type === "buy" ? transaction.quantity : -transaction.quantity);
    }, 0);

    const difference = holding.quantity - transactionQuantity;

    if (Math.abs(difference) <= EPSILON) continue;

    result.push({
      id: `synthetic-${holding.ticker}-${holding.createdAt}`,
      ticker: holding.ticker,
      type: difference > 0 ? "buy" : "sell",
      quantity: Math.abs(difference),
      price: holding.purchasePrice,
      timestamp: holding.createdAt,
      synthetic: true,
    });
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

function getRequestBounds(period, earliestActivity) {
  const now = Math.floor(Date.now() / 1000);
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG["1M"];

  if (period === "YTD") {
    const currentDate = new Date();
    const yearStart = Math.floor(
      Date.UTC(currentDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0) / 1000,
    );

    return {
      from: yearStart,
      to: now,
      resolution: config.resolution,
      provisionalChartStart: yearStart,
    };
  }

  if (period === "All") {
    const from = Math.max(1, earliestActivity - 7 * 86400);
    return {
      from,
      to: now,
      resolution: config.resolution,
      provisionalChartStart: earliestActivity,
    };
  }

  return {
    from: now - config.requestDays * 86400,
    to: now,
    resolution: config.resolution,
    provisionalChartStart: now - config.displayDays * 86400,
  };
}

async function fetchTransactions(userId, signal) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("stock_transactions")
    .select("id,ticker,type,quantity,price,total,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  if (error) {
    throw new Error(error.message || "Unable to load portfolio transactions.");
  }

  return normalizeTransactions(data);
}

async function fetchTickerHistory({ ticker, period, resolution, from, to, signal }) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const payload = await getCandlesRange({
    ticker,
    period,
    resolution,
    from,
    to,
  });

  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const candles = Array.isArray(payload?.candles) ? payload.candles : [];

  return candles
    .map((candle) => {
      const timestamp = getValidNumber(candle?.t);
      const close = getValidNumber(candle?.c);
      if (timestamp === null || close === null || close <= 0) return null;
      return { timestamp: Math.floor(timestamp), price: close };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchHistories({ tickers, period, bounds, signal }) {
  const result = new Map();

  for (let index = 0; index < tickers.length; index += FETCH_BATCH_SIZE) {
    const batch = tickers.slice(index, index + FETCH_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const points = await fetchTickerHistory({
            ticker,
            period,
            resolution: bounds.resolution,
            from: bounds.from,
            to: bounds.to,
            signal,
          });
          return { ticker, points };
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          console.warn(`Portfolio history unavailable for ${ticker}:`, error?.message || error);
          return { ticker, points: [] };
        }
      }),
    );

    for (const item of batchResults) result.set(item.ticker, item.points);
  }

  return result;
}

function getNewYorkSessionDate(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function getChartStart({ period, histories, provisionalChartStart }) {
  if (period !== "1D") return provisionalChartStart;

  let latestTimestamp = null;
  for (const points of histories.values()) {
    const latest = points.at(-1)?.timestamp;
    if (Number.isFinite(latest) && (latestTimestamp === null || latest > latestTimestamp)) {
      latestTimestamp = latest;
    }
  }

  if (latestTimestamp === null) return provisionalChartStart;

  const latestSession = getNewYorkSessionDate(latestTimestamp);
  if (!latestSession) return provisionalChartStart;

  let firstSessionPoint = null;
  for (const points of histories.values()) {
    for (const point of points) {
      if (getNewYorkSessionDate(point.timestamp) !== latestSession) continue;
      if (firstSessionPoint === null || point.timestamp < firstSessionPoint) {
        firstSessionPoint = point.timestamp;
      }
    }
  }

  return firstSessionPoint ?? provisionalChartStart;
}

function findPriceAtOrBefore(series, timestamp) {
  let low = 0;
  let high = series.length - 1;
  let result = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = series[middle];
    if (point.timestamp <= timestamp) {
      result = point.price;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function formatChartLabel(timestamp, period) {
  const date = new Date(timestamp * 1000);

  if (period === "1D") {
    return date.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (period === "1W") {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    });
  }

  if (["1M", "3M", "6M", "YTD"].includes(period)) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    });
  }

  if (period === "10Y" || period === "All") {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    year: "2-digit",
  });
}

function buildPriceSeries({ ticker, histories, transactions, holding, chartStart, chartEnd }) {
  const points = [];

  for (const point of histories.get(ticker) || []) {
    if (point.timestamp >= chartStart && point.timestamp <= chartEnd) points.push(point);
  }

  for (const transaction of transactions) {
    if (
      transaction.ticker === ticker &&
      transaction.timestamp >= chartStart &&
      transaction.timestamp <= chartEnd
    ) {
      points.push({ timestamp: transaction.timestamp, price: transaction.price });
    }
  }

  if (
    holding?.currentPrice &&
    holding.currentPrice > 0 &&
    holding.updatedAt &&
    holding.updatedAt >= chartStart &&
    holding.updatedAt <= chartEnd
  ) {
    points.push({ timestamp: holding.updatedAt, price: holding.currentPrice });
  }

  const byTimestamp = new Map();
  for (const point of points) byTimestamp.set(point.timestamp, point);

  return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function getStateAtTimestamp({ timestamp, transactions, priceSeriesByTicker }) {
  const quantities = new Map();
  let cumulativeBuys = 0;
  let cumulativeSells = 0;

  for (const transaction of transactions) {
    if (transaction.timestamp > timestamp) break;

    const currentQuantity = quantities.get(transaction.ticker) || 0;

    if (transaction.type === "buy") {
      quantities.set(transaction.ticker, currentQuantity + transaction.quantity);
      cumulativeBuys += transaction.quantity * transaction.price;
    } else {
      quantities.set(transaction.ticker, Math.max(0, currentQuantity - transaction.quantity));
      cumulativeSells += transaction.quantity * transaction.price;
    }
  }

  let marketValue = 0;
  let hasOpenPosition = false;
  let incomplete = false;

  for (const [ticker, quantity] of quantities.entries()) {
    if (quantity <= EPSILON) continue;
    hasOpenPosition = true;
    const price = findPriceAtOrBefore(priceSeriesByTicker.get(ticker) || [], timestamp);
    if (price === null) {
      incomplete = true;
      continue;
    }
    marketValue += quantity * price;
  }

  const gain = marketValue + cumulativeSells - cumulativeBuys;
  const gainPct = cumulativeBuys > 0 ? (gain / cumulativeBuys) * 100 : null;

  return {
    marketValue,
    cumulativeBuys,
    cumulativeSells,
    gain,
    gainPct,
    hasOpenPosition,
    incomplete,
  };
}

function buildPortfolioData({
  holdings,
  transactions,
  histories,
  chartStart,
  chartEnd,
  period,
}) {
  const holdingMap = new Map(holdings.map((holding) => [holding.ticker, holding]));
  const tickerSet = new Set([
    ...holdings.map((holding) => holding.ticker),
    ...transactions.map((transaction) => transaction.ticker),
  ]);

  const priceSeriesByTicker = new Map();
  for (const ticker of tickerSet) {
    priceSeriesByTicker.set(
      ticker,
      buildPriceSeries({
        ticker,
        histories,
        transactions,
        holding: holdingMap.get(ticker),
        chartStart,
        chartEnd,
      }),
    );
  }

  const timestampSet = new Set([chartEnd]);

  for (const series of priceSeriesByTicker.values()) {
    for (const point of series) {
      if (point.timestamp >= chartStart && point.timestamp <= chartEnd) {
        timestampSet.add(point.timestamp);
      }
    }
  }

  for (const transaction of transactions) {
    if (transaction.timestamp >= chartStart && transaction.timestamp <= chartEnd) {
      timestampSet.add(transaction.timestamp);
    }
  }

  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);
  const data = [];

  for (const timestamp of timestamps) {
    const state = getStateAtTimestamp({
      timestamp,
      transactions,
      priceSeriesByTicker,
    });

    if (state.cumulativeBuys <= 0) continue;
    if (state.incomplete && state.hasOpenPosition) continue;

    data.push({
      timestamp,
      label: formatChartLabel(timestamp, period),
      value: Math.round(state.marketValue * 100) / 100,
      gain: Math.round(state.gain * 100) / 100,
      gainPct: state.gainPct,
      contributed: Math.round(state.cumulativeBuys * 100) / 100,
      withdrawn: Math.round(state.cumulativeSells * 100) / 100,
    });
  }

  if (!data.length) return { data: [] };

  if (data.length <= MAX_RENDERED_POINTS) return { data };

  const step = Math.ceil(data.length / MAX_RENDERED_POINTS);
  const reduced = data.filter((_, index) => index % step === 0);
  const finalPoint = data.at(-1);
  if (reduced.at(-1)?.timestamp !== finalPoint.timestamp) reduced.push(finalPoint);

  return { data: reduced };
}

function formatCurrency(value) {
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatYAxisValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  if (Math.abs(numericValue) >= 1_000_000) return `$${(numericValue / 1_000_000).toFixed(1)}M`;
  if (Math.abs(numericValue) >= 1000) return `$${(numericValue / 1000).toFixed(0)}k`;
  return `$${numericValue.toFixed(0)}`;
}

function PortfolioTooltip({ active = false, payload = [], label = "" }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const value = Number(point?.value);
  const gain = Number(point?.gain);
  const gainPct = Number(point?.gainPct);

  if (!Number.isFinite(value)) return null;

  const positive = !Number.isFinite(gain) || gain >= 0;

  return (
    <div className="min-w-[160px] rounded-xl border border-border bg-card px-4 py-3 text-foreground shadow-lg">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-bold text-foreground">{formatCurrency(value)}</p>
      {Number.isFinite(gain) && Number.isFinite(gainPct) && (
        <p className={`mt-1 text-xs font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "+" : "-"}
          {formatCurrency(Math.abs(gain))} ({positive ? "+" : ""}{gainPct.toFixed(2)}%)
        </p>
      )}
    </div>
  );
}

function PeriodButton({ value, currentPeriod, onSelect }) {
  const active = value === currentPeriod;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        "flex h-[27px] min-w-0 flex-1 items-center justify-center rounded-[7px] px-0.5 text-[9.5px] font-semibold tracking-[-0.15px] transition-[transform,background-color,color] duration-150 active:scale-[0.96]",
        active ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
      ].join(" ")}
    >
      {value}
    </button>
  );
}

export default function PortfolioGrowthChart({ stocks = [] }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState("1M");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const holdings = useMemo(() => normalizeHoldings(stocks), [stocks]);

  useEffect(() => {
    if (!user?.id) {
      setChartData([]);
      setError("");
      return undefined;
    }

    if (holdings.length === 0) {
      setChartData([]);
      setError("Enter a valid quantity, purchase price, and purchase date for each holding.");
      return undefined;
    }

    const controller = new AbortController();

    async function loadChart() {
      setLoading(true);
      setError("");

      try {
        const rawTransactions = await fetchTransactions(user.id, controller.signal);
        const transactions = reconcileTransactionsWithHoldings(rawTransactions, holdings);

        if (!transactions.length) {
          throw new Error("No portfolio transaction history is available yet.");
        }

        const earliestActivity = Math.min(
          ...transactions.map((transaction) => transaction.timestamp),
          ...holdings.map((holding) => holding.createdAt),
        );

        const bounds = getRequestBounds(period, earliestActivity);
        const tickers = Array.from(
          new Set([
            ...holdings.map((holding) => holding.ticker),
            ...transactions.map((transaction) => transaction.ticker),
          ]),
        );

        const histories = await fetchHistories({
          tickers,
          period,
          bounds,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const chartStart = getChartStart({
          period,
          histories,
          provisionalChartStart: bounds.provisionalChartStart,
        });

        const result = buildPortfolioData({
          holdings,
          transactions,
          histories,
          chartStart,
          chartEnd: bounds.to,
          period,
        });

        if (result.data.length < 1) {
          throw new Error("Not enough verified price history is available for this range.");
        }

        setChartData(result.data);
      } catch (loadError) {
        if (loadError?.name === "AbortError") return;

        console.error("Portfolio growth load failed:", loadError);
        setChartData([]);
        setError(loadError?.message || "Unable to load portfolio history.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadChart();
    return () => controller.abort();
  }, [holdings, period, user?.id]);

  const latestPoint = chartData.at(-1) || null;
  const latestValue = latestPoint?.value ?? null;
  const periodGain = latestPoint?.gain ?? null;
  const periodGainPct = Number.isFinite(Number(latestPoint?.gainPct))
    ? Number(latestPoint.gainPct)
    : null;

  const isPositive = periodGain === null || periodGain >= 0;
  const chartColor = isPositive ? "#10b981" : "#ef4444";
  const gradientId = "portfolioGrowthGradient";

  return (
    <section className="rounded-[22px] bg-card p-5 text-foreground">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Portfolio Growth
        </p>

        <p className="text-[28px] font-bold tracking-[-0.7px] text-foreground">
          {latestValue !== null ? formatCurrency(latestValue) : "—"}
        </p>

        {periodGain !== null && periodGainPct !== null && (
          <p className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
            {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {isPositive ? "+" : "-"}
            {formatCurrency(Math.abs(periodGain))} ({isPositive ? "+" : ""}{periodGainPct.toFixed(2)}%)
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Portfolio value uses your actual buy and sell history. Performance excludes new capital added from being counted as investment gains.
      </p>

      <div className="mt-4 flex w-full items-center gap-[2px]">
        {PERIODS.map((periodOption) => (
          <PeriodButton
            key={periodOption}
            value={periodOption}
            currentPeriod={period}
            onSelect={setPeriod}
          />
        ))}
      </div>

      <div className="mt-4 h-[270px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-5 text-center">
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 0, bottom: 2 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.16} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />

              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={formatYAxisValue}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={46}
              />

              <Tooltip content={<PortfolioTooltip />} />

              <Area
                type="linear"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={chartData.length === 1 ? { r: 3 } : false}
                activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
