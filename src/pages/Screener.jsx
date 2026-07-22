import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Factory,
  Gauge,
  HeartPulse,
  Landmark,
  LineChart,
  Loader2,
  Percent,
  Radio,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const LONG_PRESS_MS = 600;
const TOOLTIP_VISIBLE_MS = 5000;

const SECTORS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Energy",
  "Consumer Cyclical",
  "Industrials",
  "Real Estate",
  "Utilities",
  "Materials",
  "Communication Services",
];

const POPULAR_SCREENS = [
  {
    label: "Large Cap Tech",
    filters: {
      sectors: ["Technology"],
      minMarketCapB: 10,
    },
  },
  {
    label: "High Dividend",
    filters: {
      minDividendYield: 3,
    },
  },
  {
    label: "Oversold (RSI < 30)",
    filters: {
      maxRsi: 30,
    },
  },
  {
    label: "Strong Momentum",
    filters: {
      minChangePercent: 5,
    },
  },
  {
    label: "Penny Stocks",
    filters: {
      maxPrice: 5,
    },
  },
];

const METRIC_GROUPS = [
  {
    group: "Valuation",
    metrics: [
      {
        key: "pe",
        label: "P/E Ratio",
        desc:
          "Price ÷ EPS. Lower is generally cheaper; compare to peers. Negative earnings means there is no meaningful P/E.",
        unit: "x",
        minKey: "minPe",
        maxKey: "maxPe",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 25",
      },
      {
        key: "forwardPe",
        label: "Forward P/E",
        desc:
          "Price ÷ estimated future EPS. Reflects expected earnings growth.",
        unit: "x",
        minKey: "minForwardPe",
        maxKey: "maxForwardPe",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 30",
      },
      {
        key: "peg",
        label: "PEG Ratio",
        desc:
          "P/E ÷ earnings growth rate. Accounts for growth; below 1 is often considered attractive.",
        unit: "x",
        minKey: "minPeg",
        maxKey: "maxPeg",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 1",
      },
      {
        key: "pb",
        label: "P/B Ratio",
        desc:
          "Price ÷ book value per share. Useful for asset-heavy companies; below 1 may indicate undervaluation.",
        unit: "x",
        minKey: "minPb",
        maxKey: "maxPb",
        minPlaceholder: "e.g. 0.5",
        maxPlaceholder: "e.g. 5",
      },
      {
        key: "ps",
        label: "P/S Ratio",
        desc:
          "Price ÷ revenue per share. Useful for unprofitable or high-growth companies.",
        unit: "x",
        minKey: "minPs",
        maxKey: "maxPs",
        minPlaceholder: "e.g. 0.5",
        maxPlaceholder: "e.g. 10",
      },
      {
        key: "evEbitda",
        label: "EV/EBITDA",
        desc:
          "Enterprise value ÷ EBITDA. Useful for comparing companies with different debt levels.",
        unit: "x",
        minKey: "minEvEbitda",
        maxKey: "maxEvEbitda",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "pcf",
        label: "P/Cash Flow",
        desc:
          "Price ÷ operating cash flow per share. Cash flow can be harder to manipulate than earnings.",
        unit: "x",
        minKey: "minPcf",
        maxKey: "maxPcf",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 30",
      },
      {
        key: "pfcf",
        label: "P/Free Cash Flow",
        desc:
          "Price ÷ free cash flow per share. Free cash flow is cash remaining after capital expenditures.",
        unit: "x",
        minKey: "minPfcf",
        maxKey: "maxPfcf",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 40",
      },
    ],
  },
  {
    group: "Profitability",
    metrics: [
      {
        key: "grossMargin",
        label: "Gross Margin",
        desc:
          "Gross profit ÷ revenue. Shows pricing power and production efficiency.",
        unit: "%",
        minKey: "minGrossMargin",
        maxKey: "maxGrossMargin",
        minPlaceholder: "e.g. 20",
        maxPlaceholder: "e.g. 80",
      },
      {
        key: "operatingMargin",
        label: "Operating Margin",
        desc:
          "Operating income ÷ revenue. Profit after operating costs but before interest and taxes.",
        unit: "%",
        minKey: "minOperatingMargin",
        maxKey: "maxOperatingMargin",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 40",
      },
      {
        key: "netMargin",
        label: "Net Profit Margin",
        desc:
          "Net income ÷ revenue. Bottom-line profitability after all expenses.",
        unit: "%",
        minKey: "minNetMargin",
        maxKey: "maxNetMargin",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 30",
      },
      {
        key: "roe",
        label: "ROE",
        desc:
          "Net income ÷ shareholders' equity. Measures management efficiency.",
        unit: "%",
        minKey: "minRoe",
        maxKey: "maxRoe",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "roa",
        label: "ROA",
        desc:
          "Net income ÷ total assets. Shows how efficiently assets generate profit.",
        unit: "%",
        minKey: "minRoa",
        maxKey: "maxRoa",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 25",
      },
      {
        key: "roic",
        label: "ROIC",
        desc:
          "Return on invested capital. Measures how efficiently capital is allocated.",
        unit: "%",
        minKey: "minRoic",
        maxKey: "maxRoic",
        minPlaceholder: "e.g. 8",
        maxPlaceholder: "e.g. 40",
      },
    ],
  },
  {
    group: "Growth",
    metrics: [
      {
        key: "revenueGrowth",
        label: "Revenue Growth (YoY)",
        desc:
          "Year-over-year revenue increase. Shows top-line business expansion.",
        unit: "%",
        minKey: "minRevenueGrowth",
        maxKey: "maxRevenueGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "epsGrowth",
        label: "EPS Growth (YoY)",
        desc:
          "Year-over-year earnings-per-share growth.",
        unit: "%",
        minKey: "minEpsGrowth",
        maxKey: "maxEpsGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "ebitdaGrowth",
        label: "EBITDA Growth",
        desc:
          "Growth in earnings before interest, taxes, depreciation and amortization.",
        unit: "%",
        minKey: "minEbitdaGrowth",
        maxKey: "maxEbitdaGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "fcfGrowth",
        label: "FCF Growth",
        desc:
          "Growth in free cash flow after capital expenditures.",
        unit: "%",
        minKey: "minFcfGrowth",
        maxKey: "maxFcfGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "week52Change",
        label: "52W Price Change",
        desc:
          "Stock-price change over the past 52 weeks.",
        unit: "%",
        minKey: "minWeek52Change",
        maxKey: "maxWeek52Change",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 100",
      },
    ],
  },
  {
    group: "Financial Health",
    metrics: [
      {
        key: "deRatio",
        label: "D/E Ratio",
        desc:
          "Total debt ÷ shareholders' equity. Lower generally indicates less financial leverage.",
        unit: "x",
        minKey: "minDe",
        maxKey: "maxDe",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 1.5",
      },
      {
        key: "currentRatio",
        label: "Current Ratio",
        desc:
          "Current assets ÷ current liabilities. Measures short-term liquidity.",
        unit: "x",
        minKey: "minCurrentRatio",
        maxKey: "maxCurrentRatio",
        minPlaceholder: "e.g. 1.5",
        maxPlaceholder: "e.g. 5",
      },
      {
        key: "quickRatio",
        label: "Quick Ratio",
        desc:
          "Current assets excluding inventory ÷ current liabilities.",
        unit: "x",
        minKey: "minQuickRatio",
        maxKey: "maxQuickRatio",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 4",
      },
      {
        key: "interestCoverage",
        label: "Interest Coverage",
        desc:
          "EBIT ÷ interest expense. Measures the ability to pay interest.",
        unit: "x",
        minKey: "minInterestCoverage",
        maxKey: "maxInterestCoverage",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "debtEbitda",
        label: "Debt/EBITDA",
        desc:
          "Total debt ÷ EBITDA. Measures leverage relative to operating earnings.",
        unit: "x",
        minKey: "minDebtEbitda",
        maxKey: "maxDebtEbitda",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 4",
      },
    ],
  },
  {
    group: "Efficiency",
    metrics: [
      {
        key: "assetTurnover",
        label: "Asset Turnover",
        desc:
          "Revenue ÷ average total assets. Measures asset-use efficiency.",
        unit: "x",
        minKey: "minAssetTurnover",
        maxKey: "maxAssetTurnover",
        minPlaceholder: "e.g. 0.3",
        maxPlaceholder: "e.g. 2",
      },
      {
        key: "inventoryTurnover",
        label: "Inventory Turnover",
        desc:
          "Cost of goods sold ÷ average inventory. Measures how quickly inventory sells.",
        unit: "x",
        minKey: "minInventoryTurnover",
        maxKey: "maxInventoryTurnover",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "receivablesTurnover",
        label: "Receivables Turnover",
        desc:
          "Revenue ÷ average accounts receivable. Measures collection efficiency.",
        unit: "x",
        minKey: "minReceivablesTurnover",
        maxKey: "maxReceivablesTurnover",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "dso",
        label: "Days Sales Outstanding",
        desc:
          "Average number of days required to collect payment after a sale.",
        unit: "days",
        minKey: "minDso",
        maxKey: "maxDso",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 60",
      },
    ],
  },
  {
    group: "Dividends & Returns",
    metrics: [
      {
        key: "dividendYield",
        label: "Dividend Yield",
        desc:
          "Annual dividend ÷ stock price.",
        unit: "%",
        minKey: "minDividendYield",
        maxKey: "maxDividendYield",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 8",
      },
      {
        key: "payoutRatio",
        label: "Payout Ratio",
        desc:
          "Dividends ÷ net income. Measures how much profit is distributed to shareholders.",
        unit: "%",
        minKey: "minPayoutRatio",
        maxKey: "maxPayoutRatio",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 60",
      },
      {
        key: "dividendGrowth",
        label: "Dividend Growth (5Y)",
        desc:
          "Compound annual dividend growth over five years.",
        unit: "%",
        minKey: "minDividendGrowth",
        maxKey: "maxDividendGrowth",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
    ],
  },
  {
    group: "Per-Share & Size",
    metrics: [
      {
        key: "marketCapB",
        label: "Market Cap",
        desc:
          "Total market value in billions. Large-cap is generally above $10 billion.",
        unit: "B",
        minKey: "minMarketCapB",
        maxKey: "maxMarketCapB",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 500",
      },
      {
        key: "eps",
        label: "EPS (TTM)",
        desc:
          "Trailing twelve-month earnings per share.",
        unit: "$",
        minKey: "minEps",
        maxKey: "maxEps",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "bookValuePerShare",
        label: "Book Value/Share",
        desc:
          "Net assets per share after subtracting liabilities.",
        unit: "$",
        minKey: "minBookValue",
        maxKey: "maxBookValue",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 100",
      },
      {
        key: "fcfPerShare",
        label: "FCF/Share",
        desc:
          "Free cash flow generated per share after capital expenditures.",
        unit: "$",
        minKey: "minFcfPerShare",
        maxKey: "maxFcfPerShare",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 50",
      },
    ],
  },
];

const ALL_METRIC_DEFS =
  METRIC_GROUPS.flatMap(
    (group) =>
      group.metrics.map(
        (metric) => ({
          ...metric,
          group:
            group.group,
        }),
      ),
  );

function readSessionObject(
  key,
  fallback,
) {
  try {
    const storedValue =
      window.sessionStorage.getItem(
        key,
      );

    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(
      storedValue,
    );
  } catch {
    return fallback;
  }
}

function removeUndefinedValues(
  object,
) {
  return Object.fromEntries(
    Object.entries(
      object || {},
    ).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "",
    ),
  );
}

function normalizeFilters(
  rawFilters = {},
) {
  const next =
    removeUndefinedValues(
      rawFilters,
    );

  if (
    Array.isArray(
      next.sectors,
    )
  ) {
    const validSectors = [
      ...new Set(
        next.sectors,
      ),
    ]
      .map((sector) =>
        String(
          sector,
        ).trim(),
      )
      .filter((sector) =>
        SECTORS.includes(
          sector,
        ),
      );

    if (
      validSectors.length >
      0
    ) {
      next.sectors =
        validSectors;
    } else {
      delete next.sectors;
    }
  } else if (
    typeof next.sector ===
      "string" &&
    SECTORS.includes(
      next.sector,
    )
  ) {
    next.sectors = [
      next.sector,
    ];
  }

  delete next.sector;

  return next;
}

function getSelectedSectors(
  filters,
) {
  if (
    !Array.isArray(
      filters?.sectors,
    )
  ) {
    return [];
  }

  return filters.sectors.filter(
    (sector) =>
      SECTORS.includes(
        sector,
      ),
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tooltip,
}) {
  const [
    showTip,
    setShowTip,
  ] = useState(false);

  const [
    tipStyle,
    setTipStyle,
  ] = useState({});

  const buttonRef =
    useRef(null);

  const pressTimerRef =
    useRef(null);

  const hideTimerRef =
    useRef(null);

  const longPressTriggeredRef =
    useRef(false);

  const clearPressTimer =
    useCallback(() => {
      window.clearTimeout(
        pressTimerRef.current,
      );

      pressTimerRef.current =
        null;
    }, []);

  const closeTooltip =
    useCallback(() => {
      window.clearTimeout(
        hideTimerRef.current,
      );

      hideTimerRef.current =
        null;

      setShowTip(false);
    }, []);

  const openTooltip =
    useCallback(() => {
      if (
        !tooltip ||
        !buttonRef.current
      ) {
        return;
      }

      const rect =
        buttonRef.current.getBoundingClientRect();

      const tooltipWidth =
        Math.min(
          280,
          window.innerWidth -
            24,
        );

      const left =
        Math.max(
          12,
          Math.min(
            rect.left,
            window.innerWidth -
              tooltipWidth -
              12,
          ),
        );

      const displayBelow =
        rect.top < 110;

      setTipStyle({
        position: "fixed",
        top: displayBelow
          ? rect.bottom + 8
          : rect.top - 8,
        transform:
          displayBelow
            ? "none"
            : "translateY(-100%)",
        left,
        width:
          tooltipWidth,
        zIndex: 10001,
      });

      setShowTip(true);

      window.clearTimeout(
        hideTimerRef.current,
      );

      hideTimerRef.current =
        window.setTimeout(
          () => {
            setShowTip(false);

            hideTimerRef.current =
              null;
          },
          TOOLTIP_VISIBLE_MS,
        );
    }, [tooltip]);

  useEffect(() => {
    return () => {
      clearPressTimer();

      window.clearTimeout(
        hideTimerRef.current,
      );
    };
  }, [clearPressTimer]);

  const handlePointerDown = (
    event,
  ) => {
    if (!tooltip) {
      return;
    }

    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    longPressTriggeredRef.current =
      false;

    clearPressTimer();

    pressTimerRef.current =
      window.setTimeout(
        () => {
          longPressTriggeredRef.current =
            true;

          openTooltip();
        },
        LONG_PRESS_MS,
      );
  };

  const handlePointerEnd =
    () => {
      clearPressTimer();
    };

  const handleClick = (
    event,
  ) => {
    if (
      longPressTriggeredRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      longPressTriggeredRef.current =
        false;

      return;
    }

    onClick?.(event);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={
          handleClick
        }
        onPointerDown={
          handlePointerDown
        }
        onPointerUp={
          handlePointerEnd
        }
        onPointerCancel={
          handlePointerEnd
        }
        onPointerLeave={
          handlePointerEnd
        }
        onContextMenu={(
          event,
        ) => {
          if (tooltip) {
            event.preventDefault();
          }
        }}
        aria-expanded={
          tooltip
            ? showTip
            : undefined
        }
        className={`touch-manipulation select-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
        }`}
      >
        {label}
      </button>

      {showTip &&
        tooltip && (
          <>
            <button
              type="button"
              aria-label="Close metric description"
              tabIndex={-1}
              onClick={
                closeTooltip
              }
              className="fixed inset-0 z-[10000] cursor-default bg-transparent"
            />

            <div
              role="tooltip"
              className="pointer-events-none whitespace-normal break-words rounded-lg bg-gray-900 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-xl"
              style={
                tipStyle
              }
            >
              {tooltip}
            </div>
          </>
        )}
    </div>
  );
}


const QUICK_SCREEN_UI = [
  {
    icon: Cpu,
    description:
      "Top technology companies by market cap",
    iconClass:
      "bg-blue-50 text-blue-600",
  },
  {
    icon: CircleDollarSign,
    description:
      "Stocks with dividend yield above 3%",
    iconClass:
      "bg-emerald-50 text-emerald-600",
  },
  {
    icon: BarChart3,
    description:
      "Stocks trading at oversold RSI levels",
    iconClass:
      "bg-violet-50 text-violet-600",
  },
  {
    icon: TrendingUp,
    description:
      "Stocks showing strong recent momentum",
    iconClass:
      "bg-orange-50 text-orange-600",
  },
  {
    icon: BadgeDollarSign,
    description:
      "Stocks priced below five dollars",
    iconClass:
      "bg-amber-50 text-amber-600",
  },
];

const GROUP_ICON_MAP = {
  Valuation: BadgeDollarSign,
  Profitability: CircleDollarSign,
  Growth: TrendingUp,
  "Financial Health": ShieldCheck,
  Efficiency: Gauge,
  Dividends: Percent,
  "Market Data": LineChart,
};

const SECTOR_ICON_MAP = {
  Technology: Cpu,
  Healthcare: HeartPulse,
  Finance: Landmark,
  Energy: Zap,
  "Consumer Cyclical": WalletCards,
  Industrials: Factory,
  "Real Estate": Building2,
  Utilities: Activity,
  Materials: Sparkles,
  "Communication Services": Radio,
};

function MetricSelectionRow({
  definition,
  selected,
  onToggle,
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onToggle(
          definition.key,
        )
      }
      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
        selected
          ? "border-gray-900 bg-gray-50 shadow-sm"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/60"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          selected
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-300 bg-white text-transparent"
        }`}
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900">
            {definition.label}
          </span>

          {definition.unit &&
            definition.unit.toLowerCase() !== "x" && (
              <span className="text-[10px] font-medium text-gray-400">
                {definition.unit}
              </span>
            )}
        </span>

        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {definition.desc}
        </span>
      </span>
    </button>
  );
}

function ActiveMetricFilterRow({
  definition,
  filters,
  onChange,
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-gray-900">
              {definition.label}
            </p>

            {definition.unit &&
              definition.unit.toLowerCase() !== "x" && (
                <span className="text-[10px] text-gray-400">
                  {definition.unit}
                </span>
              )}
          </div>

          <p className="truncate text-[10px] text-gray-400">
            Set the minimum, maximum, or both.
          </p>
        </div>

        <div className="grid w-[150px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:w-[190px]">
          <input
            type="number"
            step="any"
            aria-label={`${definition.label} minimum`}
            placeholder="Min"
            value={
              filters[
                definition.minKey
              ] ?? ""
            }
            onChange={(event) =>
              onChange(
                definition.minKey,
                event.target.value,
              )
            }
            className="h-9 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-center text-xs text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
          />

          <span className="text-xs text-gray-300">
            –
          </span>

          <input
            type="number"
            step="any"
            aria-label={`${definition.label} maximum`}
            placeholder="Max"
            value={
              filters[
                definition.maxKey
              ] ?? ""
            }
            onChange={(event) =>
              onChange(
                definition.maxKey,
                event.target.value,
              )
            }
            className="h-9 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-2 text-center text-xs text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export default function Screener() {
  const { user } =
    useAuth();

  const navigate =
    useNavigate();

  const handleBack =
    useCallback(() => {
      const historyIndex =
        Number(
          window.history.state
            ?.idx,
        );

      if (
        Number.isFinite(
          historyIndex,
        ) &&
        historyIndex > 0
      ) {
        navigate(-1);
        return;
      }

      navigate(
        "/watchlist",
        {
          replace: true,
        },
      );
    }, [navigate]);

  const [
    filters,
    setFilters,
  ] = useState(() =>
    normalizeFilters(
      readSessionObject(
        "screener_filters",
        {},
      ),
    ),
  );

  const [
    activeMetrics,
    setActiveMetrics,
  ] = useState(
    () =>
      new Set(
        readSessionObject(
          "screener_metrics",
          [],
        ),
      ),
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState(null);

  const [
    activePreset,
    setActivePreset,
  ] = useState(null);

  const [
    savedScreens,
    setSavedScreens,
  ] = useState([]);

  const [
    saveDialogOpen,
    setSaveDialogOpen,
  ] = useState(false);

  const [
    saveName,
    setSaveName,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const toastTimerRef =
    useRef(null);

  const selectedSectors =
    useMemo(
      () =>
        getSelectedSectors(
          filters,
        ),
      [filters],
    );


  const showToast =
    useCallback(
      (message) => {
        window.clearTimeout(
          toastTimerRef.current,
        );

        setToast(message);

        toastTimerRef.current =
          window.setTimeout(
            () => {
              setToast(null);
            },
            2500,
          );
      },
      [],
    );

  useEffect(() => {
    return () => {
      window.clearTimeout(
        toastTimerRef.current,
      );
    };
  }, []);

  const loadSavedScreens =
    useCallback(
      async () => {
        if (!user?.id) {
          setSavedScreens(
            [],
          );
          return;
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            "saved_screens",
          )
          .select("*")
          .eq(
            "user_id",
            user.id,
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          );

        if (error) {
          console.error(
            "Failed to load saved screens:",
            error,
          );
          return;
        }

        setSavedScreens(
          data || [],
        );
      },
      [user?.id],
    );

  useEffect(() => {
    void loadSavedScreens();
  }, [loadSavedScreens]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        "screener_filters",
        JSON.stringify(
          filters,
        ),
      );
    } catch {
      // Session storage is optional.
    }
  }, [filters]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        "screener_metrics",
        JSON.stringify([
          ...activeMetrics,
        ]),
      );
    } catch {
      // Session storage is optional.
    }
  }, [activeMetrics]);

  const toggleMetric = (
    key,
  ) => {
    const currentlyActive =
      activeMetrics.has(
        key,
      );

    setActiveMetrics(
      (previous) => {
        const next =
          new Set(
            previous,
          );

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      },
    );

    if (currentlyActive) {
      const definition =
        ALL_METRIC_DEFS.find(
          (item) =>
            item.key === key,
        );

      if (definition) {
        setFilters(
          (previous) => {
            const next = {
              ...previous,
            };

            delete next[
              definition.minKey
            ];

            delete next[
              definition.maxKey
            ];

            return next;
          },
        );
      }
    }

    setActivePreset(null);
  };

  const removeMetric =
    (key) => {
      const definition =
        ALL_METRIC_DEFS.find(
          (item) =>
            item.key === key,
        );

      setActiveMetrics(
        (previous) => {
          const next =
            new Set(previous);

          next.delete(key);

          return next;
        },
      );

      if (definition) {
        setFilters(
          (previous) => {
            const next = {
              ...previous,
            };

            delete next[
              definition.minKey
            ];
            delete next[
              definition.maxKey
            ];

            return next;
          },
        );
      }

      setActivePreset(null);
    };

  const clearSectors =
    () => {
      setFilters(
        (previous) => {
          const next = {
            ...previous,
          };

          delete next.sectors;
          delete next.sector;

          return next;
        },
      );

      setActivePreset(null);
    };

  const toggleSector = (
    sector,
  ) => {
    setFilters(
      (previous) => {
        const current =
          getSelectedSectors(
            previous,
          );

        const nextSectors =
          current.includes(
            sector,
          )
            ? current.filter(
                (item) =>
                  item !==
                  sector,
              )
            : [
                ...current,
                sector,
              ];

        const next = {
          ...previous,
        };

        delete next.sector;

        if (
          nextSectors.length >
          0
        ) {
          next.sectors =
            nextSectors;
        } else {
          delete next.sectors;
        }

        return next;
      },
    );

    setActivePreset(null);
  };

  const runScreen =
    async (
      overrideFilters,
    ) => {
      if (
        !user?.id ||
        loading
      ) {
        if (!user?.id) {
          showToast(
            "Please sign in to run a screen.",
          );
        }

        return;
      }

      const selectedFilters =
        normalizeFilters(
          overrideFilters ??
            filters,
        );

      setLoading(true);

      try {
        window.sessionStorage.setItem(
          "screener_filters",
          JSON.stringify(
            selectedFilters,
          ),
        );
      } catch {
        // Session storage is optional.
      }

      navigate(
        "/screener/results",
        {
          state: {
            loading: true,
            results: [],
            filters:
              selectedFilters,
          },
        },
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.functions.invoke(
            "stock-screener",
            {
              body: {
                filters:
                  selectedFilters,
              },
            },
          );

        if (error) {
          throw error;
        }

        if (data?.error) {
          throw new Error(
            data.error,
          );
        }

        const results =
          Array.isArray(
            data?.stocks,
          )
            ? data.stocks
            : [];

        try {
          window.sessionStorage.setItem(
            "screener_last_results",
            JSON.stringify(
              results,
            ),
          );
        } catch {
          // Session storage is optional.
        }

        navigate(
          "/screener/results",
          {
            replace: true,
            state: {
              loading:
                false,
              results,
              filters:
                selectedFilters,
              error: "",
            },
          },
        );
      } catch (error) {
        console.error(
          "Stock screener failed:",
          error,
        );

        navigate(
          "/screener/results",
          {
            replace: true,
            state: {
              loading:
                false,
              results: [],
              filters:
                selectedFilters,
              error:
                error?.message ||
                "Unable to run the stock screen.",
            },
          },
        );
      } finally {
        setLoading(false);
      }
    };

  const applyPreset = (
    preset,
    index,
  ) => {
    const presetFilters =
      normalizeFilters(
        preset.filters,
      );

    setActivePreset(
      index,
    );

    setFilters(
      presetFilters,
    );

    const metricKeys =
      new Set();

    ALL_METRIC_DEFS.forEach(
      (definition) => {
        if (
          presetFilters[
            definition
              .minKey
          ] !== undefined ||
          presetFilters[
            definition
              .maxKey
          ] !== undefined
        ) {
          metricKeys.add(
            definition.key,
          );
        }
      },
    );

    setActiveMetrics(
      metricKeys,
    );

    void runScreen(
      presetFilters,
    );
  };

  const saveScreen =
    async () => {
      const trimmedName =
        saveName.trim();

      if (
        !trimmedName ||
        !user?.id ||
        saving
      ) {
        return;
      }

      setSaving(true);

      try {
        const {
          data,
          error,
        } = await supabase
          .from(
            "saved_screens",
          )
          .insert({
            user_id:
              user.id,
            name:
              trimmedName,
            filters:
              normalizeFilters(
                filters,
              ),
            active_metrics: [
              ...activeMetrics,
            ],
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        setSavedScreens(
          (previous) => [
            data,
            ...previous,
          ],
        );

        setSaveDialogOpen(
          false,
        );

        setSaveName("");

        showToast(
          "Screen saved!",
        );
      } catch (error) {
        console.error(
          "Failed to save screen:",
          error,
        );

        showToast(
          error?.message ||
            "Failed to save screen.",
        );
      } finally {
        setSaving(false);
      }
    };

  const loadSavedScreen = (
    screen,
  ) => {
    const savedFilters =
      normalizeFilters(
        screen?.filters ||
          {},
      );

    const savedMetrics =
      new Set(
        screen
          ?.active_metrics ||
          screen
            ?.activeMetrics ||
          [],
      );

    setFilters(
      savedFilters,
    );

    setActiveMetrics(
      savedMetrics,
    );

    setActivePreset(null);

    void runScreen(
      savedFilters,
    );
  };

  const deleteSavedScreen =
    async (
      id,
      event,
    ) => {
      event.stopPropagation();

      if (!user?.id) {
        return;
      }

      const previous =
        savedScreens;

      setSavedScreens(
        (current) =>
          current.filter(
            (screen) =>
              screen.id !==
              id,
          ),
      );

      const { error } =
        await supabase
          .from(
            "saved_screens",
          )
          .delete()
          .eq("id", id)
          .eq(
            "user_id",
            user.id,
          );

      if (error) {
        console.error(
          "Failed to delete saved screen:",
          error,
        );

        setSavedScreens(
          previous,
        );

        showToast(
          "Failed to delete screen.",
        );
      }
    };

  const updateNumberFilter = (
    key,
    rawValue,
  ) => {
    setFilters(
      (previous) => {
        const next = {
          ...previous,
        };

        if (
          rawValue === ""
        ) {
          delete next[key];
        } else {
          const value =
            Number(
              rawValue,
            );

          if (
            Number.isFinite(
              value,
            )
          ) {
            next[key] =
              value;
          }
        }

        return next;
      },
    );

    setActivePreset(null);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-white"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 110px)",
      }}
    >
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <header
        className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-xl"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="inline-flex min-h-[44px] min-w-[72px] items-center gap-1.5 justify-self-start rounded-xl px-2 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back
          </button>

          <div className="flex items-center justify-center gap-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                Screener
              </h1>

              <p className="text-xs text-gray-500">
                Filter stocks by criteria
              </p>
            </div>
          </div>

          <div aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-4 py-5 sm:px-6">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-gray-950">
                Quick Screens
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                Ready-made screens for common strategies
              </p>
            </div>

            <button
              type="button"
              className="min-h-9 rounded-lg px-2 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {POPULAR_SCREENS.slice(0, 4).map(
              (preset, index) => {
                const ui =
                  QUICK_SCREEN_UI[index];
                const Icon =
                  ui.icon;

                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() =>
                      applyPreset(
                        preset,
                        index,
                      )
                    }
                    className="group min-h-[144px] rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md active:scale-[0.99]"
                  >
                    <span
                      className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${ui.iconClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="block text-sm font-bold text-gray-950">
                      {preset.label}
                    </span>

                    <span className="mt-1.5 block text-xs leading-5 text-gray-500">
                      {ui.description}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </section>

        {savedScreens.length > 0 && (
          <section>
            <h2 className="mb-3 font-heading text-lg font-bold text-gray-950">
              Saved Screens
            </h2>

            <div className="space-y-2">
              {savedScreens.map(
                (screen) => (
                  <div
                    key={screen.id}
                    className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        loadSavedScreen(
                          screen,
                        )
                      }
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-xl px-3 text-left hover:bg-gray-50"
                    >
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {screen.name}
                      </span>

                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete ${screen.name}`}
                      onClick={(event) =>
                        deleteSavedScreen(
                          screen.id,
                          event,
                        )
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-gray-950">
                Custom Screener
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                Choose sectors and enter only the values you need
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFilters({});
                setActiveMetrics(
                  new Set(),
                );
                setActivePreset(
                  null,
                );
              }}
              className="min-h-9 rounded-lg px-2 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold text-gray-700">
              Sector
            </p>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="All"
                active={
                  selectedSectors.length ===
                  0
                }
                onClick={clearSectors}
              />

              {SECTORS.map(
                (sector) => {
                  const Icon =
                    SECTOR_ICON_MAP[
                      sector
                    ] || Building2;

                  return (
                    <button
                      type="button"
                      key={sector}
                      onClick={() =>
                        toggleSector(
                          sector,
                        )
                      }
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                        selectedSectors.includes(
                          sector,
                        )
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {sector}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="space-y-6">
            {METRIC_GROUPS.map(
              (group) => (
                <div key={group.group}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                      {group.group}
                    </h3>

                    <div className="h-px flex-1 bg-gray-100" />
                  </div>

                  <div className="space-y-2">
                    {group.metrics.map(
                      (definition) => (
                        <MetricSelectionRow
                          key={
                            definition.key
                          }
                          definition={{
                            ...definition,
                            group:
                              group.group,
                          }}
                          selected={activeMetrics.has(
                            definition.key,
                          )}
                          onToggle={
                            toggleMetric
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="font-heading text-base font-bold text-gray-950">
                  Selected Metrics
                </h3>

                <p className="mt-0.5 text-xs text-gray-400">
                  Enter the minimum, maximum, or both for each selected metric
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                {activeMetrics.size} selected
              </span>
            </div>

            {activeMetrics.size === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-8 text-center">
                <SlidersHorizontal className="mx-auto h-6 w-6 text-gray-300" />

                <p className="mt-2 text-sm font-semibold text-gray-700">
                  No metrics selected
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Check a metric above to add its Min and Max fields here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {ALL_METRIC_DEFS.filter(
                  (definition) =>
                    activeMetrics.has(
                      definition.key,
                    ),
                ).map(
                  (definition) => (
                    <ActiveMetricFilterRow
                      key={
                        definition.key
                      }
                      definition={
                        definition
                      }
                      filters={filters}
                      onChange={
                        updateNumberFilter
                      }
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-xl"
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <div className="mx-auto flex w-full max-w-xl gap-2">
          <Button
            className="h-12 flex-1 rounded-2xl bg-gray-950 text-white hover:bg-gray-800"
            onClick={() => {
              setActivePreset(null);
              void runScreen();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}

            Run Screener
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl px-4"
            disabled={loading}
            onClick={() => {
              setSaveName("");
              setSaveDialogOpen(
                true,
              );
            }}
          >
            <Save className="h-4 w-4" />
            <span className="sr-only">
              Save screen
            </span>
          </Button>
        </div>
      </div>

      <Dialog
        open={
          saveDialogOpen
        }
        onOpenChange={
          setSaveDialogOpen
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Save Screen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div>
              <Label className="mb-1.5 block text-sm">
                Screen name
              </Label>

              <Input
                placeholder="e.g. High-growth tech"
                value={
                  saveName
                }
                onChange={(
                  event,
                ) =>
                  setSaveName(
                    event.target
                      .value,
                  )
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    void saveScreen();
                  }
                }}
                autoFocus
              />
            </div>

            <Button
              className="w-full"
              onClick={() =>
                void saveScreen()
              }
              disabled={
                saving ||
                !saveName.trim()
              }
            >
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Save Screen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
