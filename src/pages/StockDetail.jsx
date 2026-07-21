import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
    resolution: "5",
    daysBack: 1,
  },
  "1W": {
    resolution: "60",
    daysBack: 7,
  },
  "1M": {
    resolution: "D",
    daysBack: 30,
  },
  "3M": {
    resolution: "D",
    daysBack: 90,
  },
  "6M": {
    resolution: "D",
    daysBack: 180,
  },
  YTD: {
    resolution: "D",
    daysBack: null,
  },
  "1Y": {
    resolution: "D",
    daysBack: 365,
  },
  "2Y": {
    resolution: "W",
    daysBack: 730,
  },
  "5Y": {
    resolution: "W",
    daysBack: 1825,
  },
  "10Y": {
    resolution: "M",
    daysBack: 3650,
  },
  All: {
    resolution: "M",
    daysBack: 7300,
  },
};

const TOOLTIP_HIDE_DELAY = 2500;

function normalizePrefetchedQuote(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const currentPrice = Number(
    value.c ??
      value.currentPrice ??
      value.current_price ??
      value.price,
  );

  const previousClose = Number(
    value.pc ??
      value.previousClose ??
      value.previous_close,
  );

  const dailyPercent = Number(
    value.dp ??
      value.dailyGain ??
      value.dailyPercent ??
      value.changePercent ??
      value.change_percent,
  );

  const dailyChange = Number(
    value.d ??
      value.dailyChange ??
      value.change,
  );

  const normalized = {
    c: Number.isFinite(currentPrice)
      ? currentPrice
      : null,
    pc: Number.isFinite(previousClose)
      ? previousClose
      : null,
    dp: Number.isFinite(dailyPercent)
      ? dailyPercent
      : null,
    d: Number.isFinite(dailyChange)
      ? dailyChange
      : null,
  };

  return Object.values(
    normalized,
  ).some(Number.isFinite)
    ? normalized
    : null;
}

async function finnhubProxy(body, signal) {
  const response = await fetch("/api/finnhub", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        `API request failed with status ${response.status}`,
    );
  }

  return payload;
}

function getPeriodBounds(period) {
  const config =
    PERIOD_CONFIG[period] ||
    PERIOD_CONFIG["1M"];

  const to = Math.floor(
    Date.now() / 1000,
  );

  if (period === "YTD") {
    const now = new Date();

    const from = Math.floor(
      new Date(
        now.getFullYear(),
        0,
        1,
        0,
        0,
        0,
        0,
      ).getTime() / 1000,
    );

    return {
      from,
      to,
      resolution: config.resolution,
    };
  }

  return {
    from:
      to -
      config.daysBack * 86400,
    to,
    resolution: config.resolution,
  };
}

function formatChartLabel(
  timestamp,
  period,
) {
  const date = new Date(
    timestamp * 1000,
  );

  if (period === "1D") {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    );
  }

  if (
    [
      "1W",
      "1M",
      "3M",
      "6M",
      "YTD",
    ].includes(period)
  ) {
    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "2-digit",
    },
  );
}

function getTimestampKey(
  timestamp,
  period,
) {
  const date = new Date(
    timestamp * 1000,
  );

  if (period === "1D") {
    const minutes =
      date.getUTCMinutes();

    const bucketMinutes =
      Math.floor(minutes / 5) * 5;

    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      bucketMinutes,
    );
  }

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

async function fetchChartData(
  ticker,
  period,
  signal,
) {
  const {
    from,
    to,
    resolution,
  } = getPeriodBounds(period);

  const result = await finnhubProxy(
    {
      action: "candles_range",
      ticker,
      resolution,
      from,
      to,
    },
    signal,
  );

  const candles = Array.isArray(
    result?.candles,
  )
    ? result.candles
    : [];

  const points = candles
    .map((candle) => ({
      timestamp: Number(candle?.t),
      value: Number(candle?.v),
    }))
    .filter(
      (point) =>
        Number.isFinite(
          point.timestamp,
        ) &&
        Number.isFinite(
          point.value,
        ),
    )
    .sort(
      (a, b) =>
        a.timestamp - b.timestamp,
    );

  if (points.length < 2) {
    throw new Error(
      `No chart data returned for ${ticker} (${period})`,
    );
  }

  return points.map((point) => ({
    timestamp: point.timestamp,
    key: getTimestampKey(
      point.timestamp,
      period,
    ),
    label: formatChartLabel(
      point.timestamp,
      period,
    ),
    value: point.value,
  }));
}

function calculatePeriodReturn(points) {
  const first = points.find(
    (point) =>
      Number.isFinite(point?.value),
  );

  const last = [...points]
    .reverse()
    .find((point) =>
      Number.isFinite(point?.value),
    );

  if (
    !first ||
    !last ||
    first.value === 0
  ) {
    return null;
  }

  return (
    ((last.value - first.value) /
      first.value) *
    100
  );
}

function mergeComparisonData(
  primary,
  comparison,
) {
  const comparisonMap = new Map(
    comparison.map((point) => [
      point.key,
      point.value,
    ]),
  );

  const merged = primary
    .map((point) => ({
      ...point,
      comparisonValue:
        comparisonMap.get(
          point.key,
        ) ?? null,
    }))
    .filter(
      (point) =>
        Number.isFinite(
          point.value,
        ) &&
        Number.isFinite(
          point.comparisonValue,
        ),
    );

  if (merged.length < 2) {
    return [];
  }

  const primaryBase =
    merged[0].value;

  const comparisonBase =
    merged[0].comparisonValue;

  if (
    !Number.isFinite(
      primaryBase,
    ) ||
    primaryBase === 0 ||
    !Number.isFinite(
      comparisonBase,
    ) ||
    comparisonBase === 0
  ) {
    return [];
  }

  return merged.map((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    primaryReturn:
      ((point.value -
        primaryBase) /
        primaryBase) *
      100,
    comparisonReturn:
      ((point.comparisonValue -
        comparisonBase) /
        comparisonBase) *
      100,
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
  compareTicker,
  ticker,
  periodStartPrice,
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-gray-500">
        {label}
      </p>

      {payload.map((entry) => {
        const value = Number(
          entry.value,
        );

        const isComparison =
          Boolean(compareTicker);

        const growthPct =
          isComparison
            ? value
            : periodStartPrice > 0
              ? ((value -
                  periodStartPrice) /
                  periodStartPrice) *
                100
              : 0;

        const positive =
          growthPct >= 0;

        return (
          <div
            key={entry.dataKey}
            className="flex min-w-[150px] items-center justify-between gap-4 text-xs"
          >
            <span className="font-medium text-gray-600">
              {entry.name || ticker}
            </span>

            <span className="font-semibold text-gray-900">
              {isComparison
                ? `${
                    positive ? "+" : ""
                  }${value.toFixed(2)}%`
                : `$${value.toFixed(2)}`}

              {!isComparison && (
                <span
                  className={`ml-2 ${
                    positive
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {positive ? "▲" : "▼"}{" "}
                  {positive ? "+" : ""}
                  {growthPct.toFixed(2)}%
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StockChart({
  ticker,
  currentPrice,
  fallbackPositive,
  activePeriod,
  onPeriodChange,
  onPeriodReturnChange,
  onDailyReturnChange,
  initialDailyReturn,
}) {
  const [compareTicker, setCompareTicker] =
    useState("");

  const [compareInput, setCompareInput] =
    useState("");

  const [showInput, setShowInput] =
    useState(false);

  const [chartData, setChartData] =
    useState([]);

  const [chartLoading, setChartLoading] =
    useState(false);

  const [chartError, setChartError] =
    useState("");

  const [primaryReturn, setPrimaryReturn] =
    useState(
      activePeriod === "1D" &&
        Number.isFinite(
          initialDailyReturn,
        )
        ? initialDailyReturn
        : null,
    );

  const [tooltipVisible, setTooltipVisible] =
    useState(false);

  const tooltipTimerRef = useRef(null);

  function clearTooltipTimer() {
    if (tooltipTimerRef.current) {
      window.clearTimeout(
        tooltipTimerRef.current,
      );

      tooltipTimerRef.current = null;
    }
  }

  function hideTooltip() {
    clearTooltipTimer();
    setTooltipVisible(false);
  }

  function showTooltipTemporarily() {
    clearTooltipTimer();
    setTooltipVisible(true);

    tooltipTimerRef.current =
      window.setTimeout(() => {
        setTooltipVisible(false);
        tooltipTimerRef.current = null;
      }, TOOLTIP_HIDE_DELAY);
  }

  useEffect(() => {
    return () => {
      clearTooltipTimer();
    };
  }, []);

  useEffect(() => {
    hideTooltip();

    const fallbackReturn =
      activePeriod === "1D" &&
      Number.isFinite(
        initialDailyReturn,
      )
        ? initialDailyReturn
        : null;

    setPrimaryReturn(fallbackReturn);
    onPeriodReturnChange(
      fallbackReturn,
    );

    const controller =
      new AbortController();

    async function loadChart() {
      setChartLoading(true);
      setChartError("");

      try {
        const primary =
          await fetchChartData(
            ticker,
            activePeriod,
            controller.signal,
          );

        const nextReturn =
          calculatePeriodReturn(primary);

        setPrimaryReturn(nextReturn);
        onPeriodReturnChange(
          nextReturn,
        );

        if (
          activePeriod === "1D" &&
          Number.isFinite(nextReturn)
        ) {
          onDailyReturnChange(
            nextReturn,
          );
        }

        if (compareTicker) {
          const comparison =
            await fetchChartData(
              compareTicker,
              activePeriod,
              controller.signal,
            );

          const merged =
            mergeComparisonData(
              primary,
              comparison,
            );

          if (merged.length < 2) {
            throw new Error(
              `Could not align ${ticker} and ${compareTicker} chart dates`,
            );
          }

          setChartData(merged);
        } else {
          setChartData(
            primary.map((point) => ({
              timestamp:
                point.timestamp,
              label: point.label,
              primaryValue:
                point.value,
            })),
          );
        }
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Chart load failed:",
          error,
        );

        setChartData([]);
        setPrimaryReturn(
          fallbackReturn,
        );
        onPeriodReturnChange(
          fallbackReturn,
        );

        if (
          activePeriod === "1D" &&
          !Number.isFinite(
            initialDailyReturn,
          )
        ) {
          onDailyReturnChange(null);
        }

        setChartError(
          error?.message ||
            "Unable to load chart data",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setChartLoading(false);
        }
      }
    }

    loadChart();

    return () =>
      controller.abort();
  }, [
    ticker,
    activePeriod,
    compareTicker,
    onPeriodReturnChange,
    onDailyReturnChange,
    initialDailyReturn,
  ]);

  const periodStartPrice =
    useMemo(() => {
      if (compareTicker) {
        return 0;
      }

      return (
        chartData.find((point) =>
          Number.isFinite(
            point.primaryValue,
          ),
        )?.primaryValue ||
        currentPrice ||
        0
      );
    }, [
      chartData,
      compareTicker,
      currentPrice,
    ]);

  const chartPositive =
    Number.isFinite(primaryReturn)
      ? primaryReturn >= 0
      : fallbackPositive;

  const primaryColor =
    chartPositive
      ? "#10b981"
      : "#ef4444";

  const compareColor = "#6366f1";

  function handleAddCompare(event) {
    event.preventDefault();

    const normalized =
      compareInput
        .trim()
        .toUpperCase();

    if (
      normalized &&
      normalized !==
        ticker.toUpperCase()
    ) {
      setCompareTicker(normalized);
    }

    setCompareInput("");
    setShowInput(false);
  }

  function selectPeriod(period) {
    hideTooltip();

    const fallbackReturn =
      period === "1D" &&
      Number.isFinite(
        initialDailyReturn,
      )
        ? initialDailyReturn
        : null;

    setPrimaryReturn(fallbackReturn);
    onPeriodReturnChange(
      fallbackReturn,
    );
    onPeriodChange(period);
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-gray-900">
          Price Chart
        </h2>

        <span
          className={`text-sm font-semibold ${
            Number.isFinite(primaryReturn)
              ? primaryReturn >= 0
                ? "text-emerald-600"
                : "text-red-600"
              : "text-gray-400"
          }`}
        >
          {Number.isFinite(primaryReturn)
            ? `${
                primaryReturn >= 0
                  ? "+"
                  : ""
              }${primaryReturn.toFixed(2)}%`
            : "—"}
        </span>

        {compareTicker && (
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600">
            {ticker} vs {compareTicker}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() =>
              selectPeriod(period)
            }
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              activePeriod === period
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {period}
          </button>
        ))}

        {!compareTicker &&
          !showInput && (
            <button
              type="button"
              onClick={() =>
                setShowInput(true)
              }
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <Plus className="h-3 w-3" />
              Compare
            </button>
          )}

        {showInput && (
          <form
            onSubmit={handleAddCompare}
            className="ml-auto flex items-center gap-1"
          >
            <Input
              value={compareInput}
              onChange={(event) =>
                setCompareInput(
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="TICKER"
              className="h-7 w-24 px-2 text-xs uppercase"
              maxLength={8}
              autoFocus
            />

            <Button
              type="submit"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              Add
            </Button>

            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setCompareInput("");
              }}
              className="text-gray-400 hover:text-gray-900"
              aria-label="Cancel comparison"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        )}

        {compareTicker && (
          <button
            type="button"
            onClick={() => {
              hideTooltip();
              setCompareTicker("");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-3.5 w-3.5" />
            Remove comparison
          </button>
        )}
      </div>

      {compareTicker && (
        <p className="mb-2 text-xs text-gray-400">
          Showing percentage return from the first shared trading date.
        </p>
      )}

      <div className="relative h-[300px] w-full">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        )}

        {chartError ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Chart unavailable
              </p>

              <p className="mt-1 max-w-md text-xs text-gray-400">
                {chartError}
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 8,
                bottom: 0,
                left: 0,
              }}
              onMouseMove={
                showTooltipTemporarily
              }
              onMouseLeave={hideTooltip}
              onTouchStart={
                showTooltipTemporarily
              }
              onTouchMove={
                showTooltipTemporarily
              }
              onTouchEnd={() => {
                clearTooltipTimer();

                tooltipTimerRef.current =
                  window.setTimeout(
                    () => {
                      setTooltipVisible(
                        false,
                      );

                      tooltipTimerRef.current =
                        null;
                    },
                    TOOLTIP_HIDE_DELAY,
                  );
              }}
            >
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{
                  fontSize: 10,
                  fill: "#9ca3af",
                }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(value) =>
                  compareTicker
                    ? `${value.toFixed(0)}%`
                    : `$${value.toFixed(0)}`
                }
                tick={{
                  fontSize: 10,
                  fill: "#9ca3af",
                }}
                tickLine={false}
                axisLine={false}
                width={48}
              />

              <Tooltip
                active={tooltipVisible}
                isAnimationActive={false}
                content={
                  <ChartTooltip
                    compareTicker={
                      compareTicker
                    }
                    ticker={ticker}
                    periodStartPrice={
                      periodStartPrice
                    }
                  />
                }
              />

              <Line
                type="monotone"
                dataKey={
                  compareTicker
                    ? "primaryReturn"
                    : "primaryValue"
                }
                name={ticker}
                stroke={primaryColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {compareTicker && (
                <Line
                  type="monotone"
                  dataKey="comparisonReturn"
                  name={compareTicker}
                  stroke={compareColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {compareTicker &&
        !chartError && (
          <div className="mt-3 flex items-center gap-5 text-xs text-gray-500">
            <span className="font-medium">
              {ticker}
            </span>

            <span className="font-medium">
              {compareTicker}
            </span>
          </div>
        )}
    </section>
  );
}

function BuyDetailDialog({
  open,
  onOpenChange,
  stock,
  onDone,
}) {
  const [quantity, setQuantity] =
    useState("");

  const [price, setPrice] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (open) {
      setPrice(
        stock?.current_price?.toFixed(
          2,
        ) ||
          stock?.purchase_price?.toFixed(
            2,
          ) ||
          "",
      );
    }
  }, [open, stock]);

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedQuantity =
      Number(quantity);

    const parsedPrice = Number(price);

    if (
      !(parsedQuantity > 0) ||
      !(parsedPrice > 0)
    ) {
      return;
    }

    setLoading(true);

    try {
      await onDone(
        parsedQuantity,
        parsedPrice,
      );

      setQuantity("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Buy {stock?.ticker}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          {stock?.company_name}
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="buy-quantity">
              Shares
            </Label>

            <Input
              id="buy-quantity"
              type="number"
              min="0.000001"
              step="any"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value,
                )
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="buy-price">
              Purchase Price
            </Label>

            <Input
              id="buy-price"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) =>
                setPrice(
                  event.target.value,
                )
              }
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Buy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellDetailDialog({
  open,
  onOpenChange,
  stock,
  onDone,
}) {
  const [quantity, setQuantity] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const max =
    Number(stock?.quantity) || 0;

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedQuantity =
      Number(quantity);

    if (
      !(parsedQuantity > 0) ||
      parsedQuantity > max
    ) {
      return;
    }

    setLoading(true);

    try {
      await onDone(parsedQuantity);
      setQuantity("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Sell {stock?.ticker}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          {stock?.company_name} · {max}{" "}
          shares held
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="sell-quantity">
              Shares to Sell
            </Label>

            <div className="relative">
              <Input
                id="sell-quantity"
                type="number"
                min="0.000001"
                max={max}
                step="any"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                className="pr-12"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    String(max),
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-900"
              >
                all
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockDetail() {
  const { ticker: routeValue } =
    useParams();

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const {
    quotes = {},
    fetchQuotes,
  } = useMarketData();

  const [stock, setStock] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [news, setNews] =
    useState([]);

  const [newsLoading, setNewsLoading] =
    useState(false);

  const [buyOpen, setBuyOpen] =
    useState(false);

  const [sellOpen, setSellOpen] =
    useState(false);

  const [activePeriod, setActivePeriod] =
    useState("1D");

  const [periodReturn, setPeriodReturn] =
    useState(null);

  const [dailyReturn, setDailyReturn] =
    useState(null);

  const isTickerRoute =
    routeValue?.startsWith(
      "ticker-",
    );

  const tickerFromRoute =
    isTickerRoute
      ? routeValue
          .replace("ticker-", "")
          .toUpperCase()
      : null;

  const stockId = isTickerRoute
    ? null
    : routeValue;

  const routeStateQuote =
    normalizePrefetchedQuote(
      location.state?.quote ??
        location.state?.cachedQuote ??
        location.state?.marketQuote ??
        location.state?.marketData ??
        location.state,
    );

  const routeStateTicker = String(
    location.state?.ticker ||
      location.state?.symbol ||
      "",
  )
    .trim()
    .toUpperCase();

  const routeStateCompanyName =
    location.state?.companyName ||
    location.state?.company_name ||
    "";

  function handleBack() {
    const hasPreviousAppPage =
      typeof window !== "undefined" &&
      Number(
        window.history.state?.idx,
      ) > 0;

    if (hasPreviousAppPage) {
      navigate(-1);
      return;
    }

    navigate(
      isTickerRoute
        ? "/watchlist"
        : "/home",
      {
        replace: true,
      },
    );
  }

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadStock() {
      setLoading(true);
      setPageError("");
      setActivePeriod("1D");
      setPeriodReturn(null);

      const cachedTicker =
        tickerFromRoute ||
        routeStateTicker;

      const cachedQuote =
        routeStateQuote ||
        normalizePrefetchedQuote(
          quotes[cachedTicker],
        );

      if (
        Number.isFinite(
          cachedQuote?.dp,
        )
      ) {
        setDailyReturn(
          cachedQuote.dp,
        );
      } else {
        setDailyReturn(null);
      }

      if (
        isTickerRoute &&
        Number.isFinite(
          cachedQuote?.c,
        ) &&
        cachedQuote.c > 0
      ) {
        setStock({
          ticker: tickerFromRoute,
          company_name:
            routeStateCompanyName ||
            tickerFromRoute,
          sector: "",
          logo_url: "",
          current_price:
            cachedQuote.c,
          purchase_price:
            Number.isFinite(
              cachedQuote.pc,
            )
              ? cachedQuote.pc
              : cachedQuote.c,
          quantity: 0,
          _watchlistOnly: true,
        });

        setLoading(false);
      }

      try {
        if (isTickerRoute) {
          const [quote, profile] =
            await Promise.all([
              finnhubProxy(
                {
                  action: "quote",
                  ticker:
                    tickerFromRoute,
                },
                controller.signal,
              ),
              finnhubProxy(
                {
                  action: "profile",
                  ticker:
                    tickerFromRoute,
                },
                controller.signal,
              ),
            ]);

          const resolvedQuote =
            normalizePrefetchedQuote(
              quote,
            ) ||
            cachedQuote;

          if (
            Number.isFinite(
              resolvedQuote?.dp,
            )
          ) {
            setDailyReturn(
              resolvedQuote.dp,
            );
          }

          setStock({
            ticker: tickerFromRoute,
            company_name:
              profile?.name ||
              tickerFromRoute,
            sector:
              profile?.finnhubIndustry ||
              "",
            logo_url:
              profile?.logo || "",
            current_price:
              Number(
                resolvedQuote?.c,
              ) || 0,
            purchase_price:
              Number(
                resolvedQuote?.pc ||
                  resolvedQuote?.c,
              ) || 0,
            quantity: 0,
            _watchlistOnly: true,
          });
        } else {
          const { data, error } =
            await supabase
              .from("stocks")
              .select("*")
              .eq("id", stockId)
              .single();

          if (error) {
            throw error;
          }

          if (data) {
            const normalizedTicker =
              String(
                data.ticker || "",
              )
                .trim()
                .toUpperCase();

            const cachedPortfolioQuote =
              routeStateQuote ||
              normalizePrefetchedQuote(
                quotes[
                  normalizedTicker
                ],
              );

            if (
              Number.isFinite(
                cachedPortfolioQuote?.dp,
              )
            ) {
              setDailyReturn(
                cachedPortfolioQuote.dp,
              );
            }

            setStock({
              ...data,
              current_price:
                Number.isFinite(
                  cachedPortfolioQuote?.c,
                ) &&
                cachedPortfolioQuote.c >
                  0
                  ? cachedPortfolioQuote.c
                  : data.current_price,
              _watchlistOnly:
                false,
            });
          } else {
            setStock(null);
          }
        }
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Stock detail load failed:",
          error,
        );

        setStock(null);

        setPageError(
          error?.message ||
            "Unable to load stock",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    loadStock();

    return () =>
      controller.abort();
  }, [
    isTickerRoute,
    stockId,
    tickerFromRoute,
  ]);


  useEffect(() => {
    const normalizedTicker =
      String(stock?.ticker || "")
        .trim()
        .toUpperCase();

    if (!normalizedTicker) {
      return undefined;
    }

    let active = true;

    function applyQuote(value) {
      if (!active) {
        return;
      }

      const quote =
        normalizePrefetchedQuote(
          value,
        );

      if (!quote) {
        return;
      }

      if (
        Number.isFinite(quote.dp)
      ) {
        setDailyReturn(quote.dp);
      }

      if (
        Number.isFinite(quote.c) &&
        quote.c > 0
      ) {
        setStock((previous) => {
          if (
            !previous ||
            previous.ticker
              ?.toUpperCase() !==
              normalizedTicker
          ) {
            return previous;
          }

          return {
            ...previous,
            current_price: quote.c,
            purchase_price:
              previous._watchlistOnly &&
              Number.isFinite(
                quote.pc,
              )
                ? quote.pc
                : previous.purchase_price,
          };
        });
      }
    }

    const stateQuoteMatches =
      !routeStateTicker ||
      routeStateTicker ===
        normalizedTicker;

    if (
      stateQuoteMatches &&
      routeStateQuote
    ) {
      applyQuote(routeStateQuote);
    }

    applyQuote(
      quotes[normalizedTicker],
    );

    fetchQuotes([
      normalizedTicker,
    ])
      .then((result) => {
        applyQuote(
          result?.[
            normalizedTicker
          ] ||
            quotes[
              normalizedTicker
            ],
        );
      })
      .catch((error) => {
        console.warn(
          "Stock detail quote prefetch failed:",
          error,
        );
      });

    return () => {
      active = false;
    };
  }, [
    stock?.ticker,
    fetchQuotes,
  ]);

  useEffect(() => {
    if (!stock?.ticker) {
      return undefined;
    }

    const controller =
      new AbortController();

    async function loadNews() {
      setNewsLoading(true);

      try {
        const result =
          await finnhubProxy(
            {
              action: "news",
              ticker: stock.ticker,
            },
            controller.signal,
          );

        setNews(
          Array.isArray(
            result?.articles,
          )
            ? result.articles
            : [],
        );
      } catch (error) {
        if (
          error?.name !==
          "AbortError"
        ) {
          console.warn(
            "News fetch failed:",
            error,
          );

          setNews([]);
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setNewsLoading(false);
        }
      }
    }

    loadNews();

    return () =>
      controller.abort();
  }, [stock?.ticker]);

  async function refreshNews() {
    if (!stock?.ticker) {
      return;
    }

    setNewsLoading(true);

    try {
      const result =
        await finnhubProxy({
          action: "news",
          ticker: stock.ticker,
        });

      setNews(
        Array.isArray(
          result?.articles,
        )
          ? result.articles
          : [],
      );
    } catch (error) {
      console.warn(
        "News refresh failed:",
        error,
      );

      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  }

  async function handleBuyDone(
    quantity,
    price,
  ) {
    if (!user || !stock) {
      return;
    }

    const oldQuantity =
      Number(stock.quantity) || 0;

    const oldAverageCost =
      Number(
        stock.purchase_price,
      ) || 0;

    const newQuantity =
      oldQuantity + quantity;

    const newAverageCost =
      oldQuantity
        ? (oldAverageCost *
            oldQuantity +
            price * quantity) /
          newQuantity
        : price;

    let currentPrice = price;

    try {
      const quote =
        await finnhubProxy({
          action: "quote",
          ticker: stock.ticker,
        });

      if (Number(quote?.c) > 0) {
        currentPrice =
          Number(quote.c);
      }
    } catch (error) {
      console.warn(
        "Quote refresh failed during buy:",
        error,
      );
    }

    const {
      error: transactionError,
    } = await supabase
      .from("stock_transactions")
      .insert({
        user_id: user.id,
        ticker:
          stock.ticker.toUpperCase(),
        company_name:
          stock.company_name,
        type: "buy",
        quantity,
        price,
        total: quantity * price,
      });

    if (transactionError) {
      console.warn(
        "Transaction log failed:",
        transactionError,
      );
    }

    if (stock._watchlistOnly) {
      const { data, error } =
        await supabase
          .from("stocks")
          .insert({
            user_id: user.id,
            ticker:
              stock.ticker.toUpperCase(),
            company_name:
              stock.company_name,
            quantity,
            purchase_price: price,
            current_price:
              currentPrice,
            sector:
              stock.sector || "",
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      setStock({
        ...data,
        _watchlistOnly: false,
      });

      setBuyOpen(false);
      return;
    }

    const { data, error } =
      await supabase
        .from("stocks")
        .update({
          quantity: newQuantity,
          purchase_price:
            +newAverageCost.toFixed(
              4,
            ),
          current_price:
            currentPrice,
        })
        .eq("id", stockId)
        .select()
        .single();

    if (error) {
      throw error;
    }

    setStock({
      ...data,
      _watchlistOnly: false,
    });

    setBuyOpen(false);
  }

  async function handleSellDone(
    quantity,
  ) {
    if (
      !user ||
      !stock ||
      stock._watchlistOnly
    ) {
      return;
    }

    const heldQuantity =
      Number(stock.quantity) || 0;

    const sellPrice =
      Number(stock.current_price) ||
      Number(stock.purchase_price) ||
      0;

    const soldQuantity = Math.min(
      quantity,
      heldQuantity,
    );

    const remainingQuantity =
      +Math.max(
        0,
        heldQuantity - soldQuantity,
      ).toFixed(6);

    const {
      error: transactionError,
    } = await supabase
      .from("stock_transactions")
      .insert({
        user_id: user.id,
        ticker:
          stock.ticker.toUpperCase(),
        company_name:
          stock.company_name,
        type: "sell",
        quantity: soldQuantity,
        price: sellPrice,
        total:
          soldQuantity * sellPrice,
      });

    if (transactionError) {
      console.warn(
        "Transaction log failed:",
        transactionError,
      );
    }

    if (remainingQuantity <= 0) {
      const { error } =
        await supabase
          .from("stocks")
          .delete()
          .eq("id", stockId);

      if (error) {
        throw error;
      }

      setSellOpen(false);
      navigate("/home");
      return;
    }

    const { data, error } =
      await supabase
        .from("stocks")
        .update({
          quantity:
            remainingQuantity,
        })
        .eq("id", stockId)
        .select()
        .single();

    if (error) {
      throw error;
    }

    setStock({
      ...data,
      _watchlistOnly: false,
    });

    setSellOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Stock not found
          </h1>

          {pageError && (
            <p className="mt-2 max-w-md text-sm text-gray-500">
              {pageError}
            </p>
          )}

          <button
            type="button"
            onClick={handleBack}
            className="mt-4 inline-block text-sm font-semibold text-gray-900 underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const quantity =
    Number(stock.quantity) || 0;

  const currentPrice =
    Number(stock.current_price) || 0;

  const purchasePrice =
    Number(stock.purchase_price) || 0;

  const totalValue =
    currentPrice * quantity;

  const totalCost =
    purchasePrice * quantity;

  const gain = totalValue - totalCost;

  const hasDailyReturn =
    Number.isFinite(dailyReturn);

  const displayReturn =
    hasDailyReturn
      ? dailyReturn
      : null;

  const displayPositive =
    hasDailyReturn
      ? displayReturn >= 0
      : gain >= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="m-3 inline-flex min-h-[36px] items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-gray-900 transition-all hover:opacity-70 active:scale-95"
      >
        <ArrowLeft
          className="h-4 w-4"
          strokeWidth={2}
        />
        Back
      </button>

      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-10 sm:px-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                {stock.logo_url && (
                  <img
                    src={stock.logo_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg border border-gray-100 object-contain"
                  />
                )}

                <h1 className="min-w-0 truncate text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                  {stock.company_name}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                onClick={() =>
                  setBuyOpen(true)
                }
                className="h-8 min-w-[58px] rounded-md bg-black px-3 text-[11px] font-semibold text-white hover:bg-gray-800 sm:min-w-[64px] sm:text-xs"
              >
                Buy
              </Button>

              {!stock._watchlistOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSellOpen(true)
                  }
                  className="h-8 min-w-[58px] rounded-md px-3 text-[11px] font-semibold sm:min-w-[64px] sm:text-xs"
                >
                  Sell
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col items-start gap-1.5">
            <p className="text-[1.7rem] font-bold leading-none tracking-tight text-gray-900 sm:text-3xl">
              {currentPrice > 0
                ? `$${currentPrice.toFixed(
                    2,
                  )}`
                : "—"}
            </p>

            <div
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold ${
                displayPositive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {hasDailyReturn &&
                (displayPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                ))}

              {hasDailyReturn
                ? `${
                    displayPositive
                      ? "+"
                      : ""
                  }${displayReturn.toFixed(2)}%`
                : "—"}
            </div>
          </div>

          {!stock._watchlistOnly && (
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
              {[
                {
                  label: "Shares",
                  value: quantity,
                },
                {
                  label: "Avg. Cost",
                  value: `$${purchasePrice.toFixed(
                    2,
                  )}`,
                },
                {
                  label: "Total Value",
                  value: `$${totalValue.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}`,
                },
                {
                  label: "Gain/Loss",
                  value: `${
                    gain >= 0 ? "+" : "-"
                  }$${Math.abs(gain).toFixed(
                    2,
                  )}`,
                  color:
                    gain >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-medium text-gray-400">
                    {item.label}
                  </p>

                  <p
                    className={`mt-1 text-sm font-semibold ${
                      item.color ||
                      "text-gray-900"
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <StockChart
          ticker={stock.ticker}
          currentPrice={currentPrice}
          fallbackPositive={
            Number.isFinite(
              dailyReturn,
            )
              ? dailyReturn >= 0
              : gain >= 0
          }
          activePeriod={activePeriod}
          onPeriodChange={
            setActivePeriod
          }
          onPeriodReturnChange={
            setPeriodReturn
          }
          onDailyReturnChange={
            setDailyReturn
          }
          initialDailyReturn={
            dailyReturn
          }
        />

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Newspaper className="h-4 w-4" />
              Recent News
            </h2>

            <button
              type="button"
              onClick={refreshNews}
              disabled={newsLoading}
              className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  newsLoading
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </button>
          </div>

          {newsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading news…
            </div>
          ) : news.length > 0 ? (
            <div>
              {news.map(
                (item, index) => (
                  <React.Fragment
                    key={`${
                      item.url ||
                      item.title
                    }-${index}`}
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block py-4"
                    >
                      <h3 className="text-sm font-semibold text-gray-900 hover:underline">
                        {item.title}
                      </h3>

                      {item.summary && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                          {item.summary}
                        </p>
                      )}

                      <div className="mt-2 flex gap-2 text-[11px] text-gray-400">
                        {item.source && (
                          <span>
                            {item.source}
                          </span>
                        )}

                        {item.date && (
                          <span>
                            {item.date}
                          </span>
                        )}
                      </div>
                    </a>

                    {index <
                      news.length - 1 && (
                      <div className="h-px bg-gray-100" />
                    )}
                  </React.Fragment>
                ),
              )}
            </div>
          ) : (
            <p className="py-6 text-sm text-gray-400">
              No recent news available.
            </p>
          )}
        </section>
      </main>

      <BuyDetailDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        stock={stock}
        onDone={handleBuyDone}
      />

      <SellDetailDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        stock={stock}
        onDone={handleSellDone}
      />
    </div>
  );
}
