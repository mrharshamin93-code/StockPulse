import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
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
      minReturn1Month: 5,
      minReturn3Month: 10,
      minRsi: 55,
      maxRsi: 75,
      maxBullishMaCrossoverDays: 20,
      minRelativeVolume: 1,
      requirePriceAboveSma20: true,
      requireSma20AboveSma50: true,
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
          "Share price divided by trailing twelve-month earnings per share. It shows how much investors are paying for each dollar of reported earnings. The ratio is not meaningful when earnings are zero or negative.",
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
          "Share price divided by forecast earnings per share, typically for the next fiscal year or next twelve months. It reflects analyst earnings estimates rather than historical results.",
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
          "The price-to-earnings ratio divided by the expected earnings growth rate. It relates a company’s valuation to its projected growth, though results depend heavily on the growth estimate used.",
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
          "Market price per share divided by book value per share. It compares a company’s market valuation with the accounting value of its net assets.",
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
          "Market capitalization divided by annual revenue, or equivalently share price divided by revenue per share. It measures how much investors are paying for each dollar of sales.",
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
          "Enterprise value divided by earnings before interest, taxes, depreciation and amortization. It compares operating earnings with the total value of the business, including debt and excluding cash.",
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
          "Market capitalization divided by operating cash flow, or share price divided by operating cash flow per share. It measures valuation relative to cash generated from normal business operations.",
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
          "Market capitalization divided by free cash flow, or share price divided by free cash flow per share. Free cash flow is generally operating cash flow minus capital expenditures.",
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
          "Gross profit divided by revenue. It measures the percentage of revenue remaining after direct costs associated with producing goods or delivering services.",
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
          "Operating income divided by revenue. It measures profitability after direct costs and operating expenses, but before interest and taxes.",
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
          "Net income divided by revenue. It measures the percentage of revenue remaining after all operating expenses, interest, taxes and other costs.",
        unit: "%",
        minKey: "minNetMargin",
        maxKey: "maxNetMargin",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 30",
      },
      {
        key: "roe",
        label: "Return on Equity — ROE",
        desc:
          "Net income divided by average shareholders’ equity. It measures the return generated on the capital invested by common shareholders.",
        unit: "%",
        minKey: "minRoe",
        maxKey: "maxRoe",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "roa",
        label: "Return on Assets — ROA",
        desc:
          "Net income divided by average total assets. It measures how effectively a company uses its assets to generate profit.",
        unit: "%",
        minKey: "minRoa",
        maxKey: "maxRoa",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 25",
      },
      {
        key: "roic",
        label: "Return on Invested Capital — ROIC",
        desc:
          "Net operating profit after tax divided by invested capital. It measures the return earned on the capital used to fund the company’s operations.",
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
        label: "Revenue Growth — Year over Year",
        desc:
          "The percentage change in revenue compared with the corresponding period one year earlier. It measures the rate at which the company’s sales are expanding or contracting.",
        unit: "%",
        minKey: "minRevenueGrowth",
        maxKey: "maxRevenueGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "epsGrowth",
        label: "EPS Growth — Year over Year",
        desc:
          "The percentage change in earnings per share compared with the corresponding period one year earlier. It reflects changes in profitability on a per-share basis.",
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
          "The percentage change in earnings before interest, taxes, depreciation and amortization compared with the prior comparable period.",
        unit: "%",
        minKey: "minEbitdaGrowth",
        maxKey: "maxEbitdaGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "fcfGrowth",
        label: "Free Cash Flow Growth",
        desc:
          "The percentage change in free cash flow compared with the prior comparable period. Free cash flow generally equals operating cash flow minus capital expenditures.",
        unit: "%",
        minKey: "minFcfGrowth",
        maxKey: "maxFcfGrowth",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "week52Change",
        label: "52-Week Price Change",
        desc:
          "The percentage change in the stock price over the previous 52 weeks. It measures historical price performance and does not include dividends unless explicitly stated.",
        unit: "%",
        minKey: "minWeek52Change",
        maxKey: "maxWeek52Change",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 100",
      },
    ],
  },
  {
    group: "Technical Momentum",
    metrics: [
      {
        key: "rsi",
        label: "RSI — 14 Day",
        desc:
          "A 14-session momentum oscillator ranging from zero to 100. Values above 50 indicate positive momentum, while very high values may indicate an extended move.",
        unit: "",
        minKey: "minRsi",
        maxKey: "maxRsi",
        minPlaceholder: "e.g. 55",
        maxPlaceholder: "e.g. 75",
      },
      {
        key: "return1Week",
        label: "One-Week Price Return",
        desc:
          "The percentage change in closing price over approximately five trading sessions.",
        unit: "%",
        minKey: "minReturn1Week",
        maxKey: "maxReturn1Week",
        minPlaceholder: "e.g. 2",
        maxPlaceholder: "e.g. 25",
      },
      {
        key: "return1Month",
        label: "One-Month Price Return",
        desc:
          "The percentage change in closing price over approximately 21 trading sessions.",
        unit: "%",
        minKey: "minReturn1Month",
        maxKey: "maxReturn1Month",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 50",
      },
      {
        key: "return3Month",
        label: "Three-Month Price Return",
        desc:
          "The percentage change in closing price over approximately 63 trading sessions.",
        unit: "%",
        minKey: "minReturn3Month",
        maxKey: "maxReturn3Month",
        minPlaceholder: "e.g. 10",
        maxPlaceholder: "e.g. 100",
      },
      {
        key: "relativeVolume",
        label: "Relative Volume",
        desc:
          "The latest daily volume divided by the prior 30-session average volume. A value above 1 means trading activity is above normal.",
        unit: "x",
        minKey: "minRelativeVolume",
        maxKey: "maxRelativeVolume",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 5",
      },
      {
        key: "bullishMaCrossoverDays",
        label: "Bullish 20/50 MA Crossover Age",
        desc:
          "The number of trading sessions since the 20-day simple moving average most recently crossed above the 50-day simple moving average.",
        unit: "days",
        minKey: "minBullishMaCrossoverDays",
        maxKey: "maxBullishMaCrossoverDays",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 20",
      },
    ],
  },
  {
    group: "Financial Health",
    metrics: [
      {
        key: "deRatio",
        label: "Debt-to-Equity Ratio",
        desc:
          "Total debt divided by shareholders’ equity. It measures the amount of debt financing used relative to the company’s equity capital.",
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
          "Current assets divided by current liabilities. It measures the company’s ability to meet obligations due within approximately one year using short-term assets.",
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
          "Cash, marketable securities and receivables divided by current liabilities. It measures short-term liquidity while excluding inventory and other less-liquid current assets.",
        unit: "x",
        minKey: "minQuickRatio",
        maxKey: "maxQuickRatio",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 4",
      },
      {
        key: "interestCoverage",
        label: "Interest Coverage Ratio",
        desc:
          "Earnings before interest and taxes divided by interest expense. It measures how many times operating earnings cover the company’s interest obligations.",
        unit: "x",
        minKey: "minInterestCoverage",
        maxKey: "maxInterestCoverage",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "debtEbitda",
        label: "Debt-to-EBITDA",
        desc:
          "Total debt divided by EBITDA. It measures debt relative to operating earnings before interest, taxes, depreciation and amortization.",
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
          "Revenue divided by average total assets. It measures how efficiently a company uses its asset base to generate sales.",
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
          "Cost of goods sold divided by average inventory. It estimates how many times inventory is sold or used during a reporting period.",
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
          "Net credit sales divided by average accounts receivable. It measures how efficiently a company collects amounts owed by customers.",
        unit: "x",
        minKey: "minReceivablesTurnover",
        maxKey: "maxReceivablesTurnover",
        minPlaceholder: "e.g. 3",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "dso",
        label: "Days Sales Outstanding — DSO",
        desc:
          "The average number of days required to collect payment after a credit sale. Lower values generally indicate faster collection, although appropriate levels vary by industry.",
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
          "Annual dividends per share divided by the current share price. It represents annual dividend income as a percentage of the stock’s market price.",
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
          "Dividends paid to common shareholders divided by net income available to common shareholders. It measures the percentage of earnings distributed as dividends.",
        unit: "%",
        minKey: "minPayoutRatio",
        maxKey: "maxPayoutRatio",
        minPlaceholder: "e.g. 0",
        maxPlaceholder: "e.g. 60",
      },
      {
        key: "dividendGrowth",
        label: "Five-Year Dividend Growth",
        desc:
          "The compound annual growth rate of dividends per share over the previous five years. It measures the historical pace of dividend increases.",
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
        label: "Market Capitalization",
        desc:
          "Current share price multiplied by the number of shares outstanding. It represents the total market value of the company’s equity.",
        unit: "B",
        minKey: "minMarketCapB",
        maxKey: "maxMarketCapB",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 500",
      },
      {
        key: "eps",
        label: "Earnings per Share — TTM",
        desc:
          "Net income available to common shareholders over the trailing twelve months divided by weighted-average diluted shares outstanding.",
        unit: "$",
        minKey: "minEps",
        maxKey: "maxEps",
        minPlaceholder: "e.g. 1",
        maxPlaceholder: "e.g. 20",
      },
      {
        key: "bookValuePerShare",
        label: "Book Value per Share",
        desc:
          "Common shareholders’ equity divided by common shares outstanding. It represents the accounting value of net assets attributable to each common share.",
        unit: "$",
        minKey: "minBookValue",
        maxKey: "maxBookValue",
        minPlaceholder: "e.g. 5",
        maxPlaceholder: "e.g. 100",
      },
      {
        key: "fcfPerShare",
        label: "Free Cash Flow per Share",
        desc:
          "Free cash flow divided by weighted-average shares outstanding. It measures the amount of free cash flow generated for each share.",
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
            ? "!border-black !bg-black !text-white"
            : "!border-gray-200 !bg-white !text-black hover:!border-black"
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
      "bg-gray-100 text-black",
  },
  {
    icon: CircleDollarSign,
    description:
      "Stocks with dividend yield above 3%",
    iconClass:
      "bg-gray-100 text-black",
  },
  {
    icon: BarChart3,
    description:
      "Stocks trading at oversold RSI levels",
    iconClass:
      "bg-gray-100 text-black",
  },
  {
    icon: TrendingUp,
    description:
      "Fresh 20/50-day bullish trend with strong returns",
    iconClass:
      "bg-gray-100 text-black",
  },
  {
    icon: BadgeDollarSign,
    description:
      "Stocks priced below five dollars",
    iconClass:
      "bg-gray-100 text-black",
  },
];

const GROUP_ICON_MAP = {
  Valuation: BadgeDollarSign,
  Profitability: CircleDollarSign,
  Growth: TrendingUp,
  "Technical Momentum": LineChart,
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
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
        selected
          ? "!border-black !bg-white shadow-sm"
          : "!border-gray-100 !bg-white hover:!border-gray-300"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          selected
            ? "!border-black !bg-black !text-white"
            : "!border-gray-300 !bg-white !text-transparent"
        }`}
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-black">
            {definition.label}
          </span>

          {definition.unit &&
            definition.unit.toLowerCase() !== "x" && (
              <span className="text-[10px] font-medium text-black">
                {definition.unit}
              </span>
            )}
        </span>

        <span className="mt-1 block text-xs leading-5 text-black">
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
      <p className="break-words text-sm font-semibold leading-5 text-black">
        {definition.label}
      </p>

      <div className="mt-2 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
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
          className="h-9 min-w-0 rounded-xl border border-gray-200 bg-white px-2 text-center text-xs text-black outline-none transition focus:border-gray-400"
        />

        <span className="text-xs text-black">
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
          className="h-9 min-w-0 rounded-xl border border-gray-200 bg-white px-2 text-center text-xs text-black outline-none transition focus:border-gray-400"
        />
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

  useEffect(() => {
    const hiddenElements = new Map();

    const shouldHideBottomNavigation = (
      element,
    ) => {
      if (
        !(element instanceof HTMLElement) ||
        element.closest(
          "[data-screener-action-bar]",
        )
      ) {
        return false;
      }

      const style =
        window.getComputedStyle(
          element,
        );

      const rect =
        element.getBoundingClientRect();

      const isBottomFixed =
        (style.position === "fixed" ||
          style.position === "sticky") &&
        rect.bottom >=
          window.innerHeight - 4 &&
        rect.height >= 40 &&
        rect.height <= 140;

      if (!isBottomFixed) {
        return false;
      }

      const semanticMatch =
        element.matches(
          "nav, footer, [role='navigation']",
        ) ||
        Boolean(
          element.querySelector(
            "nav, [role='navigation']",
          ),
        );

      const linkCount =
        element.querySelectorAll(
          "a, button",
        ).length;

      return (
        semanticMatch ||
        linkCount >= 3
      );
    };

    const hideBottomNavigation = () => {
      document.body
        .querySelectorAll("*")
        .forEach((element) => {
          if (
            !shouldHideBottomNavigation(
              element,
            ) ||
            hiddenElements.has(
              element,
            )
          ) {
            return;
          }

          hiddenElements.set(
            element,
            element.style.display,
          );

          element.style.setProperty(
            "display",
            "none",
            "important",
          );
        });
    };

    document.body.classList.add(
      "screener-page-active",
    );

    hideBottomNavigation();

    const observer =
      new MutationObserver(
        hideBottomNavigation,
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    window.addEventListener(
      "resize",
      hideBottomNavigation,
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        hideBottomNavigation,
      );

      hiddenElements.forEach(
        (
          display,
          element,
        ) => {
          if (display) {
            element.style.display =
              display;
          } else {
            element.style.removeProperty(
              "display",
            );
          }
        },
      );

      document.body.classList.remove(
        "screener-page-active",
      );
    };
  }, []);


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
      className="flex min-h-screen flex-col bg-background"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 96px)",
      }}
    >
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <header
        className="sticky top-0 z-30 border-b border-black/5 bg-background/95 backdrop-blur-xl"
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
            className="inline-flex min-h-[44px] min-w-[72px] items-center gap-1.5 justify-self-start rounded-xl px-2 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back
          </button>

          <div className="flex items-center justify-center gap-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-black">
                Screener
              </h1>

              <p className="text-xs font-medium text-black">
                Filter stocks by criteria
              </p>
            </div>
          </div>

          <div className="justify-self-end text-right">
            <span className="text-[11px] font-semibold text-black">
              {activeMetrics.size} selected
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 space-y-8 px-4 py-5 sm:px-6">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-black">
                Quick Screens
              </h2>

              <p className="mt-0.5 text-xs text-black">
                Ready-made screens for common strategies
              </p>
            </div>

            <button
              type="button"
              className="min-h-9 rounded-lg px-2 text-xs font-medium text-black transition-colors hover:bg-gray-50 hover:text-black"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
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
                    className="group min-h-[112px] rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md active:scale-[0.99]"
                  >
                    <span
                      className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl ${ui.iconClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="block text-[13px] font-bold leading-4 text-black">
                      {preset.label}
                    </span>

                    <span className="mt-1 block text-[11px] leading-4 text-black">
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
            <h2 className="mb-3 font-heading text-lg font-bold text-black">
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
                      <span className="truncate text-sm font-semibold text-black">
                        {screen.name}
                      </span>

                      <ChevronRight className="h-4 w-4 shrink-0 text-black" />
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black transition-colors hover:bg-gray-100 hover:text-black"
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
              <h2 className="font-heading text-lg font-bold text-black">
                Custom Screener
              </h2>

              <p className="mt-0.5 text-xs text-black">
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
              className="min-h-9 px-1 text-xs font-semibold text-black underline-offset-4 transition-opacity hover:underline hover:opacity-70"
            >
              Clear All
            </button>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold text-black">
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
                          ? "!border-black !bg-black !text-white"
                          : "!border-gray-200 !bg-white !text-black hover:!border-black"
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
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-black">
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
            <div className="mb-3">
              <h3 className="font-heading text-base font-bold text-black">
                Selected Metrics
              </h3>

              <p className="mt-0.5 text-xs text-black">
                Enter the minimum, maximum, or both for each selected metric
              </p>
            </div>

            {activeMetrics.size === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-8 text-center">
                <SlidersHorizontal className="mx-auto h-6 w-6 text-black" />

                <p className="mt-2 text-sm font-semibold text-black">
                  No metrics selected
                </p>

                <p className="mt-1 text-xs text-black">
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

      {typeof document !==
        "undefined" &&
        createPortal(
          (
            <div
        data-screener-action-bar className="fixed inset-x-0 bottom-0 z-[10000] border-t border-gray-100 bg-white/95 px-4 pt-3 backdrop-blur-xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
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
          ),
          document.body,
        )}

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
