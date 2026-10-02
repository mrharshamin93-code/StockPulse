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
import { trackEvent } from "@/lib/analytics";
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
import {
  ALL_METRIC_DEFS,
  LONG_PRESS_MS,
  METRIC_GROUPS,
  POPULAR_SCREENS,
  SECTORS,
  TOOLTIP_VISIBLE_MS,
  UNSUPPORTED_FILTER_KEYS,
  UNSUPPORTED_METRIC_KEYS,
} from "@/config/screenerConfig";

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

  delete next.minRelativeVolume;
  delete next.maxRelativeVolume;

  UNSUPPORTED_FILTER_KEYS.forEach(
    (key) => {
      delete next[key];
    },
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

function sanitizeMetricKeys(
  keys,
) {
  return (Array.isArray(keys)
    ? keys
    : []
  ).filter(
    (key) =>
      key !==
        "relativeVolume" &&
      !UNSUPPORTED_METRIC_KEYS.has(
        key,
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
        sanitizeMetricKeys(
          readSessionObject(
            "screener_metrics",
            [],
          ) || [],
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
    showAllQuickScreens,
    setShowAllQuickScreens,
  ] = useState(false);

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
    if (
      UNSUPPORTED_METRIC_KEYS.has(
        key,
      )
    ) {
      return;
    }

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

      void trackEvent(
        "screener_run",
        {
          filter_keys:
            Object.keys(
              selectedFilters,
            ),
          preset:
            activePreset === null
              ? null
              : POPULAR_SCREENS[
                  activePreset
                ]?.label ||
                null,
        },
      );

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

        void trackEvent(
          "screener_result",
          {
            result_count:
              results.length,
          },
        );

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

        void trackEvent(
          "screener_result",
          {
            result_count: 0,
            failed: true,
          },
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
                "Unable to run the stock screen. Please try again.",
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
            active_metrics:
              sanitizeMetricKeys([
                ...activeMetrics,
              ]),
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
          "Unable to save this screen. Please try again.",
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
        sanitizeMetricKeys(
          screen
            ?.active_metrics ||
            screen
              ?.activeMetrics ||
            [],
        ),
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
    if (
      UNSUPPORTED_FILTER_KEYS.has(
        key,
      )
    ) {
      return;
    }

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
              onClick={() =>
                setShowAllQuickScreens(
                  (current) =>
                    !current,
                )
              }
              aria-expanded={
                showAllQuickScreens
              }
              className="min-h-9 rounded-lg px-2 text-xs font-medium text-black transition-colors hover:bg-gray-50 hover:text-black"
            >
              {showAllQuickScreens
                ? "Show Less"
                : "View All"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {(showAllQuickScreens
              ? POPULAR_SCREENS
              : POPULAR_SCREENS.slice(
                  0,
                  4,
                )
            ).map(
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
              data-screener-action-bar
              className="fixed inset-x-0 bottom-0 z-[10000] border-t border-gray-100 bg-white/95 px-4 pt-3 backdrop-blur-xl"
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
