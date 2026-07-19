import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { Loader2, Star, Plus, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

function abbreviateExchange(exchange) {
  if (!exchange) return "";
  const e = exchange.toUpperCase();
  if (e.includes("NASDAQ")) return "NASDAQ";
  if (e.includes("NYSE AMERICAN") || e.includes("AMEX")) return "AMEX";
  if (e.includes("NEW YORK STOCK EXCHANGE") || e.includes("NYSE")) return "NYSE";
  if (e.includes("OTC") || e.includes("PINK")) return "OTC";
  if (e.includes("CBOE")) return "CBOE";
  if (e.includes("BATS")) return "BATS";
  if (e.includes("TSX VENTURE") || e.includes("TSXV")) return "TSXV";
  if (e.includes("TSX") || e.includes("TORONTO")) return "TSX";
  if (e.includes("CSE") || e.includes("CANADIAN SECURITIES")) return "CSE";
  if (e.includes("NEO")) return "NEO";
  if (e.includes("LONDON") || e.includes("LSE")) return "LSE";
  if (e.includes("EURONEXT PARIS") || e.includes("XPAR")) return "EPA";
  if (e.includes("EURONEXT AMSTERDAM") || e.includes("XAMS")) return "AMS";
  if (e.includes("EURONEXT BRUSSELS") || e.includes("XBRU")) return "EBR";
  if (e.includes("EURONEXT LISBON") || e.includes("XLIS")) return "ELI";
  if (e.includes("EURONEXT") || e.includes("ENX")) return "ENX";
  if (e.includes("XETRA") || e.includes("FRANKFURT") || e.includes("FSE") || e.includes("FWB")) return "FRA";
  if (e.includes("BERLIN")) return "BER";
  if (e.includes("MUNICH") || e.includes("MÜNCHEN")) return "MUN";
  if (e.includes("STUTTGART")) return "STU";
  if (e.includes("HAMBURG")) return "HAM";
  if (e.includes("SIX") || e.includes("SWISS") || e.includes("ZURICH")) return "SIX";
  if (e.includes("MILAN") || e.includes("BORSA ITALIANA") || e.includes("BIT")) return "BIT";
  if (e.includes("MADRID") || e.includes("BME") || e.includes("BOLSA")) return "BME";
  if (e.includes("OSLO") || e.includes("OSE")) return "OSE";
  if (e.includes("STOCKHOLM") || e.includes("OMX") || e.includes("SSE")) return "STO";
  if (e.includes("COPENHAGEN") || e.includes("CPH")) return "CPH";
  if (e.includes("HELSINKI") || e.includes("HEL")) return "HEL";
  if (e.includes("WARSAW") || e.includes("GPW")) return "WSE";
  if (e.includes("PRAGUE") || e.includes("PSE")) return "PSE";
  if (e.includes("BUDAPEST") || e.includes("BÉT")) return "BSE";
  if (e.includes("VIENNA") || e.includes("WIENER BÖRSE")) return "VIE";
  if (e.includes("ATHENS") || e.includes("ASE")) return "ATH";
  if (e.includes("ISTANBUL") || e.includes("BIST") || e.includes("BORSA ISTANBUL")) return "BIST";
  if (e.includes("MOSCOW") || e.includes("MOEX") || e.includes("MICEX")) return "MOEX";
  if (e.includes("ASX") || e.includes("AUSTRALIAN")) return "ASX";
  if (e.includes("NZX") || e.includes("NEW ZEALAND")) return "NZX";
  if (e.includes("CHI-X AUSTRALIA")) return "CXA";
  if (e.includes("TOKYO") || e.includes("TSE") || e.includes("JPX")) return "TSE";
  if (e.includes("OSAKA") || e.includes("OSE")) return "OSE";
  if (e.includes("NAGOYA") || e.includes("NSE")) return "NSE-JP";
  if (e.includes("FUKUOKA")) return "FKE";
  if (e.includes("SAPPORO")) return "SPE";
  if (e.includes("SHANGHAI") || e.includes("SSE") || e.includes("SHSE")) return "SSE";
  if (e.includes("SHENZHEN") || e.includes("SZSE")) return "SZSE";
  if (e.includes("HONG KONG") || e.includes("HKEX") || e.includes("HKG")) return "HKEX";
  if (e.includes("NSE") || e.includes("NATIONAL STOCK EXCHANGE")) return "NSE";
  if (e.includes("BSE") || e.includes("BOMBAY")) return "BSE";
  if (e.includes("KRX") || e.includes("KOREA EXCHANGE")) return "KRX";
  if (e.includes("KOSDAQ")) return "KOSDAQ";
  if (e.includes("KOSPI")) return "KOSPI";
  if (e.includes("TWSE") || e.includes("TAIWAN")) return "TWSE";
  if (e.includes("TPEX")) return "TPEX";
  if (e.includes("SGX") || e.includes("SINGAPORE")) return "SGX";
  if (e.includes("BURSA") || e.includes("MALAYSIA") || e.includes("KLSE")) return "KLSE";
  if (e.includes("SET") || e.includes("THAILAND")) return "SET";
  if (e.includes("IDX") || e.includes("INDONESIA")) return "IDX";
  if (e.includes("PSE") || e.includes("PHILIPPINES")) return "PSE";
  if (e.includes("HOSE") || e.includes("VIETNAM")) return "HOSE";
  if (e.includes("TADAWUL") || e.includes("SAUDI")) return "TADAWUL";
  if (e.includes("DFM") || e.includes("DUBAI")) return "DFM";
  if (e.includes("ADX") || e.includes("ABU DHABI")) return "ADX";
  if (e.includes("TASE") || e.includes("TEL AVIV")) return "TASE";
  if (e.includes("JSE") || e.includes("JOHANNESBURG")) return "JSE";
  if (e.includes("EGX") || e.includes("EGYPT")) return "EGX";
  if (e.includes("B3") || e.includes("BOVESPA") || e.includes("BRAZIL")) return "B3";
  if (e.includes("BMV") || e.includes("MEXICO")) return "BMV";
  if (e.includes("BVC") || e.includes("COLOMBIA")) return "BVC";
  if (e.includes("BVL") || e.includes("LIMA")) return "BVL";
  if (e.includes("BYMA") || e.includes("ARGENTINA")) return "BYMA";
  return exchange;
}

function getCompanyName(ticker, stock, item) {
  if (stock?.company_name && stock.company_name !== ticker) return stock.company_name;
  if (item?.company_name && item.company_name !== ticker) return item.company_name;
  if (stock?.company_name) return stock.company_name;
  if (item?.company_name) return item.company_name;
  return ticker;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-gray-900 text-white text-sm shadow-lg">
      {message}
    </div>
  );
}

async function callFinnhub(params) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetch(`/api/finnhub?${searchParams}`);
  if (!res.ok) {
    throw new Error("Failed to fetch Finnhub data");
  }
  return res.json();
}

function AddToPortfolioDialog({ open, onOpenChange, ticker, companyName, onAdded, userId }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let currentPrice = parseFloat(purchasePrice);

    try {
      const data = await callFinnhub({ action: "quote", ticker });
      if (data?.c) currentPrice = data.c;
    } catch {}

    await supabase.from("stocks").insert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price: currentPrice,
      sector: "",
    });

    setLoading(false);
    setQuantity("");
    setPurchasePrice("");
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {ticker} to Portfolio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-gray-600">{companyName}</div>

          <div className="space-y-2">
            <Label>Shares</Label>
            <Input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Avg. Purchase Price</Label>
            <Input
              type="number"
              step="any"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className={loading ? "ml-2" : ""}>Add to Portfolio</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MiniSparkline({ isPositive }) {
  const color = isPositive ? "#10b981" : "#ef4444";
  const points = isPositive
    ? "2,28 8,22 14,26 20,18 26,20 32,12 38,8"
    : "2,8 8,12 14,10 20,18 26,16 32,22 38,28";

  return (
    <svg width="40" height="30" viewBox="0 0 40 30" fill="none" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function AnimatedPrice({ value }) {
  const [flash, setFlash] = useState(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value && value !== "—") {
      const prev = parseFloat(prevRef.current);
      const next = parseFloat(value);

      if (!Number.isNaN(prev) && !Number.isNaN(next)) {
        const dir = next > prev ? "up" : "down";
        setFlash(dir);
        const t = setTimeout(() => setFlash(null), 700);
        prevRef.current = value;
        return () => clearTimeout(t);
      }
    }

    prevRef.current = value;
  }, [value]);

  return (
    <span
      className={`text-lg font-semibold tabular-nums transition-colors ${
        flash === "up" ? "text-emerald-600" : flash === "down" ? "text-red-600" : "text-gray-900"
      }`}
    >
      {value !== "—" ? "$" + value : "—"}
    </span>
  );
}

function WatchlistCard({ item, stock, quote, onRemove, onStarToggle, index }) {
  const hasStock = !!stock;
  const companyName = getCompanyName(item.ticker, stock, item);

  const [dragX, setDragX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const cardRef = useRef(null);
  const REVEAL_WIDTH = 160;

  const displayPrice = quote?.c ? quote.c.toFixed(2) : stock?.current_price?.toFixed(2) || "—";
  const dailyGainPct = quote?.dp ?? null;
  const dailyIsPositive = (dailyGainPct ?? 0) >= 0;
  const revealRatio = Math.min(Math.abs(dragX) / REVEAL_WIDTH, 1);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!isDragging.current && Math.abs(dy) > Math.abs(dx)) return;

    isDragging.current = true;
    e.stopPropagation();

    if (dx < 0) {
      const raw = swiped ? -REVEAL_WIDTH + dx : dx;
      const clamped = Math.max(raw, -REVEAL_WIDTH - 20);
      setDragX(clamped);
    } else if (swiped) {
      setDragX(Math.min(0, -REVEAL_WIDTH + dx));
    }
  };

  const handleTouchEnd = () => {
    const threshold = swiped ? REVEAL_WIDTH * 0.25 : REVEAL_WIDTH * 0.4;

    if (Math.abs(dragX) >= threshold) {
      setDragX(-REVEAL_WIDTH);
      setSwiped(true);
    } else {
      setDragX(0);
      setSwiped(false);
    }

    touchStartX.current = null;
    isDragging.current = false;
  };

  const closeSwipe = () => {
    setDragX(0);
    setSwiped(false);
  };

  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const shareText = `Check out ${companyName} (${item.ticker}) — 
$$
{displayPrice}`;
    const clipboardText = `${item.ticker} —
$$
{displayPrice}`;

    if (navigator.share) {
      navigator
        .share({
          title: item.ticker,
          text: shareText,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(clipboardText);
    }

    closeSwipe();
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragX(-400);
    await new Promise((r) => setTimeout(r, 260));
    onRemove(item.id);
  };

  const cardStyle = {
    transform: `translateX(${dragX}px)`,
    transition: isDragging.current ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
  };

  const inner = (
    <Link
      to={`/stock/${item.ticker}`}
      className="block rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-4 active:scale-[0.99] transition"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStarToggle(item, stock);
          }}
          className="p-1 min-h-[44px] min-w-[36px] flex items-center justify-center shrink-0"
        >
          <Star
            className={`h-5 w-5 ${hasStock ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{item.ticker}</div>
          <div className="text-sm text-gray-500 truncate">{companyName}</div>

          {item.exchange && (
            <div className="mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {abbreviateExchange(item.exchange)}
              </span>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <AnimatedPrice value={displayPrice} />
          <div
            className={`text-sm font-medium ${
              dailyGainPct !== null
                ? dailyIsPositive
                  ? "text-emerald-600"
                  : "text-red-600"
                : "text-gray-400"
            }`}
          >
            {dailyGainPct !== null ? `${dailyIsPositive ? "+" : ""}${dailyGainPct.toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <MiniSparkline isPositive={dailyIsPositive} />
      </div>
    </Link>
  );

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={handleShare}
          className="w-20 bg-sky-500 text-white flex flex-col items-center justify-center gap-1"
          style={{ opacity: revealRatio, pointerEvents: revealRatio > 0.5 ? "auto" : "none" }}
        >
          <Share2 className="h-5 w-5" />
          <span className="text-xs font-medium">Share</span>
        </button>

        <button
          onClick={handleDelete}
          className="w-20 bg-red-500 text-white flex flex-col items-center justify-center gap-1"
          style={{ opacity: revealRatio, pointerEvents: revealRatio > 0.5 ? "auto" : "none" }}
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      <div
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={
          swiped
            ? (e) => {
                e.preventDefault();
                closeSwipe();
              }
            : undefined
        }
      >
        {inner}
      </div>
    </motion.div>
  );
}

export default function Watchlist() {
  const { user } = useAuth();
  const { quotes, refreshQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialogItem, setDialogItem] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.contains(e.target) && !suggestionsRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = ticker.trim();

    if (!q) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);

      try {
        const data = await callFinnhub({ action: "search", q });
        const results = Array.isArray(data?.result)
          ? data.result
          : Array.isArray(data?.results)
            ? data.results
            : [];

        const filtered = results.filter(
          (s) =>
            s?.ticker &&
            s?.name &&
            !s.ticker.includes(".") &&
            s.ticker.toUpperCase().includes(q.toUpperCase())
        );

        setSuggestions(filtered.slice(0, 8));
      } catch {
        setSuggestions([]);
      }

      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [ticker]);

  const load = async () => {
    if (!user?.id) return [];

    const [{ data: watchData = [] }, { data: stockData = [] }] = await Promise.all([
      supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("stocks")
        .select("*")
        .eq("user_id", user.id),
    ]);

    setItems(watchData);
    setStocks(stockData);

    const missing = watchData.filter((i) => !i.exchange || !i.company_name);

    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (item) => {
          try {
            const data = await callFinnhub({ action: "profile", ticker: item.ticker });
            const updates = {};

            if (data?.exchange) updates.exchange = data.exchange;
            if (data?.name) updates.company_name = data.name;

            if (Object.keys(updates).length) {
              await supabase
                .from("watchlist_items")
                .update(updates)
                .eq("id", item.id)
                .eq("user_id", user.id);
            }
          } catch {}
        })
      );

      const { data: updated = [] } = await supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setItems(updated);
      return updated;
    }

    return watchData;
  };

  useEffect(() => {
    if (!user?.id) return;

    load().then((watchData) => {
      setLoading(false);

      if (watchData?.length) {
        refreshQuotes(watchData.map((i) => i.ticker.toUpperCase()));
      }
    });
  }, [user?.id, refreshQuotes]);

  useEffect(() => {
    if (!user?.id) return;

    const tickersToRefresh = [...new Set(items.map((i) => i.ticker?.toUpperCase()).filter(Boolean))];

    if (tickersToRefresh.length) {
      refreshQuotes(tickersToRefresh);
    }
  }, [items, user?.id, refreshQuotes]);

  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      const tickersToRefresh = [...new Set(items.map((i) => i.ticker?.toUpperCase()).filter(Boolean))];
      if (tickersToRefresh.length) {
        refreshQuotes(tickersToRefresh);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [items, user?.id, refreshQuotes]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`stocks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `user_id=eq.${user.id}` },
        async () => {
          const { data = [] } = await supabase.from("stocks").select("*").eq("user_id", user.id);
          setStocks(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`watchlist-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watchlist_items", filter: `user_id=eq.${user.id}` },
        async () => {
          const { data = [] } = await supabase
            .from("watchlist_items")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          setItems(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const addTicker = async (symbol, exchange = "") => {
    symbol = symbol.trim().toUpperCase();
    if (!symbol) return;

    if (items.find((i) => i.ticker.toUpperCase() === symbol)) {
      setToast(`"${symbol}" is already in your watchlist.`);
      return;
    }

    setAdding(true);
    setShowSuggestions(false);

    let company_name = "";

    try {
      const data = await callFinnhub({ action: "profile", ticker: symbol });
      company_name = data?.name || "";
      if (!exchange && data?.exchange) exchange = data.exchange;
    } catch {}

    await supabase.from("watchlist_items").insert({
      user_id: user.id,
      ticker: symbol,
      exchange,
      company_name,
    });

    setTicker("");
    const watchData = await load();
    setAdding(false);

    if (watchData?.length) {
      refreshQuotes(watchData.map((i) => i.ticker.toUpperCase()));
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    addTicker(ticker, "");
  };

  const handleRemove = async (id) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));

    try {
      await supabase.from("watchlist_items").delete().eq("id", id).eq("user_id", user.id);
    } catch {
      setItems(previous);
      setToast("Failed to remove — please try again.");
    }
  };

  const handleStarToggle = async (item, stock) => {
    if (stock) {
      const previous = stocks;
      setStocks((prev) => prev.filter((s) => s.id !== stock.id));

      try {
        await supabase.from("stocks").delete().eq("id", stock.id).eq("user_id", user.id);
        setToast(`${item.ticker} removed from portfolio`);
      } catch {
        setStocks(previous);
        setToast("Failed to update — please try again.");
      }
    } else {
      const companyName = getCompanyName(item.ticker, null, item);
      setDialogItem({ ticker: item.ticker, companyName });
    }
  };

  const handlePortfolioAdded = async () => {
    const addedTicker = dialogItem.ticker;
    setDialogItem(null);
    await load();
    setToast(`${addedTicker} added to portfolio`);
  };

  const findStock = (tickerValue) =>
    stocks.find((s) => s.ticker.toUpperCase() === tickerValue.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {dialogItem && (
        <AddToPortfolioDialog
          open={!!dialogItem}
          onOpenChange={() => setDialogItem(null)}
          ticker={dialogItem.ticker}
          companyName={dialogItem.companyName}
          onAdded={handlePortfolioAdded}
          userId={user?.id}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* === UPDATED HEADER (gap-1) === */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-1">
            <Star className="h-7 w-7 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900">Watchlist</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1.5">Stocks you're watching</p>
        </div>
        {/* === END UPDATED HEADER === */}

        <form onSubmit={handleAdd} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={ticker}
                placeholder="Add ticker"
                onChange={(e) => {
                  setTicker(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="uppercase placeholder:normal-case w-full"
                autoComplete="off"
              />

              {showSuggestions && (searchLoading || suggestions.length > 0) && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                >
                  {searchLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
                  ) : (
                    suggestions.map((s) => {
                      const alreadyAdded = !!items.find(
                        (i) => i.ticker.toUpperCase() === s.ticker.toUpperCase()
                      );
                      const inPortfolio = !!stocks.find(
                        (st) => st.ticker.toUpperCase() === s.ticker.toUpperCase()
                      );

                      return (
                        <button
                          key={`${s.ticker}-${s.exchange || "unknown"}`}
                          type="button"
                          disabled={alreadyAdded}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (alreadyAdded) return;
                            setTicker(s.ticker);
                            setShowSuggestions(false);
                            addTicker(s.ticker, s.exchange);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                            alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{s.ticker}</div>
                            <div className="text-sm text-gray-500 truncate">{s.name}</div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {s.exchange && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                {s.exchange}
                              </span>
                            )}

                            {alreadyAdded && <span className="text-xs text-gray-400">Added</span>}

                            {!alreadyAdded && inPortfolio && (
                              <span className="text-xs text-amber-600">In portfolio</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <Button type="submit" disabled={adding || !ticker.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Nothing here yet</h2>
            <p className="text-sm text-gray-500 mt-2">Add a ticker above to start watching it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...items]
              .sort((a, b) => {
                const qa = quotes[a.ticker.toUpperCase()]?.dp ?? 0;
                const qb = quotes[b.ticker.toUpperCase()]?.dp ?? 0;
                return qb - qa;
              })
              .map((item, index) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  stock={findStock(item.ticker)}
                  quote={quotes[item.ticker.toUpperCase()]}
                  onRemove={handleRemove}
                  onStarToggle={handleStarToggle}
                  index={index}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
