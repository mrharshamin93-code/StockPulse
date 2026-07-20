import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  Plus,
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
const SPARKLINE_CACHE_DURATION = 5 * 60 * 1000;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum);
}

function abbreviateExchange(exchange) {
  if (!exchange) {
    return "";
  }

  const normalized = exchange.toUpperCase();

  if (normalized.includes("NASDAQ")) {
    return "NASDAQ";
  }

  if (
    normalized.includes("NYSE AMERICAN") ||
    normalized.includes("AMEX")
  ) {
    return "AMEX";
  }

  if (
    normalized.includes("NEW YORK STOCK EXCHANGE") ||
    normalized.includes("NYSE")
  ) {
    return "NYSE";
  }

  if (
    normalized.includes("OTC") ||
    normalized.includes("PINK")
  ) {
    return "OTC";
  }

  if (
    normalized.includes("CBOE") ||
    normalized.includes("BATS")
  ) {
    return "CBOE";
  }

  if (
    normalized.includes("TSX VENTURE") ||
    normalized.includes("TSXV")
  ) {
    return "TSXV";
  }

  if (
    normalized.includes("TSX") ||
    normalized.includes("TORONTO")
  ) {
    return "TSX";
  }

  if (
    normalized.includes("CSE") ||
    normalized.includes("CANADIAN SECURITIES")
  ) {
    return "CSE";
  }

  if (normalized.includes("NEO")) {
    return "NEO";
  }

  if (
    normalized.includes("LONDON") ||
    normalized.includes("LSE")
  ) {
    return "LSE";
  }

  if (
    normalized.includes("EURONEXT PARIS") ||
    normalized.includes("XPAR")
  ) {
    return "EPA";
  }

  if (
    normalized.includes("EURONEXT AMSTERDAM") ||
    normalized.includes("XAMS")
  ) {
    return "AMS";
  }

  if (
    normalized.includes("EURONEXT BRUSSELS") ||
    normalized.includes("XBRU")
  ) {
    return "EBR";
  }

  if (normalized.includes("EURONEXT")) {
    return "ENX";
  }

  if (
    normalized.includes("XETRA") ||
    normalized.includes("FRANKFURT") ||
    normalized.includes("FSE") ||
    normalized.includes("FWB")
  ) {
    return "FRA";
  }

  if (
    normalized.includes("SIX") ||
    normalized.includes("SWISS") ||
    normalized.includes("ZURICH")
  ) {
    return "SIX";
  }

  if (
    normalized.includes("MILAN") ||
    normalized.includes("BORSA ITALIANA")
  ) {
    return "BIT";
  }

  if (
    normalized.includes("MADRID") ||
    normalized.includes("BME")
  ) {
    return "BME";
  }

  if (
    normalized.includes("OSLO") ||
    normalized.includes("OSE")
  ) {
    return "OSE";
  }

  if (
    normalized.includes("STOCKHOLM") ||
    normalized.includes("OMX")
  ) {
    return "STO";
  }

  if (
    normalized.includes("COPENHAGEN") ||
    normalized.includes("CPH")
  ) {
    return "CPH";
  }

  if (
    normalized.includes("HELSINKI") ||
    normalized.includes("HEL")
  ) {
    return "HEL";
  }

  if (
    normalized.includes("ASX") ||
    normalized.includes("AUSTRALIAN")
  ) {
    return "ASX";
  }

  if (
    normalized.includes("NZX") ||
    normalized.includes("NEW ZEALAND")
  ) {
    return "NZX";
  }

  if (
    normalized.includes("TOKYO") ||
    normalized.includes("TSE") ||
    normalized.includes("JPX")
  ) {
    return "TSE";
  }

  if (
    normalized.includes("SHANGHAI") ||
    normalized.includes("SHSE")
  ) {
    return "SSE";
  }

  if (
    normalized.includes("SHENZHEN") ||
    normalized.includes("SZSE")
  ) {
    return "SZSE";
  }

  if (
    normalized.includes("HONG KONG") ||
    normalized.includes("HKEX") ||
    normalized.includes("HKG")
  ) {
    return "HKEX";
  }

  if (normalized.includes("NATIONAL STOCK EXCHANGE")) {
    return "NSE";
  }

  if (normalized.includes("BOMBAY")) {
    return "BSE";
  }

  if (
    normalized.includes("KRX") ||
    normalized.includes("KOREA EXCHANGE")
  ) {
    return "KRX";
  }

  if (
    normalized.includes("SGX") ||
    normalized.includes("SINGAPORE")
  ) {
    return "SGX";
  }

  if (
    normalized.includes("TADAWUL") ||
    normalized.includes("SAUDI")
  ) {
    return "TADAWUL";
  }

  if (
    normalized.includes("JSE") ||
    normalized.includes("JOHANNESBURG")
  ) {
    return "JSE";
  }

  if (
    normalized.includes("B3") ||
    normalized.includes("BOVESPA") ||
    normalized.includes("BRAZIL")
  ) {
    return "B3";
  }

  return exchange;
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

async function callFinnhub(params, signal) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(
    `/api/finnhub?${searchParams.toString()}`,
    {
      signal,
    }
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        "Failed to fetch market data"
    );
  }

  return payload;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const timeout = window.setTimeout(
      onDone,
      2500
    );

    return () => {
      window.clearTimeout(timeout);
    };
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
      className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
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
  onAdded,
  userId,
}) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

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

    const parsedQuantity = Number(quantity);
    const parsedPurchasePrice =
      Number(purchasePrice);

    if (
      !userId ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      !Number.isFinite(parsedPurchasePrice) ||
      parsedPurchasePrice <= 0
    ) {
      setFormError(
        "Enter a valid quantity and purchase price."
      );
      return;
    }

    setLoading(true);
    setFormError("");

    try {
      let currentPrice = parsedPurchasePrice;

      try {
        const quote = await callFinnhub({
          action: "quote",
          ticker,
        });

        if (
          Number.isFinite(Number(quote?.c)) &&
          Number(quote.c) > 0
        ) {
          currentPrice = Number(quote.c);
        }
      } catch (error) {
        console.warn(
          "Could not refresh quote before adding:",
          error
        );
      }

      const { error } = await supabase
        .from("stocks")
        .insert({
          user_id: userId,
          ticker: ticker.toUpperCase(),
          company_name: companyName,
          quantity: parsedQuantity,
          purchase_price: parsedPurchasePrice,
          current_price: currentPrice,
          sector: "",
        });

      if (error) {
        throw error;
      }

      setQuantity("");
      setPurchasePrice("");
      onAdded();
    } catch (error) {
      console.error(
        "Add to portfolio failed:",
        error
      );

      setFormError(
        error?.message ||
          "Unable to add this stock."
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {ticker} to Portfolio
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          {companyName}
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="portfolio-quantity">
              Shares
            </Label>

            <Input
              id="portfolio-quantity"
              type="number"
              min="0.000001"
              step="any"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolio-price">
              Average Purchase Price
            </Label>

            <Input
              id="portfolio-price"
              type="number"
              min="0.01"
              step="0.01"
              value={purchasePrice}
              onChange={(event) =>
                setPurchasePrice(
                  event.target.value
                )
              }
              required
            />
          </div>

          {formError && (
            <p className="text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
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

async function fetchSparklineData(
  ticker,
  signal
) {
  const cacheKey = ticker.toUpperCase();
  const cached = sparklineCache.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.timestamp <
      SPARKLINE_CACHE_DURATION
  ) {
    return cached.data;
  }

  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo =
    now - 30 * 24 * 60 * 60;

  const result = await callFinnhub(
    {
      action: "candles_range",
      ticker,
      resolution: "D",
      from: thirtyDaysAgo,
      to: now,
    },
    signal
  );

  const closePrices = Array.isArray(
    result?.candles
  )
    ? result.candles
        .map((candle) => Number(candle?.v))
        .filter(Number.isFinite)
    : [];

  if (closePrices.length < 2) {
    return null;
  }

  sparklineCache.set(cacheKey, {
    data: closePrices,
    timestamp: Date.now(),
  });

  return closePrices;
}

function MiniSparkline({
  data,
  isPositive,
}) {
  const width = 42;
  const height = 32;
  const padding = 2;

  const color = isPositive
    ? "#10b981"
    : "#ef4444";

  if (!data || data.length < 2) {
    const fallbackPoints = isPositive
      ? "2,25 8,20 14,22 20,16 26,18 32,10 40,7"
      : "2,7 8,11 14,9 20,16 26,14 32,21 40,25";

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <polyline
          points={fallbackPoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const minimum = Math.min(...data);
  const maximum = Math.max(...data);
  const range = maximum - minimum || 1;

  const points = data
    .map((price, index) => {
      const x =
        padding +
        (index / (data.length - 1)) *
          (width - padding * 2);

      const y =
        padding +
        ((maximum - price) / range) *
          (height - padding * 2);

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparklineWrapper({
  ticker,
  isPositive,
}) {
  const [sparklineData, setSparklineData] =
    useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchSparklineData(
      ticker,
      controller.signal
    )
      .then((data) => {
        setSparklineData(data);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn(
            `Sparkline fetch failed for ${ticker}:`,
            error
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [ticker]);

  return (
    <MiniSparkline
      data={sparklineData}
      isPositive={isPositive}
    />
  );
}

function AnimatedPrice({ value }) {
  const [flash, setFlash] = useState(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (
      previousValueRef.current !== value &&
      value !== "—"
    ) {
      const previous = Number(
        previousValueRef.current
      );
      const next = Number(value);

      if (
        Number.isFinite(previous) &&
        Number.isFinite(next)
      ) {
        setFlash(
          next > previous ? "up" : "down"
        );

        const timeout = window.setTimeout(
          () => {
            setFlash(null);
          },
          700
        );

        previousValueRef.current = value;

        return () => {
          window.clearTimeout(timeout);
        };
      }
    }

    previousValueRef.current = value;

    return undefined;
  }, [value]);

  return (
    <span
      className="text-sm font-semibold transition-colors duration-500"
      style={{
        color:
          flash === "up"
            ? "#10b981"
            : flash === "down"
              ? "#ef4444"
              : undefined,
      }}
    >
      {value !== "—" ? `$${value}` : "—"}
    </span>
  );
}

function SwipeActionButton({
  progress,
  disabled,
  onClick,
  type,
  icon: Icon,
  label,
}) {
  const isDelete = type === "delete";

  const scale =
    0.35 + progress * 0.65;

  const translateX =
    (1 - progress) * 16;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full text-white shadow-md ${
        isDelete
          ? "bg-red-500"
          : "bg-gray-900"
      }`}
      style={{
        opacity: progress,
        transform: `translateX(${translateX}px) scale(${scale})`,
        transformOrigin: "right center",
        pointerEvents:
          disabled || progress < 0.75
            ? "none"
            : "auto",
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />

      <span className="text-[8px] font-semibold leading-none">
        {label}
      </span>
    </button>
  );
}

function WatchlistCard({
  item,
  stock,
  quote,
  onRemove,
  onStarToggle,
  index,
}) {
  const hasStock = Boolean(stock);

  const companyName = getCompanyName(
    item.ticker,
    stock,
    item
  );

  const [dragX, setDragX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const [deleting, setDeleting] =
    useState(false);

  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const startDragXRef = useRef(0);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const ACTION_SIZE = 44;
  const ACTION_GAP = 8;
  const ACTION_PADDING = 8;

  const REVEAL_WIDTH =
    ACTION_SIZE * 2 +
    ACTION_GAP +
    ACTION_PADDING * 2;

  const livePrice =
    typeof quote?.c === "number"
      ? quote.c
      : null;

  const storedPrice =
    typeof stock?.current_price === "number"
      ? stock.current_price
      : null;

  const displayPrice =
    livePrice !== null
      ? livePrice.toFixed(2)
      : storedPrice !== null
        ? storedPrice.toFixed(2)
        : "—";

  const dailyGainPct =
    typeof quote?.dp === "number"
      ? quote.dp
      : null;

  const dailyIsPositive =
    (dailyGainPct ?? 0) >= 0;

  const revealProgress = clamp(
    Math.abs(dragX) / REVEAL_WIDTH
  );

  /*
   * The rightmost Delete button grows first because
   * it is uncovered first as the card moves left.
   */
  const deleteProgress = clamp(
    revealProgress / 0.56
  );

  /*
   * Share begins growing after Delete is already
   * mostly visible, producing the one-by-one effect.
   */
  const shareProgress = clamp(
    (revealProgress - 0.34) / 0.66
  );

  const linkTo =
    hasStock &&
    stock?.id &&
    stock.id !== "undefined"
      ? `/stock/${stock.id}`
      : `/stock/ticker-${item.ticker}`;

  function handleTouchStart(event) {
    if (deleting) {
      return;
    }

    touchStartXRef.current =
      event.touches[0].clientX;

    touchStartYRef.current =
      event.touches[0].clientY;

    startDragXRef.current = dragX;
    draggingRef.current = false;
    suppressClickRef.current = false;
  }

  function handleTouchMove(event) {
    if (
      deleting ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null
    ) {
      return;
    }

    const currentX =
      event.touches[0].clientX;

    const currentY =
      event.touches[0].clientY;

    const deltaX =
      currentX - touchStartXRef.current;

    const deltaY =
      currentY - touchStartYRef.current;

    if (
      !draggingRef.current &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      return;
    }

    if (Math.abs(deltaX) > 5) {
      draggingRef.current = true;
      suppressClickRef.current = true;
    }

    if (!draggingRef.current) {
      return;
    }

    event.stopPropagation();

    const nextX =
      startDragXRef.current + deltaX;

    setDragX(
      clamp(
        nextX,
        -REVEAL_WIDTH - 14,
        0
      )
    );
  }

  function handleTouchEnd() {
    if (deleting) {
      return;
    }

    const openThreshold =
      swiped
        ? REVEAL_WIDTH * 0.28
        : REVEAL_WIDTH * 0.42;

    if (
      Math.abs(dragX) >= openThreshold
    ) {
      setDragX(-REVEAL_WIDTH);
      setSwiped(true);
    } else {
      setDragX(0);
      setSwiped(false);
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    draggingRef.current = false;

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 100);
  }

  function handleTouchCancel() {
    handleTouchEnd();
  }

  function closeSwipe() {
    setDragX(0);
    setSwiped(false);
  }

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();

    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${linkTo}`
        : "";

    const shareText =
      `${companyName} (${item.ticker})` +
      (displayPrice !== "—"
        ? ` — $${displayPrice}`
        : "");

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.ticker,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard?.writeText(
          `${shareText} ${shareUrl}`.trim()
        );
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Share failed:", error);
      }
    } finally {
      closeSwipe();
    }
  }

  async function handleDelete(event) {
    event.preventDefault();
    event.stopPropagation();

    if (deleting) {
      return;
    }

    setDeleting(true);
    setDragX(-420);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 240);
    });

    await onRemove(item.id);
  }

  function handleLinkClick(event) {
    if (
      swiped ||
      suppressClickRef.current ||
      deleting
    ) {
      event.preventDefault();
      closeSwipe();
    }
  }

  const cardTransition =
    draggingRef.current
      ? "none"
      : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl"
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
      layout
    >
      <div
        className="absolute inset-y-0 right-0 flex items-center"
        style={{
          gap: `${ACTION_GAP}px`,
          paddingRight: `${ACTION_PADDING}px`,
        }}
      >
        <SwipeActionButton
          type="share"
          label="Share"
          icon={Share2}
          progress={shareProgress}
          disabled={deleting}
          onClick={handleShare}
        />

        <SwipeActionButton
          type="delete"
          label="Delete"
          icon={Trash2}
          progress={deleteProgress}
          disabled={deleting}
          onClick={handleDelete}
        />
      </div>

      <Link
        to={linkTo}
        state={{
          from: "/watchlist",
        }}
        onClick={handleLinkClick}
        className="block"
      >
        <div
          className="flex h-[76px] items-center gap-3 rounded-2xl border border-gray-100 px-3.5 py-3 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-gray-200 hover:shadow-md"
          style={{
            backgroundColor: "hsl(var(--card))",
            transform: `translateX(${dragX}px)`,
            transition: cardTransition,
            touchAction: "pan-y",
            willChange: "transform",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              onStarToggle(item, stock);
            }}
            className="flex min-h-[44px] min-w-[36px] shrink-0 items-center justify-center p-1"
            aria-label={
              hasStock
                ? `Remove ${item.ticker} from portfolio`
                : `Add ${item.ticker} to portfolio`
            }
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                hasStock
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 hover:text-amber-300"
              }`}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-heading text-base font-bold leading-tight">
                {item.ticker}
              </p>

              {item.exchange && (
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                  {abbreviateExchange(
                    item.exchange
                  )}
                </span>
              )}
            </div>

            <p className="truncate text-xs text-gray-500">
              {companyName}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block">
              <SparklineWrapper
                ticker={item.ticker}
                isPositive={
                  dailyIsPositive
                }
              />
            </div>

            <div className="min-w-[68px] text-right">
              <p>
                <AnimatedPrice
                  value={displayPrice}
                />
              </p>

              {dailyGainPct !== null ? (
                <div
                  className={`mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold text-white ${
                    dailyIsPositive
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                >
                  {dailyIsPositive ? "+" : ""}
                  {dailyGainPct.toFixed(2)}%
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  —
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Watchlist() {
  const { user } = useAuth();

  const {
    quotes: globalQuotes,
    refreshQuotes,
  } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  const [suggestions, setSuggestions] =
    useState([]);

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);

  const [toast, setToast] = useState(null);

  const [dialogItem, setDialogItem] =
    useState(null);

  const inputContainerRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const quotes =
    globalQuotes &&
    typeof globalQuotes === "object"
      ? globalQuotes
      : {};

  const normalizeSearchResults =
    useCallback((data) => {
      const rawResults = Array.isArray(
        data?.result
      )
        ? data.result
        : Array.isArray(data?.results)
          ? data.results
          : [];

      return rawResults
        .map((item) => ({
          ticker: String(
            item?.ticker ||
              item?.symbol ||
              item?.displaySymbol ||
              ""
          )
            .trim()
            .toUpperCase(),

          name: String(
            item?.name ||
              item?.description ||
              ""
          ).trim(),

          exchange: String(
            item?.exchange ||
              item?.primaryExchange ||
              item?.mic ||
              ""
          ).trim(),
        }))
        .filter(
          (item) =>
            item.ticker &&
            item.name
        );
    }, []);

  const syncQuotesForItems = useCallback(
    (watchItems) => {
      const tickersToRefresh = [
        ...new Set(
          (watchItems || [])
            .map((item) =>
              String(item?.ticker || "")
                .trim()
                .toUpperCase()
            )
            .filter(Boolean)
        ),
      ];

      if (tickersToRefresh.length) {
        refreshQuotes(tickersToRefresh);
      }
    },
    [refreshQuotes]
  );

  const load = useCallback(async () => {
    if (!user?.id) {
      return [];
    }

    const [
      watchlistResponse,
      stocksResponse,
    ] = await Promise.all([
      supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("stocks")
        .select("*")
        .eq("user_id", user.id),
    ]);

    if (watchlistResponse.error) {
      throw watchlistResponse.error;
    }

    if (stocksResponse.error) {
      throw stocksResponse.error;
    }

    const watchlistData =
      watchlistResponse.data || [];

    const stockData = (
      stocksResponse.data || []
    ).filter(
      (stock) =>
        stock?.id &&
        stock.id !== "undefined"
    );

    setItems(watchlistData);
    setStocks(stockData);

    return watchlistData;
  }, [user?.id]);

  useEffect(() => {
    function handleDocumentMouseDown(event) {
      const clickedInput =
        inputContainerRef.current?.contains(
          event.target
        );

      const clickedSuggestions =
        suggestionsRef.current?.contains(
          event.target
        );

      if (
        !clickedInput &&
        !clickedSuggestions
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleDocumentMouseDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleDocumentMouseDown
      );
    };
  }, []);

  useEffect(() => {
    const query = ticker.trim();

    if (!query) {
      setSuggestions([]);
      setSearchLoading(false);
      return undefined;
    }

    window.clearTimeout(
      searchTimeoutRef.current
    );

    const controller =
      new AbortController();

    searchTimeoutRef.current =
      window.setTimeout(async () => {
        setSearchLoading(true);

        try {
          const result = await callFinnhub(
            {
              action: "search",
              query,
            },
            controller.signal
          );

          const normalizedResults =
            normalizeSearchResults(result);

          const uppercaseQuery =
            query.toUpperCase();

          const filtered =
            normalizedResults.filter(
              (suggestion) =>
                suggestion.ticker.includes(
                  uppercaseQuery
                ) ||
                suggestion.name
                  .toUpperCase()
                  .includes(uppercaseQuery)
            );

          setSuggestions(
            filtered.slice(0, 8)
          );
        } catch (error) {
          if (
            error?.name !== "AbortError"
          ) {
            console.warn(
              "Ticker search failed:",
              error
            );

            setSuggestions([]);
          }
        } finally {
          if (
            !controller.signal.aborted
          ) {
            setSearchLoading(false);
          }
        }
      }, 250);

    return () => {
      window.clearTimeout(
        searchTimeoutRef.current
      );

      controller.abort();
    };
  }, [ticker, normalizeSearchResults]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    setLoading(true);

    load()
      .then((watchlistData) => {
        if (!mounted) {
          return;
        }

        syncQuotesForItems(
          watchlistData
        );
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        console.error(
          "Watchlist load failed:",
          error
        );

        setToast(
          "Unable to load watchlist."
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    user?.id,
    load,
    syncQuotesForItems,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      items.length === 0
    ) {
      return undefined;
    }

    const interval =
      window.setInterval(() => {
        syncQuotesForItems(items);
      }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    items,
    user?.id,
    syncQuotesForItems,
  ]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const stocksChannel = supabase
      .channel(
        `watchlist-stocks-${user.id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stocks",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const {
            data = [],
            error,
          } = await supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id);

          if (!error) {
            setStocks(
              data.filter(
                (stock) =>
                  stock?.id &&
                  stock.id !== "undefined"
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        stocksChannel
      );
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const watchlistChannel = supabase
      .channel(
        `watchlist-items-${user.id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlist_items",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const {
            data = [],
            error,
          } = await supabase
            .from("watchlist_items")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            });

          if (!error) {
            setItems(data);
            syncQuotesForItems(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        watchlistChannel
      );
    };
  }, [
    user?.id,
    syncQuotesForItems,
  ]);

  async function addTicker(
    symbol,
    exchange = ""
  ) {
    const normalizedSymbol = String(
      symbol || ""
    )
      .trim()
      .toUpperCase();

    if (
      !normalizedSymbol ||
      !user?.id ||
      adding
    ) {
      return;
    }

    const alreadyAdded = items.some(
      (item) =>
        item.ticker.toUpperCase() ===
        normalizedSymbol
    );

    if (alreadyAdded) {
      setToast(
        `"${normalizedSymbol}" is already in your watchlist.`
      );
      return;
    }

    setAdding(true);
    setShowSuggestions(false);

    try {
      let companyName = "";
      let resolvedExchange = exchange;

      try {
        const profile = await callFinnhub({
          action: "profile",
          ticker: normalizedSymbol,
        });

        companyName =
          profile?.name || "";

        if (
          !resolvedExchange &&
          profile?.exchange
        ) {
          resolvedExchange =
            profile.exchange;
        }
      } catch (error) {
        console.warn(
          "Company profile lookup failed:",
          error
        );
      }

      const { error } = await supabase
        .from("watchlist_items")
        .insert({
          user_id: user.id,
          ticker: normalizedSymbol,
          exchange:
            resolvedExchange || "",
          company_name:
            companyName ||
            normalizedSymbol,
        });

      if (error) {
        throw error;
      }

      setTicker("");
      setSuggestions([]);

      const updatedWatchlist =
        await load();

      syncQuotesForItems(
        updatedWatchlist
      );

      setToast(
        `${normalizedSymbol} added to watchlist`
      );
    } catch (error) {
      console.error(
        "Add ticker failed:",
        error
      );

      setToast(
        error?.message ||
          "Failed to add ticker."
      );
    } finally {
      setAdding(false);
    }
  }

  function handleAdd(event) {
    event.preventDefault();
    addTicker(ticker);
  }

  async function handleRemove(id) {
    const previousItems = items;

    const nextItems =
      previousItems.filter(
        (item) => item.id !== id
      );

    setItems(nextItems);

    try {
      const { error } = await supabase
        .from("watchlist_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      syncQuotesForItems(nextItems);
      setToast(
        "Removed from watchlist"
      );
    } catch (error) {
      console.error(
        "Remove ticker failed:",
        error
      );

      setItems(previousItems);
      setToast(
        "Failed to remove ticker."
      );
    }
  }

  async function handleStarToggle(
    item,
    stock
  ) {
    if (stock) {
      const previousStocks = stocks;

      setStocks((currentStocks) =>
        currentStocks.filter(
          (currentStock) =>
            currentStock.id !== stock.id
        )
      );

      try {
        const { error } = await supabase
          .from("stocks")
          .delete()
          .eq("id", stock.id)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        setToast(
          `${item.ticker} removed from portfolio`
        );
      } catch (error) {
        console.error(
          "Portfolio removal failed:",
          error
        );

        setStocks(previousStocks);
        setToast(
          "Failed to update portfolio."
        );
      }

      return;
    }

    setDialogItem({
      ticker: item.ticker,
      companyName: getCompanyName(
        item.ticker,
        null,
        item
      ),
    });
  }

  async function handlePortfolioAdded() {
    const addedTicker =
      dialogItem?.ticker;

    setDialogItem(null);

    await load();

    if (addedTicker) {
      setToast(
        `${addedTicker} added to portfolio`
      );
    }
  }

  const findStock = useCallback(
    (tickerValue) =>
      stocks.find(
        (stock) =>
          stock.ticker.toUpperCase() ===
          tickerValue.toUpperCase()
      ),
    [stocks]
  );

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const firstGain =
        quotes[
          a.ticker.toUpperCase()
        ]?.dp ?? 0;

      const secondGain =
        quotes[
          b.ticker.toUpperCase()
        ]?.dp ?? 0;

      return secondGain - firstGain;
    });
  }, [items, quotes]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
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

      {dialogItem && (
        <AddToPortfolioDialog
          open={Boolean(dialogItem)}
          onOpenChange={(open) => {
            if (!open) {
              setDialogItem(null);
            }
          }}
          ticker={dialogItem.ticker}
          companyName={
            dialogItem.companyName
          }
          onAdded={
            handlePortfolioAdded
          }
          userId={user?.id}
        />
      )}

      <main className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Watchlist
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Stocks you&apos;re watching
          </p>
        </div>

        <form
          onSubmit={handleAdd}
          className="relative mb-6"
        >
          <div className="flex gap-2">
            <div
              ref={inputContainerRef}
              className="relative flex-1"
            >
              <Input
                value={ticker}
                onChange={(event) => {
                  setTicker(
                    event.target.value
                  );

                  setShowSuggestions(true);
                }}
                onFocus={() =>
                  setShowSuggestions(true)
                }
                placeholder="Search ticker or company"
                className="w-full uppercase placeholder:normal-case"
                autoComplete="off"
              />

              {showSuggestions &&
                ticker.trim() &&
                (searchLoading ||
                  suggestions.length >
                    0) && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
                  >
                    {searchLoading ? (
                      <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching…
                      </div>
                    ) : (
                      suggestions.map(
                        (suggestion) => {
                          const alreadyAdded =
                            items.some(
                              (item) =>
                                item.ticker.toUpperCase() ===
                                suggestion.ticker.toUpperCase()
                            );

                          const inPortfolio =
                            stocks.some(
                              (stock) =>
                                stock.ticker.toUpperCase() ===
                                suggestion.ticker.toUpperCase()
                            );

                          return (
                            <button
                              key={`${suggestion.ticker}-${suggestion.exchange}`}
                              type="button"
                              disabled={
                                alreadyAdded
                              }
                              onMouseDown={(
                                event
                              ) => {
                                event.preventDefault();
                              }}
                              onClick={() => {
                                if (
                                  alreadyAdded
                                ) {
                                  return;
                                }

                                addTicker(
                                  suggestion.ticker,
                                  suggestion.exchange
                                );
                              }}
                              className={`flex w-full items-center justify-between gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 ${
                                alreadyAdded
                                  ? "cursor-not-allowed opacity-40"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {
                                      suggestion.ticker
                                    }
                                  </span>

                                  {suggestion.exchange && (
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-gray-400">
                                      {abbreviateExchange(
                                        suggestion.exchange
                                      )}
                                    </span>
                                  )}
                                </div>

                                <p className="truncate text-xs text-gray-500">
                                  {
                                    suggestion.name
                                  }
                                </p>
                              </div>

                              <div className="shrink-0">
                                {alreadyAdded && (
                                  <span className="text-xs font-medium text-gray-400">
                                    Added
                                  </span>
                                )}

                                {!alreadyAdded &&
                                  inPortfolio && (
                                    <span className="text-xs font-medium text-amber-500">
                                      In portfolio
                                    </span>
                                  )}
                              </div>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                )}
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
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
            <Star className="mx-auto h-8 w-8 text-gray-300" />

            <h2 className="mt-3 text-base font-semibold text-gray-900">
              Nothing here yet
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add a ticker above to start
              watching it.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="space-y-3"
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
                    stock={findStock(
                      item.ticker
                    )}
                    quote={
                      quotes[
                        item.ticker.toUpperCase()
                      ]
                    }
                    onRemove={
                      handleRemove
                    }
                    onStarToggle={
                      handleStarToggle
                    }
                    index={index}
                  />
                )
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
