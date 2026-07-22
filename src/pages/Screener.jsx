import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
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
const SCREENER_SESSION_KEY =
  "screener_paginated_results_v2";
const PAGE_SIZE = 12;

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
    (group) => group.metrics,
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
    document.body.classList.add(
      "screener-force-landscape",
    );

    return () => {
      document.body.classList.remove(
        "screener-force-landscape",
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
        window.sessionStorage.removeItem(
          SCREENER_SESSION_KEY,
        );

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
                page: 1,
                excludedTickers:
                  [],
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

        const resultSession = {
          version: 2,
          filters:
            selectedFilters,
          pages: [
            results,
          ],
          currentPage: 1,
          hasMore:
            Boolean(
              data?.hasMore ??
                results.length ===
                  PAGE_SIZE,
            ),
          generatedAt:
            Date.now(),
        };

        try {
          window.sessionStorage.setItem(
            "screener_last_results",
            JSON.stringify(
              results,
            ),
          );

          window.sessionStorage.setItem(
            SCREENER_SESSION_KEY,
            JSON.stringify(
              resultSession,
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
              screenerSession:
                resultSession,
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
      className="screener-landscape-shell flex min-h-screen flex-col"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",
        backgroundColor:
          "hsl(var(--background))",
      }}
    >
      <style>
        {`
          @media screen and (max-width: 767px) and (orientation: portrait) {
            body.screener-force-landscape {
              overflow: hidden !important;
            }

            .screener-landscape-shell {
              position: fixed !important;
              top: 0;
              left: 0;
              width: 100vh;
              width: 100dvh;
              height: 100vw;
              height: 100dvw;
              min-height: 100vw !important;
              min-height: 100dvw !important;
              transform: rotate(90deg) translateY(-100%);
              transform-origin: top left;
              overflow-x: hidden;
              overflow-y: auto;
              overscroll-behavior: contain;
              -webkit-overflow-scrolling: touch;
              z-index: 60;
              background: hsl(var(--background));
            }
          }
        `}
      </style>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <header
        className="sticky top-0 z-10 border-b border-gray-100"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
          backgroundColor:
            "hsl(var(--background))",
        }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={
              handleBack
            }
            aria-label="Go back"
            className="inline-flex min-h-[36px] items-center gap-1.5 justify-self-start px-2 py-1.5 text-sm font-semibold text-gray-900 transition-all hover:opacity-70 active:scale-95"
          >
            <ArrowLeft
              className="h-4 w-4 shrink-0"
              strokeWidth={
                2
              }
            />

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

          <div
            aria-hidden="true"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <div>
          <Label className="mb-2 block text-xs text-gray-500">
            Quick Screens
          </Label>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {POPULAR_SCREENS.map(
              (
                preset,
                index,
              ) => (
                <FilterChip
                  key={
                    preset.label
                  }
                  label={
                    preset.label
                  }
                  active={
                    activePreset ===
                    index
                  }
                  onClick={() =>
                    applyPreset(
                      preset,
                      index,
                    )
                  }
                />
              ),
            )}
          </div>

          {savedScreens.length >
            0 && (
            <div className="mt-3">
              <Label className="mb-2 block text-xs text-gray-500">
                Saved Screens
              </Label>

              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {savedScreens.map(
                  (screen) => (
                    <div
                      key={
                        screen.id
                      }
                      className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1.5 transition-colors hover:border-gray-400"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          loadSavedScreen(
                            screen,
                          )
                        }
                        className="whitespace-nowrap text-xs font-medium"
                      >
                        {
                          screen.name
                        }
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${screen.name}`}
                        onClick={(
                          event,
                        ) =>
                          deleteSavedScreen(
                            screen.id,
                            event,
                          )
                        }
                        className="p-0.5 text-muted-foreground transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className="space-y-5 rounded-2xl border border-gray-100 p-4"
          style={{
            backgroundColor:
              "hsl(var(--card))",
          }}
        >
          <p className="font-heading text-sm font-semibold">
            Filters
          </p>

          <div>
            <Label className="mb-2 block text-xs text-gray-500">
              Sector — choose one or more
            </Label>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="All"
                active={
                  selectedSectors.length ===
                  0
                }
                onClick={
                  clearSectors
                }
              />

              {SECTORS.map(
                (sector) => (
                  <FilterChip
                    key={
                      sector
                    }
                    label={
                      sector
                    }
                    active={selectedSectors.includes(
                      sector,
                    )}
                    onClick={() =>
                      toggleSector(
                        sector,
                      )
                    }
                  />
                ),
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="block text-xs text-gray-500">
              Metrics — tap to add a filter · press and hold for a description
            </Label>

            {METRIC_GROUPS.map(
              (group) => (
                <div
                  key={
                    group.group
                  }
                >
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {
                      group.group
                    }
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {group.metrics.map(
                      (
                        definition,
                      ) => (
                        <FilterChip
                          key={
                            definition.key
                          }
                          label={
                            definition.label
                          }
                          active={activeMetrics.has(
                            definition.key,
                          )}
                          onClick={() =>
                            toggleMetric(
                              definition.key,
                            )
                          }
                          tooltip={
                            definition.desc
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {activeMetrics.size >
            0 && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500">
                Active Filters
              </p>

              {ALL_METRIC_DEFS.filter(
                (definition) =>
                  activeMetrics.has(
                    definition.key,
                  ),
              ).map(
                (definition) => (
                  <div
                    key={
                      definition.key
                    }
                  >
                    <p className="mb-2 text-xs font-medium text-gray-900">
                      {
                        definition.label
                      }{" "}
                      <span className="font-normal text-gray-500">
                        (
                        {
                          definition.unit
                        }
                        )
                      </span>
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1 block text-[10px] text-gray-500">
                          Min
                        </Label>

                        <input
                          type="number"
                          step="any"
                          placeholder={
                            definition.minPlaceholder
                          }
                          value={
                            filters[
                              definition
                                .minKey
                            ] ?? ""
                          }
                          onChange={(
                            event,
                          ) =>
                            updateNumberFilter(
                              definition.minKey,
                              event.target
                                .value,
                            )
                          }
                          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                        />
                      </div>

                      <div>
                        <Label className="mb-1 block text-[10px] text-gray-500">
                          Max
                        </Label>

                        <input
                          type="number"
                          step="any"
                          placeholder={
                            definition.maxPlaceholder
                          }
                          value={
                            filters[
                              definition
                                .maxKey
                            ] ?? ""
                          }
                          onChange={(
                            event,
                          ) =>
                            updateNumberFilter(
                              definition.maxKey,
                              event.target
                                .value,
                            )
                          }
                          className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setActivePreset(
                  null,
                );

                void runScreen();
              }}
              disabled={
                loading
              }
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}

              Run Screen
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={
                loading
              }
              onClick={() => {
                setSaveName(
                  "",
                );

                setSaveDialogOpen(
                  true,
                );
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        {!loading && (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <SlidersHorizontal className="h-8 w-8 text-gray-400" />
            </div>

            <h2 className="mb-1 font-heading text-lg font-semibold text-gray-900">
              Find your next pick
            </h2>

            <p className="text-sm text-gray-500">
              Set filters above or pick a quick screen to get started.
            </p>
          </div>
        )}
      </main>

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
