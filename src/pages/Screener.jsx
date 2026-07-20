import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
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

function readSessionObject(key, fallback) {
  try {
    const storedValue =
      window.sessionStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(storedValue);
  } catch {
    return fallback;
  }
}

function removeUndefinedValues(object) {
  return Object.fromEntries(
    Object.entries(object || {}).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "",
    ),
  );
}

function normalizeFilters(rawFilters = {}) {
  const next =
    removeUndefinedValues(rawFilters);

  /*
   * Convert older saved screens:
   *
   * sector: "Technology"
   *
   * Into:
   *
   * sectors: ["Technology"]
   */
  if (Array.isArray(next.sectors)) {
    const validSectors = [
      ...new Set(next.sectors),
    ]
      .map((sector) =>
        String(sector).trim(),
      )
      .filter((sector) =>
        SECTORS.includes(sector),
      );

    if (validSectors.length > 0) {
      next.sectors = validSectors;
    } else {
      delete next.sectors;
    }
  } else if (
    typeof next.sector === "string" &&
    SECTORS.includes(next.sector)
  ) {
    next.sectors = [next.sector];
  }

  delete next.sector;

  return next;
}

function getSelectedSectors(filters) {
  if (!Array.isArray(filters?.sectors)) {
    return [];
  }

  return filters.sectors.filter((sector) =>
    SECTORS.includes(sector),
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tooltip,
}) {
  const [showTip, setShowTip] =
    useState(false);

  const [tipStyle, setTipStyle] =
    useState({});

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

      pressTimerRef.current = null;
    }, []);

  const closeTooltip =
    useCallback(() => {
      window.clearTimeout(
        hideTimerRef.current,
      );

      hideTimerRef.current = null;

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
          window.innerWidth - 24,
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
        transform: displayBelow
          ? "none"
          : "translateY(-100%)",
        left,
        width: tooltipWidth,
        zIndex: 10001,
      });

      setShowTip(true);

      window.clearTimeout(
        hideTimerRef.current,
      );

      hideTimerRef.current =
        window.setTimeout(() => {
          setShowTip(false);

          hideTimerRef.current =
            null;
        }, TOOLTIP_VISIBLE_MS);
    }, [tooltip]);

  useEffect(() => {
    return () => {
      clearPressTimer();

      window.clearTimeout(
        hideTimerRef.current,
      );
    };
  }, [clearPressTimer]);

  const handlePointerDown = (event) => {
    if (!tooltip) {
      return;
    }

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    longPressTriggeredRef.current =
      false;

    clearPressTimer();

    pressTimerRef.current =
      window.setTimeout(() => {
        longPressTriggeredRef.current =
          true;

        openTooltip();
      }, LONG_PRESS_MS);
  };

  const handlePointerEnd = () => {
    clearPressTimer();
  };

  const handleClick = (event) => {
    /*
     * Long press opens the description without
     * selecting or deselecting the metric.
     */
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
        onClick={handleClick}
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
        onContextMenu={(event) => {
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

      {showTip && tooltip && (
        <>
          <button
            type="button"
            aria-label="Close metric description"
            tabIndex={-1}
            onClick={closeTooltip}
            className="fixed inset-0 z-[10000] cursor-default bg-transparent"
          />

          <div
            role="tooltip"
            className="pointer-events-none whitespace-normal break-words rounded-lg bg-gray-900 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-xl"
            style={tipStyle}
          >
            {tooltip}
          </div>
        </>
      )}
    </div>
  );
}

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
          "Growth in free cash flow after capital expenditures
