// src/pages/StockDetail.jsx

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
  CartesianGrid,
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

import { financialDatasetsRequest } from "@/lib/financialDatasets";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PERIODS = ["1D","1W","1M","3M","6M","YTD","1Y","2Y","5Y","10Y","All"];

const PERIOD_CONFIG = {
  "1D": { resolution: "30", daysBack: 7 },
  "1W": { resolution: "D", daysBack: 14 },
  "1M": { resolution: "D", daysBack: 31 },
  "3M": { resolution: "D", daysBack: 93 },
  "6M": { resolution: "D", daysBack: 186 },
  YTD: { resolution: "D", daysBack: null },
  "1Y": { resolution: "D", daysBack: 370 },
  "2Y": { resolution: "W", daysBack: 740 },
  "5Y": { resolution: "W", daysBack: 1840 },
  "10Y": { resolution: "M", daysBack: 3680 },
  All: { resolution: "M", daysBack: null },
};

const FUNDAMENTAL_METRICS = [
  { label: "Market Cap", keys: ["market_cap", "marketCap"], format: "marketCap" },
  { label: "P/E", keys: ["price_to_earnings_ratio","pe_ratio","price_to_earnings","pe"], format: "number" },
  { label: "EV/EBITDA", keys: ["enterprise_value_to_ebitda_ratio","ev_to_ebitda","enterprise_value_ebitda"], format: "number" },
  { label: "Price/Sales", keys: ["price_to_sales_ratio","price_sales_ratio","price_to_sales"], format: "number" },
  { label: "PEG", keys: ["peg_ratio", "peg"], format: "number" },
  { label: "EPS", keys: ["earnings_per_share","eps","eps_ttm"], format: "currency" },
  { label: "Revenue Growth", keys: ["revenue_growth","revenue_growth_yoy"], format: "percent" },
  { label: "Net Margin", keys: ["net_margin"], format: "percent" },
  { label: "ROE", keys: ["return_on_equity","roe"], format: "percent" },
  { label: "Debt/Equity", keys: ["debt_to_equity"], format: "number" },
  { label: "Dividend Yield", keys: ["dividend_yield","dividend_yield_percentage"], format: "percent" },
];

const MAX_COMPARISON_TICKERS = 4;
const COMPARISON_COLORS = ["#6366f1","#f59e0b","#8b5cf6","#06b6d4"];
const TOOLTIP_HIDE_DELAY = 2500;
const UNAVAILABLE_VALUE = "—";

function normalizeTickerInput(value) {
  return String(value || "").trim().toUpperCase();
}

function roundPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function normalizePrefetchedQuote(value) {
  if (!value || typeof value !== "object") return null;

  const currentPrice = Number(
    value.c ?? value.currentPrice ?? value.current_price ?? value.price
  );
  const previousClose = Number(
    value.pc ?? value.previousClose ?? value.previous_close
  );
  const dailyPercent = Number(
    value.dp ?? value.dailyGain ?? value.dailyPercent ?? value.changePercent ?? value.change_percent
  );
  const dailyChange = Number(
    value.d ?? value.dailyChange ?? value.change
  );

  const normalized = {
    c: Number.isFinite(currentPrice) ? currentPrice : null,
    pc: Number.isFinite(previousClose) ? previousClose : null,
    dp: Number.isFinite(dailyPercent) ? dailyPercent : null,
    d: Number.isFinite(dailyChange) ? dailyChange : null,
  };

  return Object.values(normalized).some(Number.isFinite) ? normalized : null;
}

async function marketDataProxy(body, signal) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const payload = await financialDatasetsRequest(body);

  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  return payload;
}

function getPeriodBounds(period) {
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG["1M"];
  const to = Math.floor(Date.now() / 1000);

  if (period === "All") {
    return { from: 1, to, resolution: config.resolution };
  }

  if (period === "YTD") {
    const now = new Date();
    return {
      from: Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0) / 1000),
      to,
      resolution: config.resolution,
    };
  }

  return {
    from: to - config.daysBack * 86400,
    to,
    resolution: config.resolution,
  };
}

function formatChartLabel(timestamp, period) {
  const date = timestampToDate(timestamp);

  if (period === "1D") {
    return date.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (["1W", "1M"].includes(period)) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    });
  }

  if (["3M", "6M", "YTD", "1Y"].includes(period)) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
    });
  }

  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    year: "2-digit",
  });
}

function timestampToDate(timestamp) {
  const value = Number(timestamp);

  if (!Number.isFinite(value)) {
    return new Date(NaN);
  }

  // Financial data sources can return Unix timestamps in either
  // seconds or milliseconds. Detect the unit instead of always
  // multiplying by 1000, which can make every intraday tick resolve
  // to the wrong hour.
  return new Date(value > 10_000_000_000 ? value : value * 1000);
}

function getNewYorkTimeParts(timestamp) {
  const date = timestampToDate(timestamp);

  if (Number.isNaN(date.getTime())) {
    return { hour: NaN, minute: NaN };
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

function formatXAxisTick(timestamp, period) {
  const date = timestampToDate(timestamp);

  if (period === "1D") {
    const { hour } = getNewYorkTimeParts(timestamp);

    if (!Number.isFinite(hour)) return "";

    return String(hour % 12 || 12);
  }

  if (["1W", "1M"].includes(period)) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    });
  }

  if (["3M", "6M", "YTD", "1Y"].includes(period)) {
    return date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
    });
  }

  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    year: "2-digit",
  });
}

function getTimestampKey(timestamp, period) {
  if (period === "1D") {
    return Number(timestamp);
  }

  const date = new Date(timestamp * 1000);

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

async function fetchChartData(ticker, period, signal) {
  const { from, to, resolution } = getPeriodBounds(period);

  const result = await marketDataProxy(
    {
      action: "candles_range",
      ticker,
      period,
      resolution,
      from,
      to,
    },
    signal
  );

  const candles = Array.isArray(result?.candles) ? result.candles : [];

  const points = candles
    .map((candle) => ({
      timestamp: Number(candle?.t),
      value: Number(candle?.c),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.value)
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length < 1) {
    throw new Error(`No chart data returned for ${ticker} (${period})`);
  }

  return points.map((point) => ({
    timestamp: point.timestamp,
    key: getTimestampKey(point.timestamp, period),
    label: formatChartLabel(point.timestamp, period),
    value: point.value,
  }));
}

function calculatePeriodReturn(points, period, officialDailyReturn) {
  if (period === "1D" && Number.isFinite(officialDailyReturn)) {
    return officialDailyReturn;
  }

  const first = points.find((point) => Number.isFinite(point?.value));
  const last = [...points].reverse().find((point) => Number.isFinite(point?.value));

  if (!first || !last) return null;

  const startPrice = roundPrice(first.value);
  const endPrice = roundPrice(last.value);

  if (
    !Number.isFinite(startPrice) ||
    startPrice <= 0 ||
    !Number.isFinite(endPrice)
  ) {
    return null;
  }

  return ((endPrice - startPrice) / startPrice) * 100;
}

function seriesDataKey(ticker) {
  return `return_${String(ticker)
    .replace(/[^A-Z0-9]/gi, "_")
    .toUpperCase()}`;
}

function alignComparisonSeries(tickerSeries, primaryTicker) {
  const entries = Object.entries(tickerSeries);

  if (entries.length < 2) return [];

  const keySets = entries.map(
    ([, points]) => new Set(points.map((point) => point.key))
  );

  const primaryPoints = tickerSeries[primaryTicker] || [];

  const sharedKeys = primaryPoints
    .map((point) => point.key)
    .filter((key) => keySets.every((set) => set.has(key)));

  if (sharedKeys.length < 2) return [];

  const pointMaps = Object.fromEntries(
    entries.map(([ticker, points]) => [
      ticker,
      new Map(points.map((point) => [point.key, point])),
    ])
  );

  const basePrices = {};

  for (const [ticker] of entries) {
    const firstPoint = pointMaps[ticker].get(sharedKeys[0]);
    const basePrice = roundPrice(firstPoint?.value);

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return [];
    }

    basePrices[ticker] = basePrice;
  }

  return sharedKeys.map((key) => {
    const primaryPoint = pointMaps[primaryTicker].get(key);

    const row = {
      timestamp: primaryPoint.timestamp,
      label: primaryPoint.label,
    };

    for (const [ticker] of entries) {
      const point = pointMaps[ticker].get(key);
      const displayedPrice = roundPrice(point?.value);

      row[seriesDataKey(ticker)] = Number.isFinite(displayedPrice)
        ? ((displayedPrice - basePrices[ticker]) / basePrices[ticker]) * 100
        : null;
    }

    return row;
  });
}

function getSeriesReturn(chartData, ticker) {
  const key = seriesDataKey(ticker);

  const lastValue = [...chartData]
    .reverse()
    .find((point) => Number.isFinite(point?.[key]))?.[key];

  return Number.isFinite(lastValue) ? lastValue : null;
}

function metricValue(metrics, keys) {
  for (const key of keys) {
    const value = Number(metrics?.[key]);

    if (
      metrics?.[key] !== null &&
      metrics?.[key] !== undefined &&
      metrics?.[key] !== "" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function formatFundamentalMetric(value, format) {
  if (!Number.isFinite(value)) return UNAVAILABLE_VALUE;

  if (format === "marketCap") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (format === "percent") {
    return `${(value * 100).toFixed(2)}%`;
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  comparisonsActive,
  ticker,
  periodStartPrice,
  period,
}) {
  if (!active || !payload?.length) return null;

  const displayedStartPrice = roundPrice(periodStartPrice);
  const pointTimestamp = Number(payload?.[0]?.payload?.timestamp);

  const formattedLabel = Number.isFinite(pointTimestamp)
    ? formatChartLabel(pointTimestamp, period)
    : Number.isFinite(Number(label))
      ? formatChartLabel(Number(label), period)
      : label;

  return (
    <div className="rounded-[14px] border border-border bg-card px-3 py-2.5 text-foreground shadow-xl">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {formattedLabel}
      </p>

      {payload.map((entry) => {
        const displayedValue = roundPrice(entry.value);

        if (!Number.isFinite(displayedValue)) return null;

        const growthPct = comparisonsActive
          ? displayedValue
          : Number.isFinite(displayedStartPrice) && displayedStartPrice > 0
            ? ((displayedValue - displayedStartPrice) / displayedStartPrice) * 100
            : 0;

        const positive = growthPct >= 0;

        return (
          <div
            key={entry.dataKey}
            className="flex min-w-[168px] items-center justify-between gap-4 py-0.5 text-xs"
          >
            <span className="flex items-center gap-2 font-medium text-muted-foreground">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name || ticker}
            </span>

            <span
              className={
                positive
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-red-600"
              }
            >
              {comparisonsActive
                ? `${positive ? "+" : ""}${displayedValue.toFixed(2)}%`
                : `$${displayedValue.toFixed(2)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TwoPointPercentageTooltip({
  startPoint,
  endPoint,
  ticker,
  comparisonsActive,
}) {
  if (!startPoint || !endPoint) return null;

  let startValue = null;
  let endValue = null;

  if (comparisonsActive) {
    const dataKey = seriesDataKey(ticker);
    const startReturn = Number(startPoint[dataKey]);
    const endReturn = Number(endPoint[dataKey]);

    if (Number.isFinite(startReturn) && Number.isFinite(endReturn)) {
      const startLevel = 1 + startReturn / 100;
      const endLevel = 1 + endReturn / 100;

      if (startLevel > 0) {
        startValue = startLevel;
        endValue = endLevel;
      }
    }
  } else {
    const rawStart = roundPrice(startPoint.primaryValue);
    const rawEnd = roundPrice(endPoint.primaryValue);

    if (Number.isFinite(rawStart) && Number.isFinite(rawEnd) && rawStart > 0) {
      startValue = rawStart;
      endValue = rawEnd;
    }
  }

  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return null;

  const percentDifference = ((endValue - startValue) / startValue) * 100;
  const positive = percentDifference >= 0;
  const midpointX = (Number(startPoint.touchX) + Number(endPoint.touchX)) / 2;

  if (!Number.isFinite(midpointX) || !Number.isFinite(percentDifference)) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute top-2 z-20 -translate-x-1/2 rounded-[12px] border border-border bg-card/95 px-3 py-2 text-foreground shadow-xl backdrop-blur-sm"
      style={{ left: midpointX }}
    >
      <span
        className={
          positive
            ? "text-[13px] font-bold text-emerald-600"
            : "text-[13px] font-bold text-red-600"
        }
      >
        {positive ? "+" : ""}{percentDifference.toFixed(2)}%
      </span>
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
  const [compareTickers, setCompareTickers] = useState([]);
  const [compareInput, setCompareInput] = useState("");
  const [compareError, setCompareError] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [primaryReturn, setPrimaryReturn] = useState(
    activePeriod === "1D" && Number.isFinite(initialDailyReturn)
      ? initialDailyReturn
      : null
  );
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [dualTouchPoints, setDualTouchPoints] = useState([]);
  const tooltipTimerRef = useRef(null);
  const chartContainerRef = useRef(null);

  const primaryTicker = normalizeTickerInput(ticker);
  const comparisonsActive = compareTickers.length > 0;

  useEffect(() => {
    setCompareTickers([]);
    setCompareInput("");
    setCompareError("");
    setShowInput(false);
  }, [primaryTicker]);

  function clearTooltipTimer() {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }

  function hideTooltip() {
    clearTooltipTimer();
    setTooltipVisible(false);
    setDualTouchPoints([]);
  }

  function showTooltipTemporarily() {
    clearTooltipTimer();
    setTooltipVisible(true);

    tooltipTimerRef.current = window.setTimeout(() => {
      setTooltipVisible(false);
      tooltipTimerRef.current = null;
    }, TOOLTIP_HIDE_DELAY);
  }

  function getTouchPoint(clientX) {
    const container = chartContainerRef.current;

    if (!container || !displayChartData.length) return null;

    const rect = container.getBoundingClientRect();
    const plotLeft = 4;
    const plotRight = Math.max(plotLeft + 1, rect.width - 46);
    const relativeX = Math.min(
      plotRight,
      Math.max(plotLeft, clientX - rect.left)
    );
    const ratio = (relativeX - plotLeft) / (plotRight - plotLeft);
    const index = Math.min(
      displayChartData.length - 1,
      Math.max(0, Math.round(ratio * (displayChartData.length - 1)))
    );

    return {
      ...displayChartData[index],
      touchX: relativeX,
      touchIndex: index,
    };
  }

  function handleChartTouch(event) {
    const touches = Array.from(event.touches || []);

    if (touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      clearTooltipTimer();
      setTooltipVisible(false);

      const points = touches
        .slice(0, 2)
        .map((touch) => getTouchPoint(touch.clientX))
        .filter(Boolean)
        .sort((left, right) => left.touchX - right.touchX);

      setDualTouchPoints(points);
      return;
    }

    setDualTouchPoints([]);
    showTooltipTemporarily();
  }

  function finishChartTouch(event) {
    const touches = Array.from(event.touches || []);

    if (touches.length >= 2) {
      handleChartTouch(event);
      return;
    }

    setDualTouchPoints([]);
    clearTooltipTimer();
    tooltipTimerRef.current = window.setTimeout(
      () => setTooltipVisible(false),
      TOOLTIP_HIDE_DELAY
    );
  }

  useEffect(() => {
    return () => clearTooltipTimer();
  }, []);

  useEffect(() => {
    hideTooltip();

    const fallbackReturn =
      activePeriod === "1D" && Number.isFinite(initialDailyReturn)
        ? initialDailyReturn
        : null;

    setPrimaryReturn(fallbackReturn);
    onPeriodReturnChange(fallbackReturn);

    const controller = new AbortController();

    async function loadChart() {
      setChartLoading(true);
      setChartError("");

      try {
        const requestedTickers = [primaryTicker, ...compareTickers];

        const seriesResults = await Promise.all(
          requestedTickers.map(async (requestedTicker) => [
            requestedTicker,
            await fetchChartData(
              requestedTicker,
              activePeriod,
              controller.signal
            ),
          ])
        );

        const tickerSeries = Object.fromEntries(seriesResults);
        const primary = tickerSeries[primaryTicker];

        const nextReturn = calculatePeriodReturn(
          primary,
          activePeriod,
          initialDailyReturn
        );

        setPrimaryReturn(nextReturn);
        onPeriodReturnChange(nextReturn);

        if (
          activePeriod === "1D" &&
          !Number.isFinite(initialDailyReturn) &&
          Number.isFinite(nextReturn)
        ) {
          onDailyReturnChange(nextReturn);
        }

        if (comparisonsActive) {
          const aligned = alignComparisonSeries(
            tickerSeries,
            primaryTicker
          );

          if (aligned.length < 2) {
            throw new Error(
              "Could not align the selected tickers on shared trading dates."
            );
          }

          setChartData(aligned);
        } else {
          setChartData(
            primary.map((point) => ({
              timestamp: point.timestamp,
              label: point.label,
              primaryValue: point.value,
            }))
          );
        }
      } catch (error) {
        if (error?.name === "AbortError") return;

        console.error("Chart load failed:", error);

        setChartData([]);
        setPrimaryReturn(fallbackReturn);
        onPeriodReturnChange(fallbackReturn);

        setChartError(
          error?.message ||
            "Unable to load chart data"
        );
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      }
    }

    loadChart();

    return () => controller.abort();
  }, [
    primaryTicker,
    activePeriod,
    compareTickers,
    comparisonsActive,
    onPeriodReturnChange,
    onDailyReturnChange,
    initialDailyReturn,
  ]);

  const periodStartPrice = useMemo(() => {
    if (comparisonsActive) return 0;

    return (
      chartData.find((point) =>
        Number.isFinite(point.primaryValue)
      )?.primaryValue ||
      currentPrice ||
      0
    );
  }, [chartData, comparisonsActive, currentPrice]);

  const chartPositive = Number.isFinite(primaryReturn)
    ? primaryReturn >= 0
    : fallbackPositive;

  const primaryColor = chartPositive ? "#10b981" : "#ef4444";

  const displayChartData = useMemo(() => {
    if (activePeriod !== "1D") {
      return chartData.map((point, index) => ({
        ...point,
        xIndex: index,
        xHourLabel: "",
      }));
    }

    const seenHours = new Set();

    return chartData.map((point, index) => {
      const { hour } = getNewYorkTimeParts(point?.timestamp);
      const displayHour =
        Number.isFinite(hour) ? hour % 12 || 12 : null;

      let xHourLabel = "";

      if (
        displayHour !== null &&
        !seenHours.has(displayHour)
      ) {
        xHourLabel = String(displayHour);
        seenHours.add(displayHour);
      }

      return {
        ...point,
        xIndex: index,
        xHourLabel,
      };
    });
  }, [chartData, activePeriod]);

  const xAxisTicks = useMemo(() => {
    const timestamps = chartData
      .map((point) => Number(point?.timestamp))
      .filter(Number.isFinite)
      .sort((left, right) => left - right);

    if (!timestamps.length) return [];

    if (activePeriod === "1D") {
      return displayChartData
        .map((point, index) =>
          point?.xHourLabel ? index : null
        )
        .filter((value) => value !== null)
        .slice(1);
    }

    if (activePeriod === "1W") {
      return timestamps.length > 1 ? timestamps.slice(1) : timestamps;
    }

    if (activePeriod === "1M") {
      const spacedTicks = timestamps.filter((_, index) => index % 3 === 0);
      return spacedTicks.length > 1 ? spacedTicks.slice(1) : spacedTicks;
    }

    const monthlyTicks = [];
    let previousMonthKey = "";

    for (const timestamp of timestamps) {
      const date = timestampToDate(timestamp);
      const monthKey = date.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
      });

      if (monthKey !== previousMonthKey) {
        monthlyTicks.push(timestamp);
        previousMonthKey = monthKey;
      }
    }

    if (activePeriod === "2Y") {
      const ticks = monthlyTicks.filter((_, index) => index % 3 === 0);
      return ticks.length > 1 ? ticks.slice(1) : ticks;
    }

    if (activePeriod === "5Y") {
      const ticks = monthlyTicks.filter((_, index) => index % 6 === 0);
      return ticks.length > 1 ? ticks.slice(1) : ticks;
    }

    if (activePeriod === "10Y") {
      const ticks = monthlyTicks.filter((_, index) => index % 12 === 0);
      return ticks.length > 1 ? ticks.slice(1) : ticks;
    }

    if (activePeriod === "All") {
      const targetTickCount = 7;
      const step = Math.max(
        1,
        Math.ceil(monthlyTicks.length / targetTickCount)
      );

      const ticks = monthlyTicks.filter((_, index) => index % step === 0);
      return ticks.length > 1 ? ticks.slice(1) : ticks;
    }

    return monthlyTicks.length > 1 ? monthlyTicks.slice(1) : monthlyTicks;
  }, [chartData, displayChartData, activePeriod]);

  const comparisonLegendItems = [
    {
      ticker: primaryTicker,
      color: primaryColor,
      removable: false,
      value: getSeriesReturn(chartData, primaryTicker),
    },

    ...compareTickers.map((comparisonTicker, index) => ({
      ticker: comparisonTicker,
      color: COMPARISON_COLORS[index],
      removable: true,
      value: getSeriesReturn(chartData, comparisonTicker),
    })),
  ];

  function handleAddCompare(event) {
    event.preventDefault();

    const normalized = normalizeTickerInput(compareInput);

    if (!normalized) return;

    if (normalized === primaryTicker) {
      setCompareError(`${primaryTicker} is already the primary ticker.`);
      return;
    }

    if (compareTickers.includes(normalized)) {
      setCompareError(`${normalized} is already being compared.`);
      return;
    }

    if (compareTickers.length >= MAX_COMPARISON_TICKERS) {
      setCompareError(`Maximum ${MAX_COMPARISON_TICKERS} comparison tickers.`);
      return;
    }

    setCompareTickers((previous) => [
      ...previous,
      normalized,
    ]);

    setCompareInput("");
    setCompareError("");
    setShowInput(false);
  }

  function removeCompare(comparisonTicker) {
    hideTooltip();

    setCompareTickers((previous) =>
      previous.filter(
        (item) => item !== comparisonTicker
      )
    );
  }

  return (
    <section className="rounded-[22px] border border-border bg-card p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Price Chart
          </p>

          <p
            className={[
              "mt-1 text-[14px] font-semibold",
              Number.isFinite(primaryReturn)
                ? primaryReturn >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
                : "text-muted-foreground",
            ].join(" ")}
          >
            {Number.isFinite(primaryReturn)
              ? `${primaryReturn >= 0 ? "+" : ""}${primaryReturn.toFixed(2)}%`
              : "—"}
          </p>
        </div>

        {compareTickers.length < MAX_COMPARISON_TICKERS &&
          !showInput && (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="inline-flex h-[34px] items-center gap-1 rounded-[10px] bg-muted px-3 text-[11px] font-semibold text-foreground transition-transform active:scale-[0.96]"
            >
              <Plus className="h-3.5 w-3.5" />
              Compare
            </button>
          )}
      </div>

      <div className="mt-3 flex w-full items-center gap-[2px]">
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => onPeriodChange(period)}
            className={[
              "flex h-[28px] min-w-0 flex-1 items-center justify-center rounded-[7px] px-0.5 text-[9.5px] font-semibold tracking-[-0.15px] transition-[transform,background-color,color] duration-150 active:scale-[0.96]",
              activePeriod === period
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted",
            ].join(" ")}
          >
            {period}
          </button>
        ))}
      </div>

      {showInput && (
        <form
          onSubmit={handleAddCompare}
          className="mt-3 flex items-center gap-2"
        >
          <Input
            value={compareInput}
            onChange={(event) => {
              setCompareInput(event.target.value.toUpperCase());
              setCompareError("");
            }}
            placeholder="TICKER"
            maxLength={8}
            autoFocus
            className="h-[38px] rounded-[11px] text-xs uppercase"
          />

          <Button
            type="submit"
            className="h-[38px] rounded-[11px] px-3 text-xs"
          >
            Add
          </Button>

          <button
            type="button"
            onClick={() => {
              setShowInput(false);
              setCompareInput("");
              setCompareError("");
            }}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

      {compareError && (
        <p className="mt-2 text-[12px] font-medium text-red-600">
          {compareError}
        </p>
      )}

      {compareTickers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {comparisonLegendItems.map((item) => {
            const positive = Number.isFinite(item.value)
              ? item.value >= 0
              : null;

            return (
              <div
                key={item.ticker}
                className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 py-1.5"
              >
                <span
                  className="h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: item.color }}
                />

                <span className="text-[11px] font-semibold text-foreground">
                  {item.ticker}
                </span>

                <span
                  className={[
                    "text-[10px] font-semibold",
                    positive === null
                      ? "text-muted-foreground"
                      : positive
                        ? "text-emerald-600"
                        : "text-red-600",
                  ].join(" ")}
                >
                  {Number.isFinite(item.value)
                    ? `${positive ? "+" : ""}${item.value.toFixed(2)}%`
                    : "—"}
                </span>

                {item.removable && (
                  <button
                    type="button"
                    onClick={() => removeCompare(item.ticker)}
                    className="text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={chartContainerRef}
        className="relative mt-4 h-[300px] w-full overflow-hidden rounded-[16px] bg-neutral-50"
        style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
        onTouchStartCapture={handleChartTouch}
        onTouchMoveCapture={handleChartTouch}
        onTouchEndCapture={finishChartTouch}
        onTouchCancelCapture={finishChartTouch}
      >
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[16px] bg-card/75 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {chartError ? (
          <div className="flex h-full items-center justify-center rounded-[16px] border border-dashed border-border bg-muted/25 px-5 text-center">
            <div>
              <p className="text-[14px] font-semibold text-foreground">
                Chart unavailable
              </p>

              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                {chartError}
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayChartData}
              margin={{
                top: 8,
                right: 0,
                bottom: 0,
                left: 4,
              }}
              onMouseMove={showTooltipTemporarily}
              onMouseLeave={hideTooltip}
            >
              <CartesianGrid
                stroke="#e5e7eb"
                strokeWidth={1}
                vertical
                horizontal
              />

              <XAxis
                dataKey={activePeriod === "1D" ? "xIndex" : "timestamp"}
                type={activePeriod === "1D" ? "number" : "category"}
                domain={
                  activePeriod === "1D"
                    ? [0, Math.max(0, displayChartData.length - 1)]
                    : undefined
                }
                allowDataOverflow={activePeriod === "1D"}
                allowDuplicatedCategory={false}
                ticks={xAxisTicks}
                interval={0}
                tickFormatter={(value) => {
                  if (activePeriod === "1D") {
                    return displayChartData[Number(value)]?.xHourLabel || "";
                  }

                  return formatXAxisTick(value, activePeriod);
                }}
                minTickGap={0}
                padding={{ left: 0, right: 0 }}
                tick={{
                  fontSize: activePeriod === "1D"
                    ? 8.5
                    : activePeriod === "All"
                      ? 8
                      : 9,
                  fill: "#6b7280",
                }}
                tickMargin={8}
                tickLine={false}
                axisLine={false}
                height={32}
              />

              <YAxis
                orientation="right"
                domain={["auto", "auto"]}
                tickFormatter={(value) =>
                  comparisonsActive
                    ? `${value.toFixed(0)}%`
                    : `$${value.toFixed(0)}`
                }
                tick={{
                  fontSize: 10,
                  fill: "#6b7280",
                }}
                tickLine={false}
                axisLine={false}
                width={46}
              />

              <Tooltip
                active={tooltipVisible}
                isAnimationActive={false}
                content={
                  <ChartTooltip
                    comparisonsActive={comparisonsActive}
                    ticker={primaryTicker}
                    periodStartPrice={periodStartPrice}
                    period={activePeriod}
                  />
                }
              />

              <Line
                type="monotone"
                dataKey={
                  comparisonsActive
                    ? seriesDataKey(primaryTicker)
                    : "primaryValue"
                }
                name={primaryTicker}
                stroke={primaryColor}
                strokeWidth={2.25}
                dot={activePeriod === "1D" && displayChartData.length === 1 ? { r: 3 } : false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {compareTickers.map((comparisonTicker, index) => (
                <Line
                  key={comparisonTicker}
                  type="monotone"
                  dataKey={seriesDataKey(comparisonTicker)}
                  name={comparisonTicker}
                  stroke={COMPARISON_COLORS[index]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {dualTouchPoints.length === 2 && (
          <TwoPointPercentageTooltip
            startPoint={dualTouchPoints[0]}
            endPoint={dualTouchPoints[1]}
            ticker={primaryTicker}
            comparisonsActive={comparisonsActive}
          />
        )}
      </div>
    </section>
  );
}

function BuyDetailDialog({
  open,
  onOpenChange,
  stock,
  onDone,
}) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPrice(
        Number(stock?.current_price) > 0
          ? Number(stock.current_price).toFixed(2)
          : Number(stock?.purchase_price) > 0
            ? Number(stock.purchase_price).toFixed(2)
            : ""
      );
    }
  }, [open, stock]);

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(price);

    if (!(parsedQuantity > 0) || !(parsedPrice > 0)) return;

    setLoading(true);

    try {
      await onDone(parsedQuantity, parsedPrice);
      setQuantity("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-24px)] max-w-[380px] rounded-[22px] border-border bg-card p-5 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-bold tracking-[-0.35px]">
            Buy {stock?.ticker}
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 truncate text-[13px] text-muted-foreground">
          {stock?.company_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="buy-quantity">Shares</Label>
            <Input
              id="buy-quantity"
              type="number"
              min="0.000001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-[46px] rounded-[13px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buy-price">Purchase Price</Label>
            <Input
              id="buy-price"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="h-[46px] rounded-[13px]"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-[48px] w-full rounded-[14px] !bg-black !text-white hover:!bg-black/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const max = Number(stock?.quantity) || 0;

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);

    if (!(parsedQuantity > 0) || parsedQuantity > max) return;

    setLoading(true);

    try {
      await onDone(parsedQuantity);
      setQuantity("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-24px)] max-w-[380px] rounded-[22px] border-border bg-card p-5 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-bold tracking-[-0.35px]">
            Sell {stock?.ticker}
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 text-[13px] text-muted-foreground">
          {stock?.company_name} · {max} shares held
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="sell-quantity">Shares to Sell</Label>

            <div className="relative">
              <Input
                id="sell-quantity"
                type="number"
                min="0.000001"
                max={max}
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-[46px] rounded-[13px] pr-14"
                required
              />

              <button
                type="button"
                onClick={() => setQuantity(String(max))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                All
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-[48px] w-full rounded-[14px] !bg-black !text-white hover:!bg-black/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

export default function StockDetail() {
  const { ticker: routeValue } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { quotes = {}, fetchQuotes } = useMarketData();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [fundamentalsError, setFundamentalsError] = useState("");
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState("1W");
  const [, setPeriodReturn] = useState(null);
  const [dailyReturn, setDailyReturn] = useState(null);

  const isTickerRoute = routeValue?.startsWith("ticker-");

  const tickerFromRoute = isTickerRoute
    ? routeValue.replace("ticker-", "").toUpperCase()
    : null;

  const stockId = isTickerRoute ? null : routeValue;

  const routeStateQuote = useMemo(
    () =>
      normalizePrefetchedQuote(
        location.state?.quote ??
          location.state?.cachedQuote ??
          location.state?.marketQuote ??
          location.state?.marketData ??
          location.state
      ),
    [location.state]
  );

  const routeStateTicker = String(
    location.state?.ticker ||
      location.state?.symbol ||
      ""
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
      Number(window.history.state?.idx) > 0;

    if (hasPreviousAppPage) {
      navigate(-1);
      return;
    }

    const fallbackRoute =
      location.state?.from === "/watchlist"
        ? "/watchlist"
        : location.state?.from === "/portfolio"
          ? "/portfolio"
          : isTickerRoute
            ? "/watchlist"
            : "/home";

    navigate(fallbackRoute, { replace: true });
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadStock() {
      setLoading(true);
      setPageError("");
      setActivePeriod("1W");
      setPeriodReturn(null);

      const cachedTicker = tickerFromRoute || routeStateTicker;

      const cachedQuote =
        routeStateQuote ||
        normalizePrefetchedQuote(quotes[cachedTicker]);

      if (Number.isFinite(cachedQuote?.dp)) {
        setDailyReturn(cachedQuote.dp);
      } else {
        setDailyReturn(null);
      }

      if (isTickerRoute) {
        const cachedPrice =
          Number.isFinite(cachedQuote?.c) && cachedQuote.c > 0
            ? cachedQuote.c
            : 0;

        setStock({
          ticker: tickerFromRoute,
          company_name: routeStateCompanyName || tickerFromRoute,
          sector: "",
          logo_url: "",
          current_price: cachedPrice,
          purchase_price: Number.isFinite(cachedQuote?.pc)
            ? cachedQuote.pc
            : cachedPrice,
          quantity: 0,
          _watchlistOnly: true,
        });

        setLoading(false);
      }

      try {
        if (isTickerRoute) {
          const [quoteResult, profileResult] = await Promise.allSettled([
            marketDataProxy(
              { action: "quote", ticker: tickerFromRoute },
              controller.signal
            ),
            marketDataProxy(
              { action: "profile", ticker: tickerFromRoute },
              controller.signal
            ),
          ]);

          if (controller.signal.aborted) return;

          const quote =
            quoteResult.status === "fulfilled"
              ? quoteResult.value
              : null;

          const profile =
            profileResult.status === "fulfilled"
              ? profileResult.value
              : null;

          const resolvedQuote =
            normalizePrefetchedQuote(quote) ||
            cachedQuote;

          if (Number.isFinite(resolvedQuote?.dp)) {
            setDailyReturn(resolvedQuote.dp);
          }

          setStock({
            ticker: tickerFromRoute,
            company_name:
              profile?.name ||
              routeStateCompanyName ||
              tickerFromRoute,
            sector:
              profile?.industry ||
              profile?.sector ||
              "",
            logo_url: profile?.logo || "",
            current_price: Number(resolvedQuote?.c) || 0,
            purchase_price:
              Number(resolvedQuote?.pc || resolvedQuote?.c) || 0,
            quantity: 0,
            _watchlistOnly: true,
          });
        } else {
          const { data, error } = await supabase
            .from("stocks")
            .select("*")
            .eq("id", stockId)
            .single();

          if (error) throw error;

          if (!data) {
            setStock(null);
            return;
          }

          const normalizedTicker = String(data.ticker || "")
            .trim()
            .toUpperCase();

          const cachedPortfolioQuote =
            routeStateQuote ||
            normalizePrefetchedQuote(quotes[normalizedTicker]);

          if (Number.isFinite(cachedPortfolioQuote?.dp)) {
            setDailyReturn(cachedPortfolioQuote.dp);
          }

          setStock({
            ...data,
            current_price:
              Number.isFinite(cachedPortfolioQuote?.c) &&
              cachedPortfolioQuote.c > 0
                ? cachedPortfolioQuote.c
                : data.current_price,
            _watchlistOnly: false,
          });
        }
      } catch (error) {
        if (error?.name === "AbortError") return;

        console.error("Stock detail load failed:", error);

        if (isTickerRoute) {
          setPageError(
            "Market data is temporarily unavailable. Showing available stock details."
          );
          return;
        }

        setStock(null);
        setPageError(error?.message || "Unable to load stock");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStock();

    return () => controller.abort();
  }, [
    isTickerRoute,
    stockId,
    tickerFromRoute,
  ]);

  useEffect(() => {
    const normalizedTicker = String(stock?.ticker || "")
      .trim()
      .toUpperCase();

    if (!normalizedTicker) return undefined;

    let active = true;

    function applyQuote(value) {
      if (!active) return;

      const quote = normalizePrefetchedQuote(value);

      if (!quote) return;

      if (Number.isFinite(quote.dp)) {
        setDailyReturn(quote.dp);
      }

      if (Number.isFinite(quote.c) && quote.c > 0) {
        setStock((previous) => {
          if (
            !previous ||
            previous.ticker?.toUpperCase() !== normalizedTicker
          ) {
            return previous;
          }

          return {
            ...previous,
            current_price: quote.c,
            purchase_price:
              previous._watchlistOnly &&
              Number.isFinite(quote.pc)
                ? quote.pc
                : previous.purchase_price,
          };
        });
      }
    }

    if (!routeStateTicker || routeStateTicker === normalizedTicker) {
      applyQuote(routeStateQuote);
    }

    applyQuote(quotes[normalizedTicker]);

    fetchQuotes([normalizedTicker])
      .then((result) => {
        applyQuote(
          result?.[normalizedTicker] ||
            quotes[normalizedTicker]
        );
      })
      .catch((error) => {
        console.warn(
          "Stock detail quote prefetch failed:",
          error
        );
      });

    return () => {
      active = false;
    };
  }, [
    stock?.ticker,
    fetchQuotes,
    routeStateQuote,
    routeStateTicker,
  ]);

  useEffect(() => {
    if (!stock?.ticker) {
      setFundamentals(null);
      setFundamentalsError("");
      setFundamentalsLoading(false);
      return undefined;
    }

    let active = true;

    async function loadFundamentals() {
      setFundamentalsLoading(true);
      setFundamentalsError("");

      try {
        const result = await financialDatasetsRequest({
          action: "metrics",
          ticker: stock.ticker,
        });

        if (!active) return;

        const metrics = result?.snapshot ?? result?.metrics;

        if (!metrics || typeof metrics !== "object") {
          throw new Error(
            "Fundamentals are unavailable for this stock."
          );
        }

        setFundamentals(metrics);
      } catch (error) {
        if (!active) return;

        console.warn("Fundamentals fetch failed:", error);

        setFundamentals(null);
        setFundamentalsError(
          error?.message ||
            "Unable to load fundamentals."
        );
      } finally {
        if (active) {
          setFundamentalsLoading(false);
        }
      }
    }

    loadFundamentals();

    return () => {
      active = false;
    };
  }, [stock?.ticker]);

  useEffect(() => {
    if (!stock?.ticker) return undefined;

    const controller = new AbortController();

    async function loadNews() {
      setNewsLoading(true);

      try {
        const result = await marketDataProxy(
          {
            action: "news",
            ticker: stock.ticker,
          },
          controller.signal
        );

        setNews(
          Array.isArray(result?.articles)
            ? result.articles
            : []
        );
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("News fetch failed:", error);
          setNews([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setNewsLoading(false);
        }
      }
    }

    loadNews();

    return () => controller.abort();
  }, [stock?.ticker]);

  async function refreshNews() {
    if (!stock?.ticker) return;

    setNewsLoading(true);

    try {
      const result = await marketDataProxy({
        action: "news",
        ticker: stock.ticker,
      });

      setNews(
        Array.isArray(result?.articles)
          ? result.articles
          : []
      );
    } finally {
      setNewsLoading(false);
    }
  }

  async function handleBuyDone(quantity, price) {
    if (!user || !stock) return;

    const oldQuantity = Number(stock.quantity) || 0;
    const oldAverageCost = Number(stock.purchase_price) || 0;
    const newQuantity = oldQuantity + quantity;

    const newAverageCost = oldQuantity
      ? (
          oldAverageCost * oldQuantity +
          price * quantity
        ) / newQuantity
      : price;

    let currentPrice = price;

    try {
      const quote = await marketDataProxy({
        action: "quote",
        ticker: stock.ticker,
      });

      if (Number(quote?.c) > 0) {
        currentPrice = Number(quote.c);
      }
    } catch (error) {
      console.warn(
        "Quote refresh failed during buy:",
        error
      );
    }

    await supabase
      .from("stock_transactions")
      .insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "buy",
        quantity,
        price,
        total: quantity * price,
      });

    if (stock._watchlistOnly) {
      const normalizedTicker = stock.ticker.toUpperCase();

      const {
        data: existingHolding,
        error: existingHoldingError,
      } = await supabase
        .from("stocks")
        .select("*")
        .eq("user_id", user.id)
        .eq("ticker", normalizedTicker)
        .maybeSingle();

      if (existingHoldingError) throw existingHoldingError;

      if (existingHolding) {
        const existingQuantity =
          Number(existingHolding.quantity) || 0;

        const existingAverageCost =
          Number(existingHolding.purchase_price) || 0;

        const combinedQuantity =
          existingQuantity + quantity;

        const combinedAverageCost =
          existingQuantity > 0
            ? (
                existingAverageCost * existingQuantity +
                price * quantity
              ) / combinedQuantity
            : price;

        const {
          data: updatedHolding,
          error: updateExistingError,
        } = await supabase
          .from("stocks")
          .update({
            quantity: combinedQuantity,
            purchase_price:
              +combinedAverageCost.toFixed(4),
            current_price: currentPrice,
          })
          .eq("id", existingHolding.id)
          .select()
          .single();

        if (updateExistingError) {
          throw updateExistingError;
        }

        setStock({
          ...updatedHolding,
          _watchlistOnly: false,
        });

        setBuyOpen(false);
        return;
      }

      const { data, error } = await supabase
        .from("stocks")
        .insert({
          user_id: user.id,
          ticker: normalizedTicker,
          company_name: stock.company_name,
          quantity,
          purchase_price: price,
          current_price: currentPrice,
          sector: stock.sector || "",
        })
        .select()
        .single();

      if (error) throw error;

      setStock({
        ...data,
        _watchlistOnly: false,
      });

      setBuyOpen(false);
      return;
    }

    const holdingId = stock.id || stockId;

    if (!holdingId) {
      throw new Error("Unable to identify portfolio holding.");
    }

    const { data, error } = await supabase
      .from("stocks")
      .update({
        quantity: newQuantity,
        purchase_price: +newAverageCost.toFixed(4),
        current_price: currentPrice,
      })
      .eq("id", holdingId)
      .select()
      .single();

    if (error) throw error;

    setStock({
      ...data,
      _watchlistOnly: false,
    });

    setBuyOpen(false);
  }

  async function handleSellDone(quantity) {
    if (!user || !stock || stock._watchlistOnly) return;

    const heldQuantity = Number(stock.quantity) || 0;
    const sellPrice =
      Number(stock.current_price) ||
      Number(stock.purchase_price) ||
      0;

    const soldQuantity = Math.min(quantity, heldQuantity);

    const remainingQuantity =
      +Math.max(
        0,
        heldQuantity - soldQuantity
      ).toFixed(6);

    await supabase
      .from("stock_transactions")
      .insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "sell",
        quantity: soldQuantity,
        price: sellPrice,
        total: soldQuantity * sellPrice,
      });

    const holdingId = stock.id || stockId;

    if (!holdingId) {
      throw new Error("Unable to identify portfolio holding.");
    }

    if (remainingQuantity <= 0) {
      const { error } = await supabase
        .from("stocks")
        .delete()
        .eq("id", holdingId);

      if (error) throw error;

      setSellOpen(false);
      navigate("/home");
      return;
    }

    const { data, error } = await supabase
      .from("stocks")
      .update({
        quantity: remainingQuantity,
      })
      .eq("id", holdingId)
      .select()
      .single();

    if (error) throw error;

    setStock({
      ...data,
      _watchlistOnly: false,
    });

    setSellOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background px-5 text-foreground">
        <div className="text-center">
          <h1 className="text-[20px] font-bold">
            Stock not found
          </h1>

          {pageError && (
            <p className="mt-2 max-w-[300px] text-[13px] leading-5 text-muted-foreground">
              {pageError}
            </p>
          )}

          <button
            type="button"
            onClick={handleBack}
            className="mt-4 text-[13px] font-semibold underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const quantity = Number(stock.quantity) || 0;
  const currentPrice = Number(stock.current_price) || 0;
  const purchasePrice = Number(stock.purchase_price) || 0;
  const totalValue = currentPrice * quantity;
  const totalCost = purchasePrice * quantity;
  const gain = totalValue - totalCost;
  const hasDailyReturn = Number.isFinite(dailyReturn);
  const displayPositive = hasDailyReturn
    ? dailyReturn >= 0
    : gain >= 0;

  return (
    <div className="min-h-full bg-background text-foreground">
      <header
        className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
          <div className="mx-auto grid h-[58px] w-full max-w-[430px] grid-cols-[64px_1fr_64px] items-stretch px-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="
                flex
                h-[58px]
                w-16
                items-center
                justify-center
                self-stretch
                rounded-r-[18px]
                text-foreground
                transition-all
                active:scale-95
                active:bg-muted
              "
            >
              <ArrowLeft
                size={22}
                strokeWidth={2.2}
              />
            </button>

          <div className="flex h-full min-w-0 items-center justify-center text-center">
            <p className="truncate text-[15px] font-bold tracking-[-0.2px]">
              {stock.ticker}
            </p>
          </div>

          <div />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] space-y-5 px-4 pb-[calc(28px+env(safe-area-inset-bottom))] pt-4">
        {pageError && isTickerRoute && (
          <div
            role="status"
            className="rounded-[16px] border border-amber-300/70 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
          >
            {pageError}
          </div>
        )}

        <section className="rounded-[22px] border border-border bg-card p-5 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {stock.logo_url ? (
                <img
                  src={stock.logo_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-[13px] border border-border bg-background object-contain p-1"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-border bg-background text-[13px] font-bold">
                  {String(stock.ticker || "").slice(0, 2)}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-[20px] font-bold tracking-[-0.45px]">
                  {stock.company_name}
                </h1>

                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {stock.ticker}
                  {stock.sector ? ` · ${stock.sector}` : ""}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                onClick={() => setBuyOpen(true)}
                className="h-[36px] rounded-[11px] !bg-black px-3 text-[11px] font-semibold !text-white hover:!bg-black/90"
              >
                Buy
              </Button>

              {!stock._watchlistOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSellOpen(true)}
                  className="h-[36px] rounded-[11px] !border-black !bg-white px-3 text-[11px] font-semibold !text-black hover:!bg-neutral-100"
                >
                  Sell
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[34px] font-bold leading-none tracking-[-1px]">
              {currentPrice > 0
                ? `$${currentPrice.toFixed(2)}`
                : "—"}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <div
                className={[
                  "inline-flex h-[30px] items-center gap-1 rounded-[9px] px-2.5 text-[13px] font-semibold",
                  displayPositive
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-red-500/10 text-red-600",
                ].join(" ")}
              >
                {hasDailyReturn &&
                  (displayPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  ))}

                {hasDailyReturn
                  ? `${displayPositive ? "+" : ""}${dailyReturn.toFixed(2)}%`
                  : "—"}
              </div>

              <span className="text-[11px] font-medium text-muted-foreground">
                Today
              </span>
            </div>
          </div>

          {!stock._watchlistOnly && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                {
                  label: "Shares",
                  value: quantity,
                },
                {
                  label: "Avg. Cost",
                  value: `$${purchasePrice.toFixed(2)}`,
                },
                {
                  label: "Total Value",
                  value: `$${totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                },
                {
                  label: "Gain/Loss",
                  value: `${gain >= 0 ? "+" : "-"}$${Math.abs(gain).toFixed(2)}`,
                  color:
                    gain >= 0
                      ? "text-emerald-600"
                      : "text-red-600",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[15px] border border-border/70 bg-background/45 px-3 py-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {item.label}
                  </p>

                  <p
                    className={[
                      "mt-1 truncate text-[14px] font-bold",
                      item.color || "text-foreground",
                    ].join(" ")}
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
            Number.isFinite(dailyReturn)
              ? dailyReturn >= 0
              : gain >= 0
          }
          activePeriod={activePeriod}
          onPeriodChange={setActivePeriod}
          onPeriodReturnChange={setPeriodReturn}
          onDailyReturnChange={setDailyReturn}
          initialDailyReturn={dailyReturn}
        />

        <section>
          <SectionHeading>Fundamentals</SectionHeading>

          <div className="rounded-[22px] border border-border bg-card p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-bold tracking-[-0.2px]">
                Key Metrics
              </p>

              {fundamentalsLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {fundamentalsError && (
              <p className="mb-3 rounded-[12px] bg-red-500/10 px-3 py-2 text-[12px] text-red-600">
                {fundamentalsError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {FUNDAMENTAL_METRICS.map((metric) => {
                const value = metricValue(
                  fundamentals,
                  metric.keys
                );

                return (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-[15px] border border-border/70 bg-background/45 px-3 py-3"
                  >
                    <p className="truncate text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                      {metric.label}
                    </p>

                    <p className="mt-1 truncate text-[14px] font-bold">
                      {formatFundamentalMetric(
                        value,
                        metric.format
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <SectionHeading>Recent News</SectionHeading>

          <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                <p className="text-[14px] font-bold tracking-[-0.2px]">
                  Latest
                </p>
              </div>

              <button
                type="button"
                onClick={refreshNews}
                disabled={newsLoading}
                className="flex h-[34px] items-center gap-1.5 rounded-[10px] bg-muted px-2.5 text-[11px] font-semibold text-foreground transition-transform active:scale-[0.96] disabled:opacity-50"
              >
                <RefreshCw
                  className={[
                    "h-3.5 w-3.5",
                    newsLoading ? "animate-spin" : "",
                  ].join(" ")}
                />
                Refresh
              </button>
            </div>

            {newsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading news…
              </div>
            ) : news.length > 0 ? (
              <div>
                {news.map((item, index) => (
                  <a
                    key={`${item.url || item.title}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={[
                      "block px-4 py-4 transition-colors active:bg-muted/50",
                      index < news.length - 1
                        ? "border-b border-border"
                        : "",
                    ].join(" ")}
                  >
                    <h3 className="text-[14px] font-semibold leading-[1.35] text-foreground">
                      {item.title}
                    </h3>

                    {item.summary && (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                        {item.summary}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                      {item.source && <span>{item.source}</span>}
                      {item.date && <span>{item.date}</span>}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                No recent news available.
              </p>
            )}
          </div>
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
