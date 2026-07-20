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

// ==================== HELPERS ====================
function abbreviateExchange(exchange) {
  if (!exchange) return "";
  const e = exchange.toUpperCase();
  if (e.includes("NASDAQ")) return "NASDAQ";
  if (e.includes("NYSE AMERICAN") || e.includes("AMEX")) return "AMEX";
  if (e.includes("NEW YORK STOCK EXCHANGE") || e.includes("NYSE")) return "NYSE";
  if (e.includes("OTC") || e.includes("PINK")) return "OTC";
  if (e.includes("TSX VENTURE") || e.includes("TSXV")) return "TSXV";
  if (e.includes("TSX")) return "TSX";
  if (e.includes("LSE")) return "LSE";
  if (e.includes("ASX")) return "ASX";
  if (e.includes("TOKYO") || e.includes("TSE")) return "TSE";
  if (e.includes("SHANGHAI")) return "SSE";
  if (e.includes("HONG KONG") || e.includes("HKEX")) return "HKEX";
  if (e.includes("NSE")) return "NSE";
  if (e.includes("BSE")) return "BSE";
  if (e.includes("KRX")) return "KRX";
  if (e.includes("TWSE")) return "TWSE";
  if (e.includes("SGX")) return "SGX";
  if (e.includes("TADAWUL")) return "TADAWUL";
  if (e.includes("JSE")) return "JSE";
  if (e.includes("B3")) return "B3";
  if (e.includes("BMV")) return "BMV";
  return exchange;
}

function getCompanyName(ticker, stock, item) {
  if (stock?.company_name && stock.company_name !== ticker) return stock.company_name;
  if (item?.company_name && item.company_name !== ticker) return item.company_name;
  return ticker;
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap"
    >
      {message}
    </motion.div>
  );
}

// ==================== REAL 1-MONTH SPARKLINE ====================
function RealSparkline({ data, isPositive }) {
  if (!data || data.length < 2) return null;
  const prices = data.map((d) => Number(d.close)).filter((n) => !isNaN(n));
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const close = Number(d.close);
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((close - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="58" height="26" viewBox="0 0 100 100" className="shrink-0">
      <polyline
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

async function callFinnhub(params) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetch(`/api/finnhub?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch Finnhub data");
  return res.json();
}

// ==================== ADD TO PORTFOLIO DIALOG ====================
function AddToPortfolioDialog({ open, onOpenChange, ticker, companyName, onAdded, userId }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let currentPrice = parseFloat(purchasePrice);
    try {
      const res = await callFinnhub({ action: "quote", ticker });
      if (res?.c) currentPrice = res.c;
    } catch {}

    await supabase.from("stocks").insert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price: currentPrice,
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
          <DialogTitle className="font-heading text-xl">Add {ticker} to Portfolio</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{companyName}</p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shares</Label>
              <Input type="number" step="any" min="0.01" placeholder="10" value={quantity} onChange={e => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Avg. Purchase Price</Label>
              <Input type="number" step="any" min="0.01" placeholder="150.00" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !quantity || !purchasePrice}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add to Portfolio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnimatedPrice({ value }) {
  const [flash, setFlash] = useState(null);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value && value !== "—") {
      const dir = parseFloat(value) > parseFloat(prevRef.current) ? "up" : "down";
      setFlash(dir);
      setTimeout(() => setFlash(null), 700);
      prevRef.current = value;
    }
  }, [value]);
  return (
    <span className="font-semibold text-sm transition-colors" style={{ color: flash === "up" ? "#10b981" : flash === "down" ? "#ef4444" : undefined }}>
      {value !== "—" ? `$${value}` : "—"}
    </span>
  );
}

// ==================== WATCHLIST CARD ====================
function WatchlistCard({ item, stock, quote, sparklineData, onRemove, onStarToggle, index }) {
  const hasStock = !!stock;
  const companyName = getCompanyName(item.ticker, stock, item);
  const [dragX, setDragX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);

  const REVEAL_WIDTH = 160;
  const displayPrice = quote?.c ? quote.c.toFixed(2) : (stock?.current_price?.toFixed(2) || "—");
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
    if (dx < 0) {
      const raw = swiped ? -REVEAL_WIDTH + dx : dx;
      setDragX(Math.max(raw, -REVEAL_WIDTH - 20));
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

  const closeSwipe = () => { setDragX(0); setSwiped(false); };

  const handleShare = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: item.ticker, text: `Check out ${companyName} (${item.ticker}) — $${displayPrice}` }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${item.ticker} — $${displayPrice}`);
    }
    closeSwipe();
  };

  const handleDelete = async (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragX(-400);
    setTimeout(() => onRemove(item.id), 260);
  };

  const cardStyle = {
    transform: `translateX(${dragX}px)`,
    transition: isDragging.current ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
  };

  const inner = (
    <div className="border border-gray-100 rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm h-[76px]" style={{ ...cardStyle, backgroundColor: "hsl(var(--card))" }}>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); onStarToggle(item, stock); }} className="p-1 min-h-[44px] min-w-[36px]">
        <Star className={`w-5 h-5 ${hasStock ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
      </button>

      <div className="min-w-0 flex-[2]">
        <p className="font-heading font-bold text-base">{item.ticker}</p>
        <p className="text-xs text-gray-500">{companyName}</p>
        {item.exchange && <p className="text-[10px] text-gray-400 uppercase tracking-wide">{abbreviateExchange(item.exchange)}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <RealSparkline data={sparklineData} isPositive={dailyIsPositive} />
        <div className="text-center min-w-[64px]">
          <p><AnimatedPrice value={displayPrice} /></p>
          {dailyGainPct !== null ? (
            <div className={`inline-flex items-center gap-0.5 text-sm font-semibold px-1.5 py-0.5 rounded-md ${dailyIsPositive ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
              {dailyIsPositive ? "+" : ""}{dailyGainPct.toFixed(2)}%
            </div>
          ) : <p className="text-xs text-gray-400">—</p>}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div className="relative overflow-hidden rounded-2xl" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -80 }} layout>
      <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-3" style={{ pointerEvents: revealRatio > 0.5 ? "auto" : "none" }}>
        <button onClick={handleShare} className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-black text-white text-[10px] font-semibold shadow-lg">Share</button>
        <button onClick={handleDelete} className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-lg">Delete</button>
      </div>

      <Link to={`/stock/${item.ticker}`} onClick={swiped ? (e) => { e.preventDefault(); closeSwipe(); } : undefined}>
        {inner}
      </Link>
    </motion.div>
  );
}

// ==================== MAIN WATCHLIST ====================
export default function Watchlist() {
  const { user } = useAuth();
  const { quotes: globalQuotes, refreshQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialogItem, setDialogItem] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Load real 1-month sparklines
  const loadSparklines = async (tickers) => {
    const newData = {};
    const oneMonthAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

    await Promise.all(tickers.map(async (t) => {
      try {
        const res = await callFinnhub({ action: "candles_range", ticker: t, resolution: "D", from: oneMonthAgo });
        if (res?.candles?.length > 1) {
          newData[t] = res.candles.map(c => ({ close: c.v ?? c.c }));
        }
      } catch {}
    }));
    setSparklines(prev => ({ ...prev, ...newData }));
  };

  const load = async () => {
    if (!user?.id) return [];
    const [{ data: watchData = [] }, { data: stockData = [] }] = await Promise.all([
      supabase.from("watchlist_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("stocks").select("*").eq("user_id", user.id),
    ]);
    setItems(watchData);
    setStocks(stockData);

    if (watchData.length > 0) {
      const tickers = watchData.map(i => i.ticker.toUpperCase());
      loadSparklines(tickers);
    }
    return watchData;
  };

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('watchlist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist_items', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  // Search
  useEffect(() => {
    const q = ticker.trim();
    if (!q) { setSuggestions([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await callFinnhub({ action: "search", q });
        setSuggestions(res.result || []);
      } catch { setSuggestions([]); }
      setSearchLoading(false);
    }, 280);
  }, [ticker]);

  useEffect(() => {
    if (user?.id) load().then(() => setLoading(false));
  }, [user?.id]);

  const addTicker = async (symbol) => {
    const upper = symbol.trim().toUpperCase();
    if (items.some(i => i.ticker.toUpperCase() === upper)) return setToast("Already in watchlist");

    setAdding(true);
    let company_name = "", exchange = "";
    try {
      const profile = await callFinnhub({ action: "company-profile", symbol: upper });
      company_name = profile?.name || "";
      exchange = profile?.exchange || "";
    } catch {}

    await supabase.from("watchlist_items").insert({ user_id: user.id, ticker: upper, company_name, exchange });
    setTicker("");
    await load();
    setAdding(false);
  };

  const handleRemove = async (id) => {
    const prev = items;
    setItems(prev.filter(i => i.id !== id));
    const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
    if (error) setItems(prev);
  };

  const handleStarToggle = (item, stock) => {
    if (stock) {
      supabase.from("stocks").delete().eq("id", stock.id).then(() => load());
    } else {
      setDialogItem({ ticker: item.ticker, companyName: getCompanyName(item.ticker, null, item) });
    }
  };

  const handlePortfolioAdded = () => {
    setDialogItem(null);
    load();
    setToast("Added to portfolio");
  };

  const findStock = (t) => stocks.find(s => s.ticker.toUpperCase() === t.toUpperCase());

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      <AnimatePresence>{toast && <Toast message={toast} onDone={() => setToast(null)} />}</AnimatePresence>

      {dialogItem && (
        <AddToPortfolioDialog
          open={true}
          onOpenChange={() => setDialogItem(null)}
          ticker={dialogItem.ticker}
          companyName={dialogItem.companyName}
          onAdded={handlePortfolioAdded}
          userId={user?.id}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 z-10" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2">
              <Star className="w-7 h-7 text-amber-400 fill-amber-400" />
              <div>
                <h1 className="font-heading text-2xl font-bold">Watchlist</h1>
                <p className="text-xs text-gray-500">Stocks you're watching</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 py-6 space-y-4 flex-1">
        {/* Add Form */}
        <form onSubmit={(e) => { e.preventDefault(); if (ticker.trim()) addTicker(ticker); }} className="flex gap-2 relative justify-center">
          <div className="flex-[0_1_76%] relative">
            <Input
              ref={inputRef}
              placeholder="Enter Ticker"
              value={ticker}
              onChange={e => { setTicker(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="uppercase w-full"
            />
            {showSuggestions && (searchLoading || suggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {searchLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…</div>
                ) : suggestions.map(s => (
                  <button key={s.ticker} type="button" onClick={() => { setTicker(s.ticker); setShowSuggestions(false); addTicker(s.ticker); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0">
                    <p className="font-semibold text-sm">{s.ticker}</p>
                    <p className="text-xs text-gray-500">{s.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" disabled={adding || !ticker.trim()}>{adding ? <Loader2 className="animate-spin" /> : <Plus />}</Button>
        </form>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <Star className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold">Nothing here yet</h2>
            <p className="text-gray-500 text-sm">Add a ticker above to start watching it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <WatchlistCard
                key={item.id}
                item={item}
                stock={findStock(item.ticker)}
                quote={globalQuotes[item.ticker.toUpperCase()] || quotes[item.ticker.toUpperCase()]}
                sparklineData={sparklines[item.ticker.toUpperCase()]}
                onRemove={handleRemove}
                onStarToggle={handleStarToggle}
                index={index}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
