import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
} from "framer-motion";
import {
  Check,
  Loader2,
  Menu,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
} from "lucide-react";

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

const sparklineCache = new Map();
const SPARKLINE_TTL = 5 * 60 * 1000;
const WATCHLIST_SORT_KEY = "stockpulse:watchlist-sort";

function getStoredSortMode() {
  try {
    const stored =
      window.localStorage.getItem(
        WATCHLIST_SORT_KEY,
      );

    return stored === "price"
      ? "price"
      : "percentage";
  } catch {
    return "percentage";
  }
}

function getStoredWatchlistId(userId) {
  if (!userId) {
    return null;
  }

  try {
    return window.localStorage.getItem(
      `stockpulse:active-watchlist:${userId}`,
    );
  } catch {
    return null;
  }
}

function storeActiveWatchlistId(
  userId,
  watchlistId,
) {
  if (!userId || !watchlistId) {
    return;
  }

  try {
    window.localStorage.setItem(
      `stockpulse:active-watchlist:${userId}`,
      watchlistId,
    );
  } catch {
    // Supabase remains the source of truth.
  }
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function smoothstep(value) {
  const normalized = clamp(value);

  return (
    normalized *
    normalized *
    (3 - 2 * normalized)
  );
}

function abbreviateExchange(exchange) {
  if (!exchange) {
    return "";
  }

  const value = String(exchange).toUpperCase();

  const rules = [
    [["NASDAQ"], "NASDAQ"],
    [["NYSE AMERICAN", "AMEX"], "AMEX"],
    [["NEW YORK STOCK EXCHANGE", "NYSE"], "NYSE"],
    [["OTC", "PINK"], "OTC"],
    [["CBOE", "BATS"], "CBOE"],
    [["TSX VENTURE", "TSXV"], "TSXV"],
    [["TSX", "TORONTO"], "TSX"],
    [["CSE", "CANADIAN SECURITIES"], "CSE"],
    [["LONDON", "LSE"], "LSE"],
    [["EURONEXT"], "ENX"],
    [["XETRA", "FRANKFURT"], "FRA"],
    [["ASX", "AUSTRALIAN"], "ASX"],
    [["TOKYO", "TSE"], "TSE"],
    [["HONG KONG", "HKEX"], "HKEX"],
  ];

  return (
    rules.find(([terms]) =>
      terms.some((term) =>
        value.includes(term),
      ),
    )?.[1] || exchange
  );
}

function getCompanyName(ticker, stock, item) {
  if (
    stock?.company_name &&
    stock.company_name !== ticker
  ) {
    return stock.company_name;
  }

  if (
    item?.company_name &&
    item.company_name !== ticker
  ) {
    return item.company_name;
  }

  return (
    stock?.company_name ||
    item?.company_name ||
    ticker
  );
}

async function finnhub(body, signal) {
  const response = await fetch(
    "/api/finnhub",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        `Market-data request failed with status ${response.status}`,
    );
  }

  return payload;
}

function normalizeSearchResults(payload) {
  const raw = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.result)
      ? payload.result
      : [];

  return raw
    .map((item) => ({
      ticker: String(
        item?.ticker ||
          item?.symbol ||
          item?.displaySymbol ||
          "",
      )
        .trim()
        .toUpperCase(),
      name: String(
        item?.name ||
          item?.description ||
          item?.displaySymbol ||
          "",
      ).trim(),
      exchange: String(
        item?.exchange ||
          item?.primaryExchange ||
          item?.mic ||
          "",
      ).trim(),
    }))
    .filter((item) => item.ticker);
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(
      onDone,
      2500,
    );

    return () =>
      window.clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -14,
        scale: 0.96,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -10,
        scale: 0.96,
      }}
      className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full bg-gray-950/95 px-4 py-2 text-sm font-medium text-white shadow-[0_12px_35px_rgba(15,23,42,0.28)] backdrop-blur-xl"
    >
      {message}
    </motion.div>
  );
}

function AddToPortfolioDialog({
  open,
  onOpenChange,
  ticker,
  companyName,
  userId,
  onAdded,
}) {
  const [quantity, setQuantity] =
    useState("");

  const [purchasePrice, setPurchasePrice] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  useEffect(() => {
    if (!open) {
      setQuantity("");
      setPurchasePrice("");
      setFormError("");
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();

    const shares = Number(quantity);
    const cost = Number(purchasePrice);

    if (
      !userId ||
      !Number.isFinite(shares) ||
      shares <= 0 ||
      !Number.isFinite(cost) ||
      cost <= 0
    ) {
      setFormError(
        "Enter a valid quantity and purchase price.",
      );

      return;
    }

    setLoading(true);
    setFormError("");

    try {
      let currentPrice = cost;

      try {
        const quote = await finnhub({
          action: "quote",
          ticker,
        });

        if (Number(quote?.c) > 0) {
          currentPrice = Number(quote.c);
        }
      } catch (error) {
        console.warn(
          "Quote refresh failed:",
          error,
        );
      }

      const { error } = await supabase
        .from("stocks")
        .insert({
          user_id: userId,
          ticker: ticker.toUpperCase(),
          company_name: companyName,
          quantity: shares,
          purchase_price: cost,
          current_price: currentPrice,
          sector: "",
        });

      if (error) {
        throw error;
      }

      setQuantity("");
      setPurchasePrice("");

      await onAdded();
    } catch (error) {
      setFormError(
        error?.message ||
          "Unable to add this stock.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Add {ticker} to Portfolio
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 text-sm text-muted-foreground">
          {companyName}
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 pt-2"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="watchlist-shares">
                Shares
              </Label>

              <Input
                id="watchlist-shares"
                type="number"
                step="any"
                min="0.000001"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="watchlist-price">
                Avg. Purchase Price
              </Label>

              <Input
                id="watchlist-price"
                type="number"
                step="any"
                min="0.01"
                value={purchasePrice}
                onChange={(event) =>
                  setPurchasePrice(
                    event.target.value,
                  )
                }
                required
              />
            </div>
          </div>

          {formError && (
            <p className="text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !quantity ||
              !purchasePrice
            }
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            Add to Portfolio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTickerDialog({
  open,
  onOpenChange,
  ticker,
  setTicker,
  suggestions,
  searching,
  adding,
  items,
  stocks,
  onAdd,
}) {
  function handleOpenChange(nextOpen) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setTicker("");
    }
  }

  function submitTicker(event) {
    event.preventDefault();

    if (ticker.trim()) {
      void onAdd(ticker);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-gray-100 px-5 pb-4 pt-5">
          <DialogTitle className="font-heading text-xl">
            Add to Watchlist
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-col px-5 pb-5">
          <form
            onSubmit={submitTicker}
            className="flex gap-2 pt-4"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <Input
                value={ticker}
                placeholder="Search ticker or company"
                className="pl-9 uppercase placeholder:normal-case"
                autoComplete="off"
                autoFocus
                onChange={(event) =>
                  setTicker(
                    event.target.value,
                  )
                }
              />
            </div>

            <Button
              type="submit"
              disabled={
                adding ||
                !ticker.trim()
              }
              className="shrink-0"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}

              <span className="hidden sm:inline">
                Add
              </span>
            </Button>
          </form>

          <div className="mt-3 min-h-0 overflow-y-auto rounded-xl border border-gray-100">
            {!ticker.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Search for a stock by ticker or company name.
              </div>
            ) : searching ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No suggestions found. You can still add the ticker above.
              </div>
            ) : (
              suggestions.map((suggestion) => {
                const alreadyAdded = items.some(
                  (item) =>
                    item.ticker.toUpperCase() ===
                    suggestion.ticker,
                );

                const inPortfolio = stocks.some(
                  (stock) =>
                    stock.ticker.toUpperCase() ===
                    suggestion.ticker,
                );

                return (
                  <button
                    key={`${suggestion.ticker}-${suggestion.exchange}`}
                    type="button"
                    disabled={alreadyAdded || adding}
                    onClick={() =>
                      void onAdd(
                        suggestion.ticker,
                        suggestion.exchange,
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-0 ${
                      alreadyAdded
                        ? "cursor-not-allowed opacity-40"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {suggestion.ticker}
                        </p>

                        {suggestion.exchange && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                            {abbreviateExchange(
                              suggestion.exchange,
                            )}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {suggestion.name ||
                          suggestion.ticker}
                      </p>
                    </div>

                    {alreadyAdded ? (
                      <span className="shrink-0 text-xs text-gray-400">
                        Added
                      </span>
                    ) : inPortfolio ? (
                      <span className="shrink-0 text-xs text-amber-500">
                        In portfolio
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function fetchSparkline(
  ticker,
  signal,
) {
  const key = ticker.toUpperCase();
  const cached = sparklineCache.get(key);

  if (
    cached &&
    Date.now() - cached.timestamp <
      SPARKLINE_TTL
  ) {
    return cached.data;
  }

  const to = Math.floor(
    Date.now() / 1000,
  );

  const from = to - 30 * 86400;

  const payload = await finnhub(
    {
      action: "candles_range",
      ticker,
      resolution: "D",
      from,
      to,
    },
    signal,
  );

  const data = Array.isArray(
    payload?.candles,
  )
    ? payload.candles
        .map((candle) =>
          Number(candle?.v),
        )
        .filter(Number.isFinite)
    : [];

  if (data.length < 2) {
    return null;
  }

  sparklineCache.set(key, {
    data,
    timestamp: Date.now(),
  });

  return data;
}

function MiniSparkline({
  data,
  isPositive,
}) {
  const width = 44;
  const height = 34;
  const padding = 2;

  const color = isPositive
    ? "#10b981"
    : "#ef4444";

  let points;

  if (data?.length >= 2) {
    const minimum = Math.min(...data);
    const maximum = Math.max(...data);
    const range = maximum - minimum || 1;

    points = data
      .map((price, index) => {
        const x =
          padding +
          (index /
            (data.length - 1)) *
            (width - padding * 2);

        const y =
          padding +
          ((maximum - price) / range) *
            (height - padding * 2);

        return `${x},${y}`;
      })
      .join(" ");
  } else {
    return (
      <div
        className="flex h-[34px] w-[44px] items-center justify-center text-xs text-gray-300"
        aria-label="Chart unavailable"
      >
        —
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sparkline({
  ticker,
  isPositive,
}) {
  const [data, setData] =
    useState(null);

  useEffect(() => {
    const controller =
      new AbortController();

    fetchSparkline(
      ticker,
      controller.signal,
    )
      .then(setData)
      .catch((error) => {
        if (
          error?.name !==
          "AbortError"
        ) {
          console.warn(
            `Sparkline failed for ${ticker}:`,
            error,
          );
        }
      });

    return () =>
      controller.abort();
  }, [ticker]);

  return (
    <MiniSparkline
      data={data}
      isPositive={isPositive}
    />
  );
}

function AnimatedPrice({ value }) {
  const [flash, setFlash] =
    useState(null);

  const previous = useRef(value);

  useEffect(() => {
    if (
      previous.current !== value &&
      value !== "—"
    ) {
      const oldValue = Number(
        previous.current,
      );

      const newValue = Number(value);

      if (
        Number.isFinite(oldValue) &&
        Number.isFinite(newValue)
      ) {
        setFlash(
          newValue > oldValue
            ? "up"
            : "down",
        );

        const timer =
          window.setTimeout(
            () => setFlash(null),
            700,
          );

        previous.current = value;

        return () =>
          window.clearTimeout(timer);
      }
    }

    previous.current = value;
    return undefined;
  }, [value]);

  return (
    <span
      className="text-lg font-semibold tracking-tight transition-colors duration-500"
      style={{
        color:
          flash === "up"
            ? "#10b981"
            : flash === "down"
              ? "#ef4444"
              : undefined,
      }}
    >
      {value === "—"
        ? "—"
        : `$${value}`}
    </span>
  );
}

function SwipeAction({
  type,
  label,
  icon: Icon,
  progress,
  disabled,
  onClick,
}) {
  const deleteAction =
    type === "delete";

  const visible = smoothstep(progress);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border text-white outline-none transition-colors ${
        deleteAction
          ? "border-red-400 bg-red-500 hover:bg-red-600"
          : "border-sky-400 bg-sky-500 hover:bg-sky-600"
      }`}
      style={{
        opacity: visible,
        transform: `translateX(${(1 - visible) * 22}px) scale(${0.55 + visible * 0.45})`,
        boxShadow: deleteAction
          ? "0 7px 18px rgba(239,68,68,.28)"
          : "0 7px 18px rgba(14,165,233,.28)",
        pointerEvents:
          disabled || visible < 0.76
            ? "none"
            : "auto",
      }}
    >
      <Icon className="h-4 w-4" />

      <span className="text-[8px] font-bold leading-none">
        {label}
      </span>
    </button>
  );
}

function WatchlistCard({
  item,
  stock,
  quote,
  index,
  onRemove,
  onStarToggle,
  onRequestPortfolioRemoval,
}) {
  const navigate = useNavigate();
  const hasStock = Boolean(stock);

  const companyName = getCompanyName(
    item.ticker,
    stock,
    item,
  );

  const [dragX, setDragX] =
    useState(0);

  const [swiped, setSwiped] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const touchX = useRef(null);
  const touchY = useRef(null);
  const startDragX = useRef(0);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const revealWidth = 112;

  const revealProgress = clamp(
    Math.abs(dragX) / revealWidth,
  );

  const deleteProgress = clamp(
    revealProgress / 0.55,
  );

  const shareProgress = clamp(
    (revealProgress - 0.34) /
      0.66,
  );

  const livePrice =
    typeof quote?.c === "number"
      ? quote.c
      : null;

  const storedPrice =
    typeof stock?.current_price ===
    "number"
      ? stock.current_price
      : null;

  const displayPrice =
    livePrice !== null
      ? livePrice.toFixed(2)
      : storedPrice !== null
        ? storedPrice.toFixed(2)
        : "—";

  const dailyGain =
    typeof quote?.dp === "number"
      ? quote.dp
      : null;

  const positive =
    (dailyGain ?? 0) >= 0;

  const linkTo =
    hasStock &&
    stock?.id &&
    stock.id !== "undefined"
      ? `/stock/${stock.id}`
      : `/stock/ticker-${item.ticker}`;

  function onTouchStart(event) {
    if (deleting) {
      return;
    }

    touchX.current =
      event.touches[0].clientX;

    touchY.current =
      event.touches[0].clientY;

    startDragX.current = dragX;
    dragging.current = false;
    suppressClick.current = false;
  }

  function onTouchMove(event) {
    if (
      touchX.current === null ||
      touchY.current === null ||
      deleting
    ) {
      return;
    }

    const dx =
      event.touches[0].clientX -
      touchX.current;

    const dy =
      event.touches[0].clientY -
      touchY.current;

    if (
      !dragging.current &&
      Math.abs(dy) > Math.abs(dx)
    ) {
      return;
    }

    if (Math.abs(dx) > 5) {
      dragging.current = true;
      suppressClick.current = true;
    }

    if (!dragging.current) {
      return;
    }

    event.stopPropagation();

    setDragX(
      clamp(
        startDragX.current + dx,
        -126,
        0,
      ),
    );
  }

  function onTouchEnd() {
    if (deleting) {
      return;
    }

    const threshold = swiped
      ? revealWidth * 0.28
      : revealWidth * 0.42;

    if (
      Math.abs(dragX) >= threshold
    ) {
      setDragX(-revealWidth);
      setSwiped(true);
    } else {
      setDragX(0);
      setSwiped(false);
    }

    touchX.current = null;
    touchY.current = null;
    dragging.current = false;

    window.setTimeout(() => {
      suppressClick.current = false;
    }, 100);
  }

  function closeSwipe() {
    setDragX(0);
    setSwiped(false);
  }

  async function share(event) {
    event.preventDefault();
    event.stopPropagation();

    const url =
      `${window.location.origin}${linkTo}`;

    const text =
      `${companyName} (${item.ticker})` +
      (displayPrice === "—"
        ? ""
        : ` — $${displayPrice}`);

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.ticker,
          text,
          url,
        });
      } else {
        await navigator.clipboard?.writeText(
          `${text} ${url}`,
        );
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn(
          "Share failed:",
          error,
        );
      }
    } finally {
      closeSwipe();
    }
  }

  async function remove(event) {
    event.preventDefault();
    event.stopPropagation();

    if (deleting) {
      return;
    }

    if (hasStock) {
      closeSwipe();
      onRequestPortfolioRemoval(item, stock);
      return;
    }

    setDeleting(true);
    setDragX(-420);

    await new Promise((resolve) =>
      window.setTimeout(resolve, 240),
    );

    const removed = await onRemove(
      item.id,
    );

    if (!removed) {
      setDeleting(false);
      closeSwipe();
    }
  }

  function handleCardClick(event) {
    if (
      swiped ||
      suppressClick.current ||
      deleting
    ) {
      event.preventDefault();
      closeSwipe();
      return;
    }

    navigate(linkTo, {
      state: {
        from: "/watchlist",
      },
    });
  }

  function handleCardKeyDown(event) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      handleCardClick(event);
    }
  }

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: deleting ? 0 : 1,
        y: 0,
        scale: deleting ? 0.96 : 1,
      }}
      exit={{
        opacity: 0,
        x: -80,
        scale: 0.94,
      }}
      transition={{
        duration: 0.24,
        delay: index * 0.035,
      }}
      className="relative overflow-hidden rounded-2xl"
    >
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
        <SwipeAction
          type="share"
          label="Share"
          icon={Share2}
          progress={shareProgress}
          disabled={deleting}
          onClick={share}
        />

        <SwipeAction
          type="delete"
          label="Delete"
          icon={Trash2}
          progress={deleteProgress}
          disabled={deleting}
          onClick={remove}
        />
      </div>

      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className="block cursor-pointer"
      >
        <div
          className="flex h-[78px] items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-[0_4px_15px_rgba(15,23,42,0.045)] transition-[box-shadow,border-color] hover:border-gray-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]"
          style={{
            backgroundColor:
              "hsl(var(--card))",
            transform:
              `translateX(${dragX}px)`,
            transition: dragging.current
              ? "none"
              : "transform .3s cubic-bezier(.22,1,.36,1)",
            touchAction: "pan-y",
            willChange: "transform",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <button
            type="button"
            aria-label={
              hasStock
                ? `Remove ${item.ticker} from portfolio`
                : `Add ${item.ticker} to portfolio`
            }
            onTouchStart={(event) => {
              event.stopPropagation();
            }}
            onTouchEnd={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();

              if (hasStock) {
                onRequestPortfolioRemoval(
                  item,
                  stock,
                );
                return;
              }

              onStarToggle(item, stock);
            }}
            className="flex min-h-[44px] min-w-[34px] shrink-0 items-center justify-center p-1"
          >
            <Star
              className={`h-5 w-5 ${
                hasStock
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="truncate font-heading text-base font-bold leading-[1.05] text-gray-900">
              {item.ticker}
            </p>

            <p className="mt-1 truncate text-[11px] leading-tight text-gray-500">
              {companyName}
            </p>

            {item.exchange ? (
              <p className="mt-1 truncate text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-gray-400">
                {abbreviateExchange(
                  item.exchange,
                )}
              </p>
            ) : (
              <span className="mt-1 h-[9px]" />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="flex w-[44px] shrink-0 items-center justify-center">
              <Sparkline
                ticker={item.ticker}
                isPositive={positive}
              />
            </div>

            <div className="min-w-[76px] shrink-0 text-right">
              <p className="leading-none">
                <AnimatedPrice
                  value={displayPrice}
                />
              </p>

              {dailyGain !== null ? (
                <div
                  className={`mt-1.5 inline-flex min-w-[64px] items-center justify-center rounded-lg px-2.5 py-1 text-sm font-semibold leading-none text-white ${
                    positive
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                >
                  {positive ? "+" : ""}
                  {dailyGain.toFixed(2)}%
                </div>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  —
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Watchlist() {
  const { user } = useAuth();

  const {
    quotes = {},
    refreshQuotes,
  } = useMarketData();

  const [items, setItems] =
    useState([]);

  const [stocks, setStocks] =
    useState([]);

  const [watchlists, setWatchlists] =
    useState([]);

  const [
    activeWatchlistId,
    setActiveWatchlistId,
  ] = useState(null);

  const [
    watchlistMenuOpen,
    setWatchlistMenuOpen,
  ] = useState(false);

  const [
    newWatchlistName,
    setNewWatchlistName,
  ] = useState("");

  const [
    watchlistSaving,
    setWatchlistSaving,
  ] = useState(false);

  const [sortMode, setSortMode] =
    useState(getStoredSortMode);

  const [loading, setLoading] =
    useState(true);

  const [addDialogOpen, setAddDialogOpen] =
    useState(false);

  const [ticker, setTicker] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const [suggestions, setSuggestions] =
    useState([]);

  const [searching, setSearching] =
    useState(false);

  const [toast, setToast] =
    useState(null);

  const [dialogItem, setDialogItem] =
    useState(null);

  const [portfolioRemoval, setPortfolioRemoval] =
    useState(null);

  const searchTimer = useRef(null);

  const loadWatchlists =
    useCallback(async () => {
      if (!user?.id) {
        return [];
      }

      let { data, error } =
        await supabase
          .from("watchlists")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", {
            ascending: false,
          })
          .order("created_at", {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      let nextWatchlists =
        data || [];

      if (
        nextWatchlists.length === 0
      ) {
        const {
          data: created,
          error: createError,
        } = await supabase
          .from("watchlists")
          .insert({
            user_id: user.id,
            name: "Watchlist",
            is_default: true,
          })
          .select("*")
          .single();

        if (createError) {
          throw createError;
        }

        nextWatchlists = [
          created,
        ];
      }

      setWatchlists(
        nextWatchlists,
      );

      setActiveWatchlistId(
        (currentId) => {
          const storedId =
            getStoredWatchlistId(
              user.id,
            );

          const nextId =
            nextWatchlists.some(
              (list) =>
                list.id ===
                currentId,
            )
              ? currentId
              : nextWatchlists.some(
                    (list) =>
                      list.id ===
                      storedId,
                  )
                ? storedId
                : (
                    nextWatchlists.find(
                      (list) =>
                        list.is_default,
                    ) ||
                    nextWatchlists[0]
                  )?.id;

          if (nextId) {
            storeActiveWatchlistId(
              user.id,
              nextId,
            );
          }

          return nextId || null;
        },
      );

      return nextWatchlists;
    }, [user?.id]);

  const refreshWatchlistQuotes =
    useCallback(
      (watchItems) => {
        const tickers = [
          ...new Set(
            (watchItems || [])
              .map((item) =>
                item?.ticker?.toUpperCase(),
              )
              .filter(Boolean),
          ),
        ];

        if (tickers.length) {
          refreshQuotes(tickers);
        }
      },
      [refreshQuotes],
    );

  const load = useCallback(async () => {
    if (
      !user?.id ||
      !activeWatchlistId
    ) {
      return [];
    }

    const [
      watchlistResult,
      stocksResult,
    ] = await Promise.all([
      supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .eq(
          "watchlist_id",
          activeWatchlistId,
        )
        .order("created_at", {
          ascending: false,
        }),
      supabase
        .from("stocks")
        .select("*")
        .eq("user_id", user.id),
    ]);

    if (watchlistResult.error) {
      throw watchlistResult.error;
    }

    if (stocksResult.error) {
      throw stocksResult.error;
    }

    const watchItems =
      watchlistResult.data || [];

    const portfolioStocks =
      (stocksResult.data || []).filter(
        (stock) =>
          stock?.id &&
          stock.id !== "undefined",
      );

    setItems(watchItems);
    setStocks(portfolioStocks);

    return watchItems;
  }, [
    user?.id,
    activeWatchlistId,
  ]);

  useEffect(() => {
    if (!user?.id) {
      setWatchlists([]);
      setActiveWatchlistId(null);
      setItems([]);
      setStocks([]);
      setLoading(false);
      return undefined;
    }

    let active = true;

    setLoading(true);

    loadWatchlists().catch(
      (error) => {
        if (!active) {
          return;
        }

        console.error(
          "Unable to load watchlists:",
          error,
        );

        setToast(
          "Unable to load watchlists.",
        );

        setLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [
    user?.id,
    loadWatchlists,
  ]);

  useEffect(() => {
    const query = ticker.trim();

    if (!addDialogOpen || !query) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    window.clearTimeout(
      searchTimer.current,
    );

    const controller =
      new AbortController();

    searchTimer.current =
      window.setTimeout(async () => {
        setSearching(true);

        try {
          const payload = await finnhub(
            {
              action: "search",
              query,
            },
            controller.signal,
          );

          const upper =
            query.toUpperCase();

          setSuggestions(
            normalizeSearchResults(payload)
              .filter(
                (item) =>
                  item.ticker.includes(upper) ||
                  item.name
                    .toUpperCase()
                    .includes(upper),
              )
              .slice(0, 12),
          );
        } catch (error) {
          if (
            error?.name !==
            "AbortError"
          ) {
            setSuggestions([]);
          }
        } finally {
          if (
            !controller.signal.aborted
          ) {
            setSearching(false);
          }
        }
      }, 250);

    return () => {
      window.clearTimeout(
        searchTimer.current,
      );

      controller.abort();
    };
  }, [ticker, addDialogOpen]);

  useEffect(() => {
    if (
      !user?.id ||
      !activeWatchlistId
    ) {
      return undefined;
    }

    let active = true;

    setLoading(true);

    load()
      .then((watchItems) => {
        if (active) {
          refreshWatchlistQuotes(
            watchItems,
          );
        }
      })
      .catch((error) => {
        if (active) {
          console.error(error);
          setToast(
            "Unable to load watchlist.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    user?.id,
    activeWatchlistId,
    load,
    refreshWatchlistQuotes,
  ]);

  useEffect(() => {
    if (!items.length) {
      return undefined;
    }

    const timer = window.setInterval(
      () =>
        refreshWatchlistQuotes(items),
      30000,
    );

    return () =>
      window.clearInterval(timer);
  }, [
    items,
    refreshWatchlistQuotes,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      !activeWatchlistId
    ) {
      return undefined;
    }

    async function reloadWatchlist() {
      const { data, error } =
        await supabase
          .from("watchlist_items")
          .select("*")
          .eq("user_id", user.id)
          .eq(
            "watchlist_id",
            activeWatchlistId,
          )
          .order("created_at", {
            ascending: false,
          });

      if (!error) {
        setItems(data || []);
        refreshWatchlistQuotes(
          data || [],
        );
      }
    }

    async function reloadStocks() {
      const { data, error } =
        await supabase
          .from("stocks")
          .select("*")
          .eq("user_id", user.id);

      if (!error) {
        setStocks(
          (data || []).filter(
            (stock) =>
              stock?.id &&
              stock.id !== "undefined",
          ),
        );
      }
    }

    const channel = supabase
      .channel(
        `watchlist-${user.id}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlist_items",
          filter:
            `user_id=eq.${user.id}`,
        },
        reloadWatchlist,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stocks",
          filter:
            `user_id=eq.${user.id}`,
        },
        reloadStocks,
      )
      .subscribe();

    return () =>
      supabase.removeChannel(channel);
  }, [
    user?.id,
    activeWatchlistId,
    refreshWatchlistQuotes,
  ]);

  function changeSortMode(
    nextMode,
  ) {
    const normalizedMode =
      nextMode === "price"
        ? "price"
        : "percentage";

    setSortMode(
      normalizedMode,
    );

    try {
      window.localStorage.setItem(
        WATCHLIST_SORT_KEY,
        normalizedMode,
      );
    } catch {
      // The in-memory preference still applies.
    }
  }

  function switchWatchlist(
    watchlistId,
  ) {
    if (
      !watchlistId ||
      watchlistId ===
        activeWatchlistId
    ) {
      setWatchlistMenuOpen(false);
      return;
    }

    setLoading(true);
    setItems([]);
    setActiveWatchlistId(
      watchlistId,
    );

    storeActiveWatchlistId(
      user?.id,
      watchlistId,
    );

    setWatchlistMenuOpen(false);
  }

  async function createWatchlist(
    event,
  ) {
    event.preventDefault();

    const name =
      newWatchlistName.trim();

    if (
      !user?.id ||
      !name ||
      watchlistSaving
    ) {
      return;
    }

    setWatchlistSaving(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("watchlists")
        .insert({
          user_id: user.id,
          name,
          is_default: false,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setWatchlists(
        (current) => [
          ...current,
          data,
        ],
      );

      setNewWatchlistName("");
      setItems([]);
      setLoading(true);
      setActiveWatchlistId(
        data.id,
      );

      storeActiveWatchlistId(
        user.id,
        data.id,
      );

      setWatchlistMenuOpen(false);

      setToast(
        `${data.name} created`,
      );
    } catch (error) {
      setToast(
        error?.code === "23505"
          ? "A watchlist with that name already exists."
          : error?.message ||
              "Unable to create watchlist.",
      );
    } finally {
      setWatchlistSaving(false);
    }
  }

  async function deleteWatchlist(
    watchlist,
  ) {
    if (
      !user?.id ||
      !watchlist?.id ||
      watchlist.is_default ||
      watchlistSaving
    ) {
      return;
    }

    setWatchlistSaving(true);

    try {
      const { error } =
        await supabase
          .from("watchlists")
          .delete()
          .eq(
            "id",
            watchlist.id,
          )
          .eq(
            "user_id",
            user.id,
          );

      if (error) {
        throw error;
      }

      const remaining =
        watchlists.filter(
          (list) =>
            list.id !==
            watchlist.id,
        );

      setWatchlists(
        remaining,
      );

      if (
        activeWatchlistId ===
        watchlist.id
      ) {
        const next =
          remaining.find(
            (list) =>
              list.is_default,
          ) ||
          remaining[0] ||
          null;

        setItems([]);
        setLoading(
          Boolean(next),
        );

        setActiveWatchlistId(
          next?.id || null,
        );

        if (next?.id) {
          storeActiveWatchlistId(
            user.id,
            next.id,
          );
        }
      }

      setToast(
        `${watchlist.name} deleted`,
      );
    } catch (error) {
      setToast(
        error?.message ||
          "Unable to delete watchlist.",
      );
    } finally {
      setWatchlistSaving(false);
    }
  }

  async function addTicker(
    symbol,
    exchange = "",
  ) {
    const normalized = String(
      symbol || "",
    )
      .trim()
      .toUpperCase();

    if (
      !normalized ||
      !user?.id ||
      !activeWatchlistId ||
      adding
    ) {
      return false;
    }

    if (
      items.some(
        (item) =>
          item.ticker.toUpperCase() ===
          normalized,
      )
    ) {
      setToast(
        `"${normalized}" is already in your watchlist.`,
      );

      return false;
    }

    setAdding(true);

    try {
      let companyName = "";
      let resolvedExchange = exchange;

      try {
        const profile = await finnhub({
          action: "profile",
          ticker: normalized,
        });

        companyName = profile?.name || "";

        resolvedExchange =
          resolvedExchange ||
          profile?.exchange ||
          "";
      } catch (error) {
        console.warn(
          "Profile lookup failed:",
          error,
        );
      }

      const { error } = await supabase
        .from("watchlist_items")
        .insert({
          user_id: user.id,
          watchlist_id:
            activeWatchlistId,
          ticker: normalized,
          exchange: resolvedExchange,
          company_name:
            companyName || normalized,
        });

      if (error) {
        throw error;
      }

      setTicker("");
      setSuggestions([]);
      setAddDialogOpen(false);

      const watchItems = await load();

      refreshWatchlistQuotes(
        watchItems,
      );

      setToast(
        `${normalized} added to watchlist`,
      );

      return true;
    } catch (error) {
      setToast(
        error?.message ||
          "Failed to add ticker.",
      );

      return false;
    } finally {
      setAdding(false);
    }
  }

  async function removeTicker(id) {
    const previous = items;

    const next = items.filter(
      (item) => item.id !== id,
    );

    setItems(next);

    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setItems(previous);
      setToast(
        "Failed to remove ticker.",
      );

      return false;
    }

    setToast(
      "Removed from watchlist",
    );

    return true;
  }

  function requestPortfolioRemoval(
    item,
    stock,
  ) {
    if (!item || !stock) {
      return;
    }

    setPortfolioRemoval({ item, stock });
  }

  async function confirmPortfolioRemoval() {
    if (!portfolioRemoval || !user?.id) {
      return;
    }

    const { item, stock } = portfolioRemoval;
    const previous = stocks;

    setPortfolioRemoval(null);
    setStocks((value) =>
      value.filter(
        (entry) => entry.id !== stock.id,
      ),
    );

    const { error } = await supabase
      .from("stocks")
      .delete()
      .eq("id", stock.id)
      .eq("user_id", user.id);

    if (error) {
      setStocks(previous);
      setToast(
        "Failed to update portfolio.",
      );
      return;
    }

    setToast(
      `${item.ticker} removed from portfolio`,
    );
  }

  function togglePortfolio(
    item,
    stock,
  ) {
    if (stock) {
      requestPortfolioRemoval(item, stock);
      return;
    }

    setDialogItem({
      ticker: item.ticker,
      companyName: getCompanyName(
        item.ticker,
        null,
        item,
      ),
    });
  }

  const stockForTicker = useCallback(
    (value) =>
      stocks.find(
        (stock) =>
          stock.ticker.toUpperCase() ===
          value.toUpperCase(),
      ),
    [stocks],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => {
          const aTicker =
            a.ticker.toUpperCase();

          const bTicker =
            b.ticker.toUpperCase();

          const aStock =
            stocks.find(
              (stock) =>
                stock.ticker.toUpperCase() ===
                aTicker,
            );

          const bStock =
            stocks.find(
              (stock) =>
                stock.ticker.toUpperCase() ===
                bTicker,
            );

          const aValue =
            sortMode === "price"
              ? Number(
                  quotes[aTicker]?.c ??
                    aStock?.current_price,
                )
              : Number(
                  quotes[aTicker]?.dp,
                );

          const bValue =
            sortMode === "price"
              ? Number(
                  quotes[bTicker]?.c ??
                    bStock?.current_price,
                )
              : Number(
                  quotes[bTicker]?.dp,
                );

          const normalizedA =
            Number.isFinite(aValue)
              ? aValue
              : -Infinity;

          const normalizedB =
            Number.isFinite(bValue)
              ? bValue
              : -Infinity;

          if (
            normalizedA !==
            normalizedB
          ) {
            return (
              normalizedB -
              normalizedA
            );
          }

          return aTicker.localeCompare(
            bTicker,
          );
        },
      ),
    [
      items,
      quotes,
      stocks,
      sortMode,
    ],
  );

  const activeWatchlist =
    watchlists.find(
      (list) =>
        list.id ===
        activeWatchlistId,
    ) ||
    watchlists.find(
      (list) =>
        list.is_default,
    ) ||
    watchlists[0] ||
    null;

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast}
            onDone={() =>
              setToast(null)
            }
          />
        )}
      </AnimatePresence>

      <Dialog
        open={watchlistMenuOpen}
        onOpenChange={
          setWatchlistMenuOpen
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Watchlist Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-1">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Sort by
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    changeSortMode(
                      "percentage",
                    )
                  }
                  className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    sortMode ===
                    "percentage"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Percentage

                  {sortMode ===
                    "percentage" && (
                    <Check className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeSortMode(
                      "price",
                    )
                  }
                  className={`flex min-h-[44px] items-center justify-between rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    sortMode ===
                    "price"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Price

                  {sortMode ===
                    "price" && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Switch Watchlist
              </p>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-1">
                {watchlists.map(
                  (watchlist) => {
                    const active =
                      watchlist.id ===
                      activeWatchlistId;

                    return (
                      <div
                        key={
                          watchlist.id
                        }
                        className={`flex items-center gap-2 rounded-lg ${
                          active
                            ? "bg-gray-100"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            switchWatchlist(
                              watchlist.id,
                            )
                          }
                          className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between px-3 text-left text-sm font-semibold text-gray-900"
                        >
                          <span className="truncate">
                            {
                              watchlist.name
                            }
                          </span>

                          {active && (
                            <Check className="h-4 w-4 shrink-0" />
                          )}
                        </button>

                        {!watchlist.is_default && (
                          <button
                            type="button"
                            aria-label={`Delete ${watchlist.name}`}
                            disabled={
                              watchlistSaving
                            }
                            onClick={() =>
                              void deleteWatchlist(
                                watchlist,
                              )
                            }
                            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                New Watchlist
              </p>

              <form
                onSubmit={
                  createWatchlist
                }
                className="flex gap-2"
              >
                <Input
                  value={
                    newWatchlistName
                  }
                  maxLength={40}
                  placeholder="e.g. Growth Stocks"
                  onChange={(event) =>
                    setNewWatchlistName(
                      event.target.value,
                    )
                  }
                />

                <Button
                  type="submit"
                  disabled={
                    watchlistSaving ||
                    !newWatchlistName.trim()
                  }
                  className="shrink-0"
                >
                  {watchlistSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
              </form>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AddTickerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        ticker={ticker}
        setTicker={setTicker}
        suggestions={suggestions}
        searching={searching}
        adding={adding}
        items={items}
        stocks={stocks}
        onAdd={addTicker}
      />

      <Dialog
        open={Boolean(portfolioRemoval)}
        onOpenChange={(open) => {
          if (!open) {
            setPortfolioRemoval(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>
              Confirm portfolio removal
            </DialogTitle>
          </DialogHeader>

          <p className="pt-1 text-center text-base font-medium text-gray-900">
            Remove {portfolioRemoval?.item?.ticker} from your portfolio?
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPortfolioRemoval(null)
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void confirmPortfolioRemoval()
              }
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {dialogItem && (
        <AddToPortfolioDialog
          open
          ticker={dialogItem.ticker}
          companyName={
            dialogItem.companyName
          }
          userId={user?.id}
          onOpenChange={(open) => {
            if (!open) {
              setDialogItem(null);
            }
          }}
          onAdded={async () => {
            const addedTicker =
              dialogItem.ticker;

            setDialogItem(null);
            await load();

            setToast(
              `${addedTicker} added to portfolio`,
            );
          }}
        />
      )}

      <header className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-[44px_1fr_44px] items-center px-4 py-4 sm:px-6">
          <button
            type="button"
            aria-label="Open watchlist settings"
            onClick={() =>
              setWatchlistMenuOpen(
                true,
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-900 transition-colors hover:bg-gray-100 active:scale-95"
          >
            <Menu
              className="h-6 w-6"
              strokeWidth={1.8}
            />
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1">
            <Star className="h-9 w-9 shrink-0 fill-amber-400 text-amber-400" />

            <h1 className="truncate font-heading text-2xl font-bold leading-none text-gray-900">
              {activeWatchlist?.name ||
                "Watchlist"}
            </h1>
          </div>

          <div aria-hidden="true" />
        </div>
      </header>

      <button
        type="button"
        aria-label="Add stock to watchlist"
        onClick={() => setAddDialogOpen(true)}
        className="fixed left-1/2 z-50 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-lg backdrop-blur-md transition-transform active:scale-95"
        style={{
          bottom:
            "calc(env(safe-area-inset-bottom) + 68px)",
        }}
      >
        <Plus className="h-6 w-6 text-gray-800" />
      </button>

      <main
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-2 sm:px-6 sm:pt-3"
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom) + 9rem)",
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
            <Star className="mx-auto h-8 w-8 fill-amber-400 text-amber-400" />

            <h2 className="mt-3 font-semibold text-gray-900">
              Nothing in this watchlist yet
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Tap the + button below to add your first stock.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="space-y-[3px]"
          >
            <AnimatePresence
              initial={false}
              mode="popLayout"
            >
              {sortedItems.map(
                (item, index) => (
                  <WatchlistCard
                    key={item.id}
                    item={item}
                    stock={stockForTicker(
                      item.ticker,
                    )}
                    quote={
                      quotes[
                        item.ticker.toUpperCase()
                      ]
                    }
                    index={index}
                    onRemove={removeTicker}
                    onStarToggle={
                      togglePortfolio
                    }
                    onRequestPortfolioRemoval={
                      requestPortfolioRemoval
                    }
                  />
                ),
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
