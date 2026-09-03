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
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

import {
  Bell,
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
import { recordStockTransaction } from "@/lib/stockTransactions";

import {
  financialDatasetsRequest,
} from "@/lib/financialDatasets";

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

const SPARKLINE_TTL =
  5 * 60 * 1000;

function getStoredWatchlistId(userId) {
  if (!userId) {
    return null;
  }

  try {
    return window.localStorage.getItem(
      `stockpulse:active-watchlist:${userId}`
    );
  } catch {
    return null;
  }
}

function storeActiveWatchlistId(
  userId,
  watchlistId
) {
  if (
    !userId ||
    !watchlistId
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      `stockpulse:active-watchlist:${userId}`,
      watchlistId
    );
  } catch {
    // Supabase remains source of truth.
  }
}

function clamp(
  value,
  minimum = 0,
  maximum = 1
) {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  );
}

function abbreviateExchange(exchange) {
  if (!exchange) {
    return "";
  }

  const value =
    String(
      exchange
    ).toUpperCase();

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
    rules.find(
      ([terms]) =>
        terms.some(
          (term) =>
            value.includes(
              term
            )
        )
    )?.[1] ||
    exchange
  );
}

function getCompanyName(
  ticker,
  stock,
  item
) {
  if (
    stock?.company_name &&
    stock.company_name !==
      ticker
  ) {
    return stock.company_name;
  }

  if (
    item?.company_name &&
    item.company_name !==
      ticker
  ) {
    return item.company_name;
  }

  return (
    stock?.company_name ||
    item?.company_name ||
    ticker
  );
}

async function marketDataRequest(
  body,
  signal
) {
  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
  }

  const payload =
    await financialDatasetsRequest(
      body
    );

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
  }

  return payload;
}

function normalizeSearchResults(
  payload
) {
  const raw =
    Array.isArray(
      payload?.results
    )
      ? payload.results
      : Array.isArray(
            payload?.result
          )
        ? payload.result
        : [];

  return raw
    .map((item) => ({
      ticker:
        String(
          item?.ticker ||
            item?.symbol ||
            item?.displaySymbol ||
            ""
        )
          .trim()
          .toUpperCase(),

      name:
        String(
          item?.name ||
            item?.description ||
            item?.displaySymbol ||
            ""
        ).trim(),

      exchange:
        String(
          item?.exchange ||
            item?.primaryExchange ||
            item?.mic ||
            ""
        ).trim(),
    }))
    .filter(
      (item) =>
        item.ticker
    );
}

/* -------------------------------------------------------------------------- */
/* TOAST                                                                       */
/* -------------------------------------------------------------------------- */

function Toast({
  message,
  onDone,
}) {
  useEffect(() => {
    const timer =
      window.setTimeout(
        onDone,
        2500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [onDone]);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -12,
        scale: 0.96,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.96,
      }}
      className="
        fixed
        left-1/2
        top-[calc(env(safe-area-inset-top)+12px)]
        z-[100]
        -translate-x-1/2
        whitespace-nowrap
        rounded-full
        bg-foreground
        px-4
        py-2
        text-[13px]
        font-medium
        text-background
        shadow-xl
      "
    >
      {message}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADD TO PORTFOLIO                                                            */
/* -------------------------------------------------------------------------- */

function AddToPortfolioDialog({
  open,
  onOpenChange,
  ticker,
  companyName,
  userId,
  onAdded,
}) {
  const [
    quantity,
    setQuantity,
  ] = useState("");

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      setQuantity("");
      setPurchasePrice("");
      setFormError("");
      setLoading(false);
    }
  }, [open]);

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    const shares =
      Number(quantity);

    const cost =
      Number(
        purchasePrice
      );

    if (
      !userId ||
      !Number.isFinite(
        shares
      ) ||
      shares <= 0 ||
      !Number.isFinite(
        cost
      ) ||
      cost <= 0
    ) {
      setFormError(
        "Enter a valid quantity and purchase price."
      );

      return;
    }

    setLoading(true);
    setFormError("");

    try {
      let currentPrice =
        cost;

      try {
        const quote =
          await marketDataRequest(
            {
              action:
                "quote",

              ticker,
            }
          );

        if (
          Number(
            quote?.c
          ) > 0
        ) {
          currentPrice =
            Number(
              quote.c
            );
        }
      } catch (error) {
        console.warn(
          "Quote refresh failed:",
          error
        );
      }

      const { error } =
        await supabase
          .from(
            "stocks"
          )
          .insert({
            user_id:
              userId,

            ticker:
              ticker.toUpperCase(),

            company_name:
              companyName,

            quantity:
              shares,

            purchase_price:
              cost,

            current_price:
              currentPrice,

            sector:
              "",
          });

      if (error) {
        throw error;
      }

      try {
        await recordStockTransaction({
          userId,
          ticker,
          companyName,
          type: "buy",
          quantity: shares,
          price: cost,
        });
      } catch (transactionError) {
        console.warn(
          "Initial buy transaction history insert failed:",
          transactionError,
        );
      }

      setQuantity("");
      setPurchasePrice("");

      await onAdded();
    } catch (error) {
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
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent
        className="
          w-[calc(100%-24px)]
          max-w-[380px]
          rounded-[22px]
          border-border
          bg-card
          p-5
          text-foreground
        "
      >
        <DialogHeader>
          <DialogTitle className="text-[20px] font-bold tracking-[-0.35px]">
            Add {ticker} to Portfolio
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 truncate text-[13px] text-muted-foreground">
          {companyName}
        </p>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5 pt-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="watchlist-shares">
                Shares
              </Label>

              <Input
                id="watchlist-shares"
                type="number"
                step="any"
                min="0.000001"
                value={
                  quantity
                }
                onChange={(
                  event
                ) =>
                  setQuantity(
                    event.target
                      .value
                  )
                }
                required
                className="h-[46px] rounded-[13px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="watchlist-price">
                Avg. Price
              </Label>

              <Input
                id="watchlist-price"
                type="number"
                step="any"
                min="0.01"
                value={
                  purchasePrice
                }
                onChange={(
                  event
                ) =>
                  setPurchasePrice(
                    event.target
                      .value
                  )
                }
                required
                className="h-[46px] rounded-[13px]"
              />
            </div>
          </div>

          {formError && (
            <p className="text-[13px] font-medium text-red-600">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="h-[48px] w-full rounded-[14px]"
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

/* -------------------------------------------------------------------------- */
/* ADD TICKER                                                                  */
/* -------------------------------------------------------------------------- */

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
  function handleOpenChange(
    nextOpen
  ) {
    onOpenChange(
      nextOpen
    );

    if (!nextOpen) {
      setTicker("");
    }
  }

  function submitTicker(
    event
  ) {
    event.preventDefault();

    if (
      ticker.trim()
    ) {
      void onAdd(
        ticker
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        handleOpenChange
      }
    >
      <DialogContent
        className="
          max-h-[85vh]
          w-[calc(100%-24px)]
          max-w-[410px]
          overflow-hidden
          rounded-[22px]
          border-border
          bg-card
          p-0
          text-foreground
        "
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="text-[20px] font-bold tracking-[-0.35px]">
            Add to Watchlist
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-col px-4 pb-4">
          <form
            onSubmit={
              submitTicker
            }
            className="flex gap-2 pt-4"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="
                  pointer-events-none
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-muted-foreground
                "
              />

              <Input
                value={ticker}
                placeholder="Search ticker or company"
                className="
                  h-[46px]
                  rounded-[14px]
                  bg-background
                  pl-9
                  uppercase
                  placeholder:normal-case
                "
                autoComplete="off"
                autoFocus
                onChange={(
                  event
                ) =>
                  setTicker(
                    event.target
                      .value
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
              className="
                h-[46px]
                w-[46px]
                shrink-0
                rounded-[14px]
                p-0
              "
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>
          </form>

          <div
            className="
              mt-3
              min-h-0
              overflow-y-auto
              rounded-[16px]
              border
              border-border
              bg-background/40
            "
          >
            {!ticker.trim() ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Search for a stock by ticker or company name.
              </div>
            ) : searching ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />

                Searching…
              </div>
            ) : suggestions.length ===
              0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No suggestions found. You can still add the ticker above.
              </div>
            ) : (
              suggestions.map(
                (
                  suggestion
                ) => {
                  const alreadyAdded =
                    items.some(
                      (
                        item
                      ) =>
                        item.ticker.toUpperCase() ===
                        suggestion.ticker
                    );

                  const inPortfolio =
                    stocks.some(
                      (
                        stock
                      ) =>
                        stock.ticker.toUpperCase() ===
                        suggestion.ticker
                    );

                  return (
                    <button
                      key={`${suggestion.ticker}-${suggestion.exchange}`}
                      type="button"
                      disabled={
                        alreadyAdded ||
                        adding
                      }
                      onClick={() =>
                        void onAdd(
                          suggestion.ticker,
                          suggestion.exchange
                        )
                      }
                      className={[
                        `
                          flex
                          min-h-[66px]
                          w-full
                          items-center
                          justify-between
                          gap-3
                          border-b
                          border-border
                          px-4
                          py-2.5
                          text-left
                          transition-colors
                          last:border-0
                        `,
                        alreadyAdded
                          ? "cursor-not-allowed opacity-40"
                          : "active:bg-muted/60",
                      ].join(
                        " "
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-foreground">
                            {
                              suggestion.ticker
                            }
                          </p>

                          {suggestion.exchange && (
                            <span className="text-[9px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                              {abbreviateExchange(
                                suggestion.exchange
                              )}
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {suggestion.name ||
                            suggestion.ticker}
                        </p>
                      </div>

                      {alreadyAdded ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          Added
                        </span>
                      ) : inPortfolio ? (
                        <span className="shrink-0 text-[11px] font-medium text-amber-500">
                          In portfolio
                        </span>
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Watchlist sparklines now use StockPulse's persisted daily-price cache
 * directly instead of calling Financial Datasets/candles_range from the page.
 *
 * stock_daily_prices only contains completed daily bars, so the final point is
 * automatically the last completed trading day. Weekends and market holidays
 * are handled naturally because they have no trading_date row.
 *
 * This means refreshing the Watchlist does not consume Financial Datasets
 * /prices calls for these 30-day sparklines.
 */
async function fetchSparkline(
  ticker,
  signal
) {
  const key =
    String(
      ticker || ""
    )
      .trim()
      .toUpperCase();

  if (!key) {
    return null;
  }

  const cached =
    sparklineCache.get(
      key
    );

  if (
    cached &&
    Date.now() -
      cached.timestamp <
      SPARKLINE_TTL
  ) {
    return cached.data;
  }

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
  }

  const {
    data: rows,
    error,
  } =
    await supabase
      .from(
        "stock_daily_prices"
      )
      .select(
        "trading_date,close"
      )
      .eq(
        "ticker",
        key
      )
      .order(
        "trading_date",
        {
          ascending:
            false,
        }
      )
      .limit(30);

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
  }

  if (error) {
    throw error;
  }

  const data =
    (rows || [])
      .slice()
      .reverse()
      .map(
        (row) =>
          Number(
            row?.close
          )
      )
      .filter(
        (value) =>
          Number.isFinite(
            value
          ) &&
          value > 0
      );

  if (
    data.length < 2
  ) {
    return null;
  }

  sparklineCache.set(
    key,
    {
      data,

      timestamp:
        Date.now(),
    }
  );

  return data;
}

function MiniSparkline({
  data,
  isPositive,
}) {
  const width = 58;
  const height = 38;
  const padding = 2;

  const color =
    isPositive
      ? "#10b981"
      : "#ef4444";

  if (
    !data ||
    data.length < 2
  ) {
    return (
      <div
        className="flex h-[38px] w-[58px] items-center justify-center text-xs text-muted-foreground/50"
        aria-label="Chart unavailable"
      >
        —
      </div>
    );
  }

  const minimum =
    Math.min(...data);

  const maximum =
    Math.max(...data);

  const range =
    maximum -
      minimum ||
    1;

  const points =
    data
      .map(
        (
          price,
          index
        ) => {
          const x =
            padding +
            (index /
              (data.length -
                1)) *
              (width -
                padding *
                  2);

          const y =
            padding +
            ((maximum -
              price) /
              range) *
              (height -
                padding *
                  2);

          return `${x},${y}`;
        }
      )
      .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={
          points
        }
        stroke={
          color
        }
        strokeWidth="2"
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
  const [
    data,
    setData,
  ] = useState(null);

  useEffect(() => {
    const controller =
      new AbortController();

    fetchSparkline(
      ticker,
      controller.signal
    )
      .then(
        setData
      )
      .catch(
        (error) => {
          if (
            error?.name !==
            "AbortError"
          ) {
            console.warn(
              `Sparkline failed for ${ticker}:`,
              error
            );
          }
        }
      );

    return () =>
      controller.abort();
  }, [ticker]);

  return (
    <MiniSparkline
      data={data}
      isPositive={
        isPositive
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* PRICE                                                                       */
/* -------------------------------------------------------------------------- */

function AnimatedPrice({
  value,
}) {
  const [
    flash,
    setFlash,
  ] = useState(null);

  const previous =
    useRef(value);

  useEffect(() => {
    if (
      previous.current !==
        value &&
      value !== "—"
    ) {
      const oldValue =
        Number(
          previous.current
        );

      const newValue =
        Number(value);

      if (
        Number.isFinite(
          oldValue
        ) &&
        Number.isFinite(
          newValue
        )
      ) {
        setFlash(
          newValue >
            oldValue
            ? "up"
            : "down"
        );

        const timer =
          window.setTimeout(
            () =>
              setFlash(
                null
              ),
            700
          );

        previous.current =
          value;

        return () =>
          window.clearTimeout(
            timer
          );
      }
    }

    previous.current =
      value;

    return undefined;
  }, [value]);

  return (
    <span
      className="
        whitespace-nowrap
        text-[17px]
        font-bold
        tracking-[-0.35px]
        text-foreground
        transition-colors
        duration-500
      "
      style={{
        color:
          flash === "up"
            ? "#10b981"
            : flash ===
                "down"
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

/* -------------------------------------------------------------------------- */
/* SWIPE ACTION                                                                */
/* -------------------------------------------------------------------------- */

function SwipeAction({
  type,
  label,
  icon: Icon,
  progress,
  start,
  end,
  disabled,
  onClick,
}) {
  const opacity =
    useTransform(
      progress,
      [
        start,
        end,
      ],
      [
        0,
        1,
      ]
    );

  const scale =
    useTransform(
      progress,
      [
        start,
        end,
      ],
      [
        0.76,
        1,
      ]
    );

  const translateX =
    useTransform(
      progress,
      [
        start,
        end,
      ],
      [
        16,
        0,
      ]
    );

  const backgroundClass =
    type ===
    "delete"
      ? "bg-red-500"
      : type ===
          "alert"
        ? "bg-amber-500"
        : "bg-sky-500";

  return (
    <motion.button
      type="button"
      aria-label={
        label
      }
      disabled={
        disabled
      }
      onClick={(event) => {
        // Keep the card's link handler from winning when a swipe action is
        // clicked at the edge of the translated card.
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }}
      className={[
        `
          flex
          h-[46px]
          w-[46px]
          shrink-0
          flex-col
          items-center
          justify-center
          gap-0.5
          rounded-full
          text-white
          outline-none
          will-change-transform
        `,
        backgroundClass,
      ].join(" ")}
      style={{
        opacity,
        scale,
        x:
          translateX,
      }}
      whileTap={{
        scale:
          0.9,
      }}
    >
      <Icon
        size={16}
        strokeWidth={2.1}
      />

      <span className="text-[8px] font-bold leading-none">
        {label}
      </span>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/* WATCHLIST CARD                                                              */
/* -------------------------------------------------------------------------- */

function WatchlistCard({
  item,
  stock,
  quote,
  index,
  onRemove,
  onStarToggle,
  onRequestPortfolioRemoval,
}) {
  const navigate =
    useNavigate();

  const hasStock =
    Boolean(stock);

  const companyName =
    getCompanyName(
      item.ticker,
      stock,
      item
    );

  const [
    swiped,
    setSwiped,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const cardX =
    useMotionValue(0);

  const revealWidth =
    172;

  const revealProgress =
    useTransform(
      cardX,
      [
        -revealWidth,
        0,
      ],
      [
        1,
        0,
      ],
      {
        clamp:
          true,
      }
    );

  const touchX =
    useRef(null);

  const touchY =
    useRef(null);

  const startingX =
    useRef(0);

  const dragging =
    useRef(false);

  const suppressClick =
    useRef(false);

  const livePrice =
    typeof quote?.c ===
    "number"
      ? quote.c
      : null;

  const storedPrice =
    typeof stock?.current_price ===
    "number"
      ? stock.current_price
      : null;

  const displayPrice =
    livePrice !== null
      ? livePrice.toFixed(
          2
        )
      : storedPrice !== null
        ? storedPrice.toFixed(
            2
          )
        : "—";

  const dailyGain =
    typeof quote?.dp ===
    "number"
      ? quote.dp
      : null;

  const positive =
    (dailyGain ?? 0) >=
    0;

  const linkTo =
    hasStock &&
    stock?.id &&
    stock.id !==
      "undefined"
      ? `/stock/${stock.id}`
      : `/stock/ticker-${item.ticker}`;

  function snapCard(
    target
  ) {
    animate(
      cardX,
      target,
      {
        type:
          "spring",

        stiffness:
          520,

        damping:
          46,

        mass:
          0.55,
      }
    );
  }

  function onTouchStart(
    event
  ) {
    if (
      deleting
    ) {
      return;
    }

    touchX.current =
      event.touches[0]
        .clientX;

    touchY.current =
      event.touches[0]
        .clientY;

    startingX.current =
      cardX.get();

    dragging.current =
      false;

    suppressClick.current =
      false;
  }

  function onTouchMove(
    event
  ) {
    if (
      touchX.current ===
        null ||
      touchY.current ===
        null ||
      deleting
    ) {
      return;
    }

    const dx =
      event.touches[0]
        .clientX -
      touchX.current;

    const dy =
      event.touches[0]
        .clientY -
      touchY.current;

    if (
      !dragging.current &&
      Math.abs(dy) >
        Math.abs(dx)
    ) {
      return;
    }

    if (
      Math.abs(dx) >
      4
    ) {
      dragging.current =
        true;

      suppressClick.current =
        true;
    }

    if (
      !dragging.current
    ) {
      return;
    }

    cardX.set(
      clamp(
        startingX.current +
          dx,
        -190,
        0
      )
    );
  }

  function onTouchEnd() {
    if (
      deleting
    ) {
      return;
    }

    const currentX =
      cardX.get();

    const threshold =
      swiped
        ? revealWidth *
          0.25
        : revealWidth *
          0.34;

    if (
      Math.abs(
        currentX
      ) >= threshold
    ) {
      snapCard(
        -revealWidth
      );

      setSwiped(
        true
      );
    } else {
      snapCard(0);

      setSwiped(
        false
      );
    }

    touchX.current =
      null;

    touchY.current =
      null;

    dragging.current =
      false;

    window.setTimeout(
      () => {
        suppressClick.current =
          false;
      },
      90
    );
  }

  function closeSwipe() {
    snapCard(0);

    setSwiped(
      false
    );
  }

  async function share(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();

    const url =
      `${window.location.origin}${linkTo}`;

    const text =
      `${companyName} (${item.ticker})` +
      (displayPrice ===
      "—"
        ? ""
        : ` — $${displayPrice}`);

    try {
      if (
        navigator.share
      ) {
        await navigator.share(
          {
            title:
              item.ticker,

            text,

            url,
          }
        );
      } else {
        await navigator.clipboard?.writeText(
          `${text} ${url}`
        );
      }
    } catch (error) {
      if (
        error?.name !==
        "AbortError"
      ) {
        console.warn(
          "Share failed:",
          error
        );
      }
    } finally {
      closeSwipe();
    }
  }

  function openPriceAlert(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();

    const selectedTicker =
      String(
        item.ticker ||
          ""
      )
        .trim()
        .toUpperCase();

    closeSwipe();

    navigate(
      "/price-alerts",
      {
        state: {
          openAddAlert:
            true,

          ticker:
            selectedTicker,
        },
      }
    );
  }

  async function remove(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      deleting
    ) {
      return;
    }

    if (
      hasStock
    ) {
      closeSwipe();

      onRequestPortfolioRemoval(
        item,
        stock
      );

      return;
    }

    setDeleting(
      true
    );

    animate(
      cardX,
      -430,
      {
        duration:
          0.22,

        ease: [
          0.4,
          0,
          1,
          1,
        ],
      }
    );

    await new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          220
        )
    );

    const removed =
      await onRemove(
        item.id
      );

    if (
      !removed
    ) {
      setDeleting(
        false
      );

      snapCard(0);

      setSwiped(
        false
      );
    }
  }

  function handleCardClick(
    event
  ) {
    if (
      swiped ||
      suppressClick.current ||
      deleting
    ) {
      event.preventDefault();

      closeSwipe();

      return;
    }

    navigate(
      linkTo,
      {
        state: {
          from:
            "/watchlist",
        },
      }
    );
  }

  function handleCardKeyDown(
    event
  ) {
    if (
      event.key ===
        "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      handleCardClick(
        event
      );
    }
  }

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity:
          deleting
            ? 0
            : 1,

        y: 0,

        scale:
          deleting
            ? 0.97
            : 1,
      }}
      exit={{
        opacity: 0,
        height: 0,
        scale: 0.97,
      }}
      transition={{
        opacity: {
          duration:
            0.16,
        },

        layout: {
          duration:
            0.18,
        },

        delay:
          Math.min(
            index *
              0.015,
            0.08
          ),
      }}
      className="
        relative
        overflow-hidden
        rounded-[20px]
      "
    >
      <div
        className="
          absolute
          inset-y-0
          right-0
          flex
          items-center
          gap-[6px]
          pr-[6px]
        "
      >
        <SwipeAction
          type="share"
          label="Share"
          icon={
            Share2
          }
          progress={
            revealProgress
          }
          start={
            0.46
          }
          end={
            0.86
          }
          disabled={
            deleting
          }
          onClick={
            share
          }
        />

        <SwipeAction
          type="alert"
          label="Alert"
          icon={
            Bell
          }
          progress={
            revealProgress
          }
          start={
            0.22
          }
          end={
            0.66
          }
          disabled={
            deleting
          }
          onClick={
            openPriceAlert
          }
        />

        <SwipeAction
          type="delete"
          label="Delete"
          icon={
            Trash2
          }
          progress={
            revealProgress
          }
          start={
            0.02
          }
          end={
            0.42
          }
          disabled={
            deleting
          }
          onClick={
            remove
          }
        />
      </div>

      <div
        role="link"
        tabIndex={0}
        onClick={
          handleCardClick
        }
        onKeyDown={
          handleCardKeyDown
        }
        className="block cursor-pointer"
      >
        <motion.div
          style={{
            x:
              cardX,

            touchAction:
              "pan-y",

            willChange:
              "transform",

            WebkitBackfaceVisibility:
              "hidden",

            backfaceVisibility:
              "hidden",
          }}
          className="
            flex
            h-[88px]
            items-center
            gap-2
            rounded-[20px]
            border
            border-border/75
            bg-card
            px-3
            py-2
            shadow-[0_3px_8px_rgba(0,0,0,0.032)]
          "
          onTouchStart={
            onTouchStart
          }
          onTouchMove={
            onTouchMove
          }
          onTouchEnd={
            onTouchEnd
          }
          onTouchCancel={
            onTouchEnd
          }
        >
          <button
            type="button"
            aria-label={
              hasStock
                ? `Remove ${item.ticker} from portfolio`
                : `Add ${item.ticker} to portfolio`
            }
            onTouchStart={(
              event
            ) => {
              event.stopPropagation();
            }}
            onTouchEnd={(
              event
            ) => {
              event.stopPropagation();
            }}
            onClick={(
              event
            ) => {
              event.stopPropagation();

              if (
                hasStock
              ) {
                onRequestPortfolioRemoval(
                  item,
                  stock
                );

                return;
              }

              onStarToggle(
                item,
                stock
              );
            }}
            className="
              flex
              min-h-[44px]
              w-[34px]
              shrink-0
              items-center
              justify-center
              rounded-full
              transition-transform
              duration-150
              active:scale-90
            "
          >
            <Star
              size={20}
              strokeWidth={2}
              className={
                hasStock
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/45"
              }
            />
          </button>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p
              className="
                truncate
                text-[16px]
                font-bold
                leading-[1.05]
                tracking-[-0.25px]
                text-foreground
              "
            >
              {
                item.ticker
              }
            </p>

            <p
              className="
                mt-1
                truncate
                text-[11px]
                leading-tight
                text-muted-foreground
              "
            >
              {companyName}
            </p>

            {item.exchange ? (
              <p
                className="
                  mt-1
                  truncate
                  text-[9px]
                  font-semibold
                  uppercase
                  leading-none
                  tracking-[0.08em]
                  text-muted-foreground/70
                "
              >
                {abbreviateExchange(
                  item.exchange
                )}
              </p>
            ) : (
              <span className="mt-1 h-[9px]" />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex w-[58px] shrink-0 items-center justify-center">
              <Sparkline
                ticker={
                  item.ticker
                }
                isPositive={
                  positive
                }
              />
            </div>

            <div className="w-[82px] shrink-0 text-right">
              <p className="leading-none">
                <AnimatedPrice
                  value={
                    displayPrice
                  }
                />
              </p>

              {dailyGain !==
              null ? (
                <div
                  className={[
                    `
                      mt-1.5
                      ml-auto
                      inline-flex
                      h-[26px]
                      min-w-[70px]
                      items-center
                      justify-center
                      rounded-[8px]
                      px-2
                      text-[12px]
                      font-semibold
                      leading-none
                      text-white
                    `,
                    positive
                      ? "bg-emerald-500"
                      : "bg-red-500",
                  ].join(
                    " "
                  )}
                >
                  {positive
                    ? "+"
                    : ""}

                  {dailyGain.toFixed(
                    2
                  )}
                  %
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  —
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* LOADING                                                                     */
/* -------------------------------------------------------------------------- */

function WatchlistSkeleton() {
  return (
    <div className="space-y-[2px]">
      {[
        0,
        1,
        2,
        3,
        4,
      ].map(
        (item) => (
          <div
            key={
              item
            }
            className="
              h-[88px]
              animate-pulse
              rounded-[20px]
              border
              border-border/70
              bg-card
            "
          />
        )
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                         */
/* -------------------------------------------------------------------------- */

export default function Watchlist() {
  const {
    user,
    preferences,
    updatePreference,
    isLoadingPreferences,
  } = useAuth();

  const {
    quotes = {},
    refreshQuotes,
  } = useMarketData();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    stocks,
    setStocks,
  ] = useState([]);

  const [
    watchlists,
    setWatchlists,
  ] = useState([]);

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

  const sortMode =
    preferences?.watchlist_sort ||
    "percentage";

  const [
    sortPreferenceSaving,
    setSortPreferenceSaving,
  ] = useState(false);

  const [
    sortPreferenceError,
    setSortPreferenceError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    addDialogOpen,
    setAddDialogOpen,
  ] = useState(false);

  const [
    ticker,
    setTicker,
  ] = useState("");

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    suggestions,
    setSuggestions,
  ] = useState([]);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState(null);

  const [
    dialogItem,
    setDialogItem,
  ] = useState(null);

  const [
    portfolioRemoval,
    setPortfolioRemoval,
  ] = useState(null);

  const searchTimer =
    useRef(null);

  const loadWatchlists =
    useCallback(
      async () => {
        if (!user?.id) {
          return [];
        }

        let {
          data,
          error,
        } =
          await supabase
            .from(
              "watchlists"
            )
            .select("*")
            .eq(
              "user_id",
              user.id
            )
            .order(
              "is_default",
              {
                ascending:
                  false,
              }
            )
            .order(
              "created_at",
              {
                ascending:
                  true,
              }
            );

        if (
          error
        ) {
          throw error;
        }

        let nextWatchlists =
          data || [];

        if (
          nextWatchlists.length ===
          0
        ) {
          const {
            data:
              created,

            error:
              createError,
          } =
            await supabase
              .from(
                "watchlists"
              )
              .insert({
                user_id:
                  user.id,

                name:
                  "Watchlist",

                is_default:
                  true,
              })
              .select("*")
              .single();

          if (
            createError
          ) {
            throw createError;
          }

          nextWatchlists =
            [
              created,
            ];
        }

        setWatchlists(
          nextWatchlists
        );

        setActiveWatchlistId(
          (
            currentId
          ) => {
            const storedId =
              getStoredWatchlistId(
                user.id
              );

            const nextId =
              nextWatchlists.some(
                (
                  list
                ) =>
                  list.id ===
                  currentId
              )
                ? currentId
                : nextWatchlists.some(
                      (
                        list
                      ) =>
                        list.id ===
                        storedId
                    )
                  ? storedId
                  : (
                      nextWatchlists.find(
                        (
                          list
                        ) =>
                          list.is_default
                      ) ||
                      nextWatchlists[0]
                    )?.id;

            if (
              nextId
            ) {
              storeActiveWatchlistId(
                user.id,
                nextId
              );
            }

            return (
              nextId ||
              null
            );
          }
        );

        return nextWatchlists;
      },
      [
        user?.id,
      ]
    );

  const refreshWatchlistQuotes =
    useCallback(
      (
        watchItems
      ) => {
        const tickers =
          [
            ...new Set(
              (
                watchItems ||
                []
              )
                .map(
                  (
                    item
                  ) =>
                    item?.ticker?.toUpperCase()
                )
                .filter(
                  Boolean
                )
            ),
          ];

        if (
          tickers.length
        ) {
          refreshQuotes(
            tickers
          );
        }
      },
      [
        refreshQuotes,
      ]
    );

  const load =
    useCallback(
      async () => {
        if (
          !user?.id ||
          !activeWatchlistId
        ) {
          return [];
        }

        const [
          watchlistResult,
          stocksResult,
        ] =
          await Promise.all(
            [
              supabase
                .from(
                  "watchlist_items"
                )
                .select("*")
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "watchlist_id",
                  activeWatchlistId
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  "stocks"
                )
                .select("*")
                .eq(
                  "user_id",
                  user.id
                ),
            ]
          );

        if (
          watchlistResult.error
        ) {
          throw watchlistResult.error;
        }

        if (
          stocksResult.error
        ) {
          throw stocksResult.error;
        }

        const watchItems =
          watchlistResult.data ||
          [];

        const portfolioStocks =
          (
            stocksResult.data ||
            []
          ).filter(
            (
              stock
            ) =>
              stock?.id &&
              stock.id !==
                "undefined"
          );

        setItems(
          watchItems
        );

        setStocks(
          portfolioStocks
        );

        return watchItems;
      },
      [
        user?.id,
        activeWatchlistId,
      ]
    );

  useEffect(() => {
    if (
      !user?.id
    ) {
      setWatchlists([]);
      setActiveWatchlistId(
        null
      );
      setItems([]);
      setStocks([]);
      setLoading(false);

      return undefined;
    }

    let active =
      true;

    setLoading(
      true
    );

    loadWatchlists().catch(
      (error) => {
        if (
          !active
        ) {
          return;
        }

        console.error(
          "Unable to load watchlists:",
          error
        );

        setToast(
          "Unable to load watchlists."
        );

        setLoading(
          false
        );
      }
    );

    return () => {
      active =
        false;
    };
  }, [
    user?.id,
    loadWatchlists,
  ]);

  useEffect(() => {
    const query =
      ticker.trim();

    if (
      !addDialogOpen ||
      !query
    ) {
      setSuggestions(
        []
      );

      setSearching(
        false
      );

      return undefined;
    }

    window.clearTimeout(
      searchTimer.current
    );

    const controller =
      new AbortController();

    searchTimer.current =
      window.setTimeout(
        async () => {
          setSearching(
            true
          );

          try {
            const payload =
              await marketDataRequest(
                {
                  action:
                    "search",

                  query,
                },
                controller.signal
              );

            const upper =
              query.toUpperCase();

            setSuggestions(
              normalizeSearchResults(
                payload
              )
                .filter(
                  (
                    item
                  ) =>
                    item.ticker.includes(
                      upper
                    ) ||
                    item.name
                      .toUpperCase()
                      .includes(
                        upper
                      )
                )
                .slice(
                  0,
                  12
                )
            );
          } catch (error) {
            if (
              error?.name !==
              "AbortError"
            ) {
              setSuggestions(
                []
              );
            }
          } finally {
            if (
              !controller
                .signal
                .aborted
            ) {
              setSearching(
                false
              );
            }
          }
        },
        250
      );

    return () => {
      window.clearTimeout(
        searchTimer.current
      );

      controller.abort();
    };
  }, [
    ticker,
    addDialogOpen,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      !activeWatchlistId
    ) {
      return undefined;
    }

    let active =
      true;

    setLoading(
      true
    );

    load()
      .then(
        (
          watchItems
        ) => {
          if (
            active
          ) {
            refreshWatchlistQuotes(
              watchItems
            );
          }
        }
      )
      .catch(
        (error) => {
          if (
            active
          ) {
            console.error(
              error
            );

            setToast(
              "Unable to load watchlist."
            );
          }
        }
      )
      .finally(
        () => {
          if (
            active
          ) {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      active =
        false;
    };
  }, [
    user?.id,
    activeWatchlistId,
    load,
    refreshWatchlistQuotes,
  ]);

  useEffect(() => {
    if (
      !items.length
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            refreshWatchlistQuotes(
              items
            );
          }
        },
        5 *
          60 *
          1000
      );

    return () =>
      window.clearInterval(
        timer
      );
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
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "watchlist_items"
          )
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "watchlist_id",
            activeWatchlistId
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (
        !error
      ) {
        setItems(
          data ||
            []
        );

        refreshWatchlistQuotes(
          data ||
            []
        );
      }
    }

    async function reloadStocks() {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "stocks"
          )
          .select("*")
          .eq(
            "user_id",
            user.id
          );

      if (
        !error
      ) {
        setStocks(
          (
            data ||
            []
          ).filter(
            (
              stock
            ) =>
              stock?.id &&
              stock.id !==
                "undefined"
          )
        );
      }
    }

    const channel =
      supabase
        .channel(
          `watchlist-${user.id}`
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "watchlist_items",

            filter:
              `user_id=eq.${user.id}`,
          },
          reloadWatchlist
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",

            schema:
              "public",

            table:
              "stocks",

            filter:
              `user_id=eq.${user.id}`,
          },
          reloadStocks
        )
        .subscribe();

    return () =>
      supabase.removeChannel(
        channel
      );
  }, [
    user?.id,
    activeWatchlistId,
    refreshWatchlistQuotes,
  ]);

  async function changeSortMode(
    nextMode
  ) {
    const normalizedMode =
      nextMode ===
      "price"
        ? "price"
        : "percentage";

    if (
      sortPreferenceSaving ||
      normalizedMode ===
        sortMode
    ) {
      return;
    }

    setSortPreferenceSaving(
      true
    );

    setSortPreferenceError(
      ""
    );

    try {
      await updatePreference(
        "watchlist_sort",
        normalizedMode
      );
    } catch (error) {
      console.error(
        "Unable to save Watchlist sorting preference:",
        error
      );

      setSortPreferenceError(
        "Unable to save your sorting preference."
      );
    } finally {
      setSortPreferenceSaving(
        false
      );
    }
  }

  function switchWatchlist(
    watchlistId
  ) {
    if (
      !watchlistId ||
      watchlistId ===
        activeWatchlistId
    ) {
      setWatchlistMenuOpen(
        false
      );

      return;
    }

    setLoading(
      true
    );

    setItems([]);

    setActiveWatchlistId(
      watchlistId
    );

    storeActiveWatchlistId(
      user?.id,
      watchlistId
    );

    setWatchlistMenuOpen(
      false
    );
  }

  async function createWatchlist(
    event
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

    setWatchlistSaving(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "watchlists"
          )
          .insert({
            user_id:
              user.id,

            name,

            is_default:
              false,
          })
          .select("*")
          .single();

      if (
        error
      ) {
        throw error;
      }

      setWatchlists(
        (
          current
        ) => [
          ...current,
          data,
        ]
      );

      setNewWatchlistName(
        ""
      );

      setItems([]);

      setLoading(
        true
      );

      setActiveWatchlistId(
        data.id
      );

      storeActiveWatchlistId(
        user.id,
        data.id
      );

      setWatchlistMenuOpen(
        false
      );

      setToast(
        `${data.name} created`
      );
    } catch (error) {
      setToast(
        error?.code ===
          "23505"
          ? "A watchlist with that name already exists."
          : error?.message ||
              "Unable to create watchlist."
      );
    } finally {
      setWatchlistSaving(
        false
      );
    }
  }

  async function deleteWatchlist(
    watchlist
  ) {
    if (
      !user?.id ||
      !watchlist?.id ||
      watchlist.is_default ||
      watchlistSaving
    ) {
      return;
    }

    setWatchlistSaving(
      true
    );

    try {
      const {
        error,
      } =
        await supabase
          .from(
            "watchlists"
          )
          .delete()
          .eq(
            "id",
            watchlist.id
          )
          .eq(
            "user_id",
            user.id
          );

      if (
        error
      ) {
        throw error;
      }

      const remaining =
        watchlists.filter(
          (
            list
          ) =>
            list.id !==
            watchlist.id
        );

      setWatchlists(
        remaining
      );

      if (
        activeWatchlistId ===
        watchlist.id
      ) {
        const next =
          remaining.find(
            (
              list
            ) =>
              list.is_default
          ) ||
          remaining[0] ||
          null;

        setItems([]);

        setLoading(
          Boolean(
            next
          )
        );

        setActiveWatchlistId(
          next?.id ||
            null
        );

        if (
          next?.id
        ) {
          storeActiveWatchlistId(
            user.id,
            next.id
          );
        }
      }

      setToast(
        `${watchlist.name} deleted`
      );
    } catch (error) {
      setToast(
        error?.message ||
          "Unable to delete watchlist."
      );
    } finally {
      setWatchlistSaving(
        false
      );
    }
  }

  async function addTicker(
    symbol,
    exchange = ""
  ) {
    const normalized =
      String(
        symbol ||
          ""
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
        (
          item
        ) =>
          item.ticker.toUpperCase() ===
          normalized
      )
    ) {
      setToast(
        `"${normalized}" is already in your watchlist.`
      );

      return false;
    }

    setAdding(
      true
    );

    try {
      let companyName =
        "";

      let resolvedExchange =
        exchange;

      try {
        const profile =
          await marketDataRequest(
            {
              action:
                "profile",

              ticker:
                normalized,
            }
          );

        companyName =
          profile?.name ||
          "";

        resolvedExchange =
          resolvedExchange ||
          profile?.exchange ||
          "";
      } catch (error) {
        console.warn(
          "Profile lookup failed:",
          error
        );
      }

      const {
        error,
      } =
        await supabase
          .from(
            "watchlist_items"
          )
          .insert({
            user_id:
              user.id,

            watchlist_id:
              activeWatchlistId,

            ticker:
              normalized,

            exchange:
              resolvedExchange,

            company_name:
              companyName ||
              normalized,
          });

      if (
        error
      ) {
        throw error;
      }

      setTicker("");
      setSuggestions([]);
      setAddDialogOpen(
        false
      );

      const watchItems =
        await load();

      refreshWatchlistQuotes(
        watchItems
      );

      setToast(
        `${normalized} added to watchlist`
      );

      return true;
    } catch (error) {
      setToast(
        error?.message ||
          "Failed to add ticker."
      );

      return false;
    } finally {
      setAdding(
        false
      );
    }
  }

  async function removeTicker(
    id
  ) {
    const previous =
      items;

    const next =
      items.filter(
        (
          item
        ) =>
          item.id !==
          id
      );

    setItems(
      next
    );

    const {
      error,
    } =
      await supabase
        .from(
          "watchlist_items"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "user_id",
          user.id
        );

    if (
      error
    ) {
      setItems(
        previous
      );

      setToast(
        "Failed to remove ticker."
      );

      return false;
    }

    return true;
  }

  function requestPortfolioRemoval(
    item,
    stock
  ) {
    if (
      !item ||
      !stock
    ) {
      return;
    }

    setPortfolioRemoval({
      item,
      stock,
    });
  }

  async function confirmPortfolioRemoval() {
    if (
      !portfolioRemoval ||
      !user?.id
    ) {
      return;
    }

    const {
      item,
      stock,
    } =
      portfolioRemoval;

    const previous =
      stocks;

    setPortfolioRemoval(
      null
    );

    setStocks(
      (
        value
      ) =>
        value.filter(
          (
            entry
          ) =>
            entry.id !==
            stock.id
        )
    );

    const {
      error,
    } =
      await supabase
        .from(
          "stocks"
        )
        .delete()
        .eq(
          "id",
          stock.id
        )
        .eq(
          "user_id",
          user.id
        );

    if (
      error
    ) {
      setStocks(
        previous
      );

      setToast(
        "Failed to update portfolio."
      );

      return;
    }

    setToast(
      `${item.ticker} removed from portfolio`
    );
  }

  function togglePortfolio(
    item,
    stock
  ) {
    if (
      stock
    ) {
      requestPortfolioRemoval(
        item,
        stock
      );

      return;
    }

    setDialogItem({
      ticker:
        item.ticker,

      companyName:
        getCompanyName(
          item.ticker,
          null,
          item
        ),
    });
  }

  const stockForTicker =
    useCallback(
      (
        value
      ) =>
        stocks.find(
          (
            stock
          ) =>
            stock.ticker.toUpperCase() ===
            value.toUpperCase()
        ),
      [
        stocks,
      ]
    );

  const sortedItems =
    useMemo(
      () =>
        [
          ...items,
        ].sort(
          (
            a,
            b
          ) => {
            const aTicker =
              a.ticker.toUpperCase();

            const bTicker =
              b.ticker.toUpperCase();

            const aStock =
              stocks.find(
                (
                  stock
                ) =>
                  stock.ticker.toUpperCase() ===
                  aTicker
              );

            const bStock =
              stocks.find(
                (
                  stock
                ) =>
                  stock.ticker.toUpperCase() ===
                  bTicker
              );

            const aValue =
              sortMode ===
              "price"
                ? Number(
                    quotes[
                      aTicker
                    ]?.c ??
                      aStock?.current_price
                  )
                : Number(
                    quotes[
                      aTicker
                    ]?.dp
                  );

            const bValue =
              sortMode ===
              "price"
                ? Number(
                    quotes[
                      bTicker
                    ]?.c ??
                      bStock?.current_price
                  )
                : Number(
                    quotes[
                      bTicker
                    ]?.dp
                  );

            const normalizedA =
              Number.isFinite(
                aValue
              )
                ? aValue
                : -Infinity;

            const normalizedB =
              Number.isFinite(
                bValue
              )
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
              bTicker
            );
          }
        ),
      [
        items,
        quotes,
        stocks,
        sortMode,
      ]
    );

  const activeWatchlist =
    watchlists.find(
      (
        list
      ) =>
        list.id ===
        activeWatchlistId
    ) ||
    watchlists.find(
      (
        list
      ) =>
        list.is_default
    ) ||
    watchlists[0] ||
    null;

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <AnimatePresence>
        {toast && (
          <Toast
            message={
              toast
            }
            onDone={() =>
              setToast(
                null
              )
            }
          />
        )}
      </AnimatePresence>

      <Dialog
        open={
          watchlistMenuOpen
        }
        onOpenChange={
          setWatchlistMenuOpen
        }
      >
        <DialogContent
          className="
            w-[calc(100%-24px)]
            max-w-[390px]
            rounded-[22px]
            border-border
            bg-card
            p-5
            text-foreground
          "
        >
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold tracking-[-0.35px]">
              Watchlist Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Sort by
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value:
                      "percentage",

                    label:
                      "Percentage",
                  },

                  {
                    value:
                      "price",

                    label:
                      "Price",
                  },
                ].map(
                  (
                    option
                  ) => {
                    const selected =
                      sortMode ===
                      option.value;

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        onClick={() =>
                          void changeSortMode(
                            option.value
                          )
                        }
                        disabled={
                          isLoadingPreferences ||
                          sortPreferenceSaving
                        }
                        aria-pressed={
                          selected
                        }
                        className={[
                          `
                            flex
                            h-[46px]
                            items-center
                            justify-between
                            rounded-[14px]
                            border
                            px-3
                            text-[13px]
                            font-semibold
                            transition-[transform,background-color,border-color]
                            duration-150
                            active:scale-[0.98]
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          `,
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-foreground",
                        ].join(
                          " "
                        )}
                      >
                        <span>
                          {
                            option.label
                          }
                        </span>

                        {selected && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              {sortPreferenceError ? (
                <p
                  role="alert"
                  className="mt-2 text-[12px] font-medium text-red-600"
                >
                  {
                    sortPreferenceError
                  }
                </p>
              ) : null}
            </section>

            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Switch Watchlist
              </p>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-[15px] border border-border p-1">
                {watchlists.map(
                  (
                    watchlist
                  ) => {
                    const active =
                      watchlist.id ===
                      activeWatchlistId;

                    return (
                      <div
                        key={
                          watchlist.id
                        }
                        className={[
                          `
                            flex
                            items-center
                            gap-2
                            rounded-[12px]
                            transition-colors
                          `,
                          active
                            ? "bg-muted"
                            : "",
                        ].join(
                          " "
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            switchWatchlist(
                              watchlist.id
                            )
                          }
                          className="
                            flex
                            min-h-[44px]
                            min-w-0
                            flex-1
                            items-center
                            justify-between
                            px-3
                            text-left
                            text-[13px]
                            font-semibold
                            text-foreground
                          "
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
                                watchlist
                              )
                            }
                            className="
                              mr-1
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-center
                              justify-center
                              rounded-[10px]
                              text-muted-foreground
                              transition-[transform,background-color,color]
                              active:scale-90
                              active:bg-red-50
                              active:text-red-600
                              disabled:opacity-50
                              dark:active:bg-red-950/30
                            "
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            <section>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
                  maxLength={
                    40
                  }
                  placeholder="e.g. Growth Stocks"
                  className="h-[46px] rounded-[14px]"
                  onChange={(
                    event
                  ) =>
                    setNewWatchlistName(
                      event.target
                        .value
                    )
                  }
                />

                <Button
                  type="submit"
                  disabled={
                    watchlistSaving ||
                    !newWatchlistName.trim()
                  }
                  className="h-[46px] shrink-0 rounded-[14px]"
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
        open={
          addDialogOpen
        }
        onOpenChange={
          setAddDialogOpen
        }
        ticker={
          ticker
        }
        setTicker={
          setTicker
        }
        suggestions={
          suggestions
        }
        searching={
          searching
        }
        adding={
          adding
        }
        items={
          items
        }
        stocks={
          stocks
        }
        onAdd={
          addTicker
        }
      />

      <Dialog
        open={Boolean(
          portfolioRemoval
        )}
        onOpenChange={(
          open
        ) => {
          if (
            !open
          ) {
            setPortfolioRemoval(
              null
            );
          }
        }}
      >
        <DialogContent
          className="
            w-[calc(100%-24px)]
            max-w-[360px]
            rounded-[22px]
            border-border
            bg-card
            p-5
            text-foreground
          "
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              Confirm portfolio removal
            </DialogTitle>
          </DialogHeader>

          <p className="pt-1 text-center text-[16px] font-semibold text-foreground">
            Remove{" "}
            {
              portfolioRemoval
                ?.item
                ?.ticker
            }{" "}
            from your portfolio?
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-[46px] rounded-[14px]"
              onClick={() =>
                setPortfolioRemoval(
                  null
                )
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="h-[46px] rounded-[14px]"
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
          ticker={
            dialogItem.ticker
          }
          companyName={
            dialogItem.companyName
          }
          userId={
            user?.id
          }
          onOpenChange={(
            open
          ) => {
            if (
              !open
            ) {
              setDialogItem(
                null
              );
            }
          }}
          onAdded={
            async () => {
              const addedTicker =
                dialogItem.ticker;

              setDialogItem(
                null
              );

              await load();

              setToast(
                `${addedTicker} added to portfolio`
              );
            }
          }
        />
      )}

      <header
        className="
          sticky
          top-0
          z-20
          shrink-0
          border-b
          border-border/70
          bg-background/95
          backdrop-blur-xl
        "
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div
          className="
            mx-auto
            grid
            h-[62px]
            w-full
            max-w-[430px]
            grid-cols-[44px_1fr_44px]
            items-end
            px-4
            pb-3
          "
        >
          <button
            type="button"
            aria-label="Open watchlist settings"
            onClick={() =>
              setWatchlistMenuOpen(
                true
              )
            }
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-[12px]
              text-foreground
              transition-[transform,background-color]
              duration-150
              active:scale-90
              active:bg-muted
            "
          >
            <Menu
              size={22}
              strokeWidth={2}
            />
          </button>

          <div className="flex min-w-0 items-center justify-center gap-1.5">
            <Star
              size={24}
              strokeWidth={2}
              className="shrink-0 fill-amber-400 text-amber-400"
            />

            <h1
              className="
                truncate
                text-[24px]
                font-bold
                leading-none
                tracking-[-0.5px]
                text-foreground
              "
            >
              {activeWatchlist?.name ||
                "Watchlist"}
            </h1>
          </div>

          <div aria-hidden="true" />
        </div>
      </header>

      <main
        className="
          mx-auto
          w-full
          max-w-[430px]
          flex-1
          px-4
          pt-3
        "
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom) + 9rem)",
        }}
      >
        {loading ? (
          <WatchlistSkeleton />
        ) : items.length ===
          0 ? (
          <div
            className="
              rounded-[22px]
              border
              border-dashed
              border-border
              bg-card
              px-6
              py-14
              text-center
            "
          >
            <Star className="mx-auto h-8 w-8 fill-amber-400 text-amber-400" />

            <h2 className="mt-4 text-[18px] font-bold tracking-[-0.3px] text-foreground">
              Nothing in this watchlist yet
            </h2>

            <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-5 text-muted-foreground">
              Tap the + button below to add your first stock.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="space-y-[2px]"
          >
            <AnimatePresence
              initial={
                false
              }
              mode="popLayout"
            >
              {sortedItems.map(
                (
                  item,
                  index
                ) => (
                  <WatchlistCard
                    key={
                      item.id
                    }
                    item={
                      item
                    }
                    stock={stockForTicker(
                      item.ticker
                    )}
                    quote={
                      quotes[
                        item.ticker.toUpperCase()
                      ]
                    }
                    index={
                      index
                    }
                    onRemove={
                      removeTicker
                    }
                    onStarToggle={
                      togglePortfolio
                    }
                    onRequestPortfolioRemoval={
                      requestPortfolioRemoval
                    }
                  />
                )
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      <button
        type="button"
        aria-label="Add stock to watchlist"
        onClick={() =>
          setAddDialogOpen(
            true
          )
        }
        className="
          fixed
          left-1/2
          z-50
          flex
          h-[54px]
          w-[54px]
          -translate-x-1/2
          items-center
          justify-center
          rounded-full
          border
          border-border
          bg-card/95
          text-foreground
          shadow-[0_8px_22px_rgba(0,0,0,0.12)]
          backdrop-blur-xl
          transition-[transform,box-shadow]
          duration-150
          active:scale-90
        "
        style={{
          bottom:
            "calc(env(safe-area-inset-bottom) + 70px)",
        }}
      >
        <Plus
          size={23}
          strokeWidth={2.2}
        />
      </button>
    </div>
  );
}
