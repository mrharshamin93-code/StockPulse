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

// ==================== CACHE FOR SPARKLINE DATA ====================
const sparklineCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ==================== HELPER FUNCTIONS ====================
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
  if (e.includes("CSE")) return "CSE";
  if (e.includes("NEO")) return "NEO";
  if (e.includes("LONDON") || e.includes("LSE")) return "LSE";
  if (e.includes("EURONEXT")) return "ENX";
  if (e.includes("XETRA") || e.includes("FRANKFURT")) return "FRA";
  if (e.includes("ASX")) return "ASX";
  if (e.includes("TOKYO") || e.includes("TSE")) return "TSE";
  if (e.includes("SHANGHAI")) return "SSE";
  if (e.includes("SHENZHEN")) return "SZSE";
  if (e.includes("HONG KONG")) return "HKEX";
  if (e.includes("NSE")) return "NSE";
  if (e.includes("BSE")) return "BSE";
  if (e.includes("KRX")) return "KRX";
  if (e.includes("SGX")) return "SGX";
  if (e.includes("TADAWUL")) return "TADAWUL";
  if (e.includes("JSE")) return "JSE";
  if (e.includes("B3")) return "B3";
  return exchange;
}

function getCompanyName(ticker, stock, item) {
  if (stock?.company_name && stock.company_name !== ticker) return stock.company_name;
  if (item?.company_name && item.company_name !== ticker) return item.company_name;
  if (stock?.company_name) return stock.company_name;
  if (item?.company_name) return item.company_name;
  return ticker;
}

// ==================== TOAST ====================
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);
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

// ==================== ADD TO PORTFOLIO DIALOG ====================
function AddToPortfolioDialog({ open, onOpenChange, ticker, companyName, onAdded }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let currentPrice = parseFloat(purchasePrice);
    try {
      const res = await fetch("/api/finnhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote", ticker }),
      });
      const data = await res.json();
      if (data?.c) currentPrice = data.c;
    } catch {}
    const { error } = await supabase.from("stocks").insert({
      user_id: user.id,
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price: currentPrice,
      sector: "",
    });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add to Portfolio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SPARKLINE FUNCTIONS ====================
async function fetchSparklineData(ticker) {
  const cacheKey = ticker.toUpperCase();
  const cached = sparklineCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const res = await fetch("/api/finnhub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "candles_range",
        ticker,
        resolution: "D",
        from: thirtyDaysAgo,
        to: now,
      }),
    });
    const json = await res.json();
    if (json?.candles && Array.isArray(json.candles) && json.candles.length >= 2) {
      const closePrices = json.candles.map(c => c.v);
      sparklineCache.set(cacheKey, { data: closePrices, timestamp: Date.now() });
      return closePrices;
    }
    return null;
  } catch (error) {
    console.error(`Sparkline fetch error for ${ticker}:`, error);
    return null;
  }
}

function MiniSparkline({ data, isPositive }) {
  // Real data
  if (data && data.length >= 2) {
    const width = 40;
    const height = 36;
    const padding = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((price, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = padding + ((max - price) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(" ");
    const color = isPositive ? "#10b981" : "#ef4444";
    return (
      <svg width="40" height="36" viewBox={`0 0 ${width} ${height}`} fill="none">
        <polyline points={points} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Static fallback
  const color = isPositive ? "#10b981" : "#ef4444";
  const points = isPositive
    ? "2,28 8,22 14,26 20,18 26,20 32,12 38,8"
    : "2,8 8,12 14,10 20,18 26,16 32,22 38,28";
  return (
    <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklineWrapper({ ticker, isPositive }) {
  const [sparklineData, setSparklineData] = useState(null);
  useEffect(() => {
    let mounted = true;
    fetchSparklineData(ticker).then(data => {
      if (mounted) setSparklineData(data);
    });
    return () => { mounted = false; };
  }, [ticker]);
  return <MiniSparkline data={sparklineData} isPositive={isPositive} />;
}

// ==================== ANIMATED PRICE ====================
function AnimatedPrice({ value }) {
  const [flash, setFlash] = useState(null);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value && value !== "—") {
      const dir = parseFloat(value) > parseFloat(prevRef.current) ? "up" : "down";
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 700);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);
  return (
    <span className="font-semibold text-sm transition-colors duration-500"
      style={{ color: flash === "up" ? "#10b981" : flash === "down" ? "#ef4444" : undefined }}>
      {value !== "—" ? `$${value}` : "—"}
    </span>
  );
}

// ==================== WATCHLIST CARD ====================
function WatchlistCard({ item, stock, quote, onRemove, onStarToggle, index }) {
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
    e.stopPropagation();
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
      navigator.share({ title: item.ticker, text: `${companyName} (${item.ticker})` }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(item.ticker);
    }
    closeSwipe();
  };
  const handleDelete = async (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragX(-400);
    await new Promise(r => setTimeout(r, 260));
    onRemove(item.id);
  };

  const cardStyle = {
    transform: `translateX(${dragX}px)`,
    transition: isDragging.current ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
  };

  const inner = (
    <div className="border border-gray-100 rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 transition-all duration-200 h-[76px]"
      style={{ ...cardStyle, backgroundColor: "hsl(var(--card))" }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); onStarToggle(item, stock); }}
        className="p-1 min-h-[44px] min-w-[36px] flex items-center justify-center shrink-0">
        <Star className={`w-5 h-5 transition-colors ${hasStock ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
      </button>
      <div className="min-w-0 flex-[2]">
        <p className="font-heading font-bold text-base leading-tight">{item.ticker}</p>
        <p className="text-xs text-gray-500">{companyName}</p>
        {item.exchange && <p className="text-[10px] text-gray-400 uppercase tracking-wide">{abbreviateExchange(item.exchange)}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {quote?.c && <SparklineWrapper ticker={item.ticker} isPositive={dailyIsPositive} />}
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
    <motion.div className="relative overflow-hidden rounded-2xl" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -80, scale: 0.94 }} transition={{ duration: 0.28, delay: index * 0.04 }} layout>
      <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-3" style={{ pointerEvents: revealRatio > 0.5 ? "auto" : "none" }}>
        <button onClick={handleShare} className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-black text-white text-[10px] font-semibold shadow-lg active:scale-95">
          <Share2 className="w-5 h-5 shrink-0" /><span>Share</span>
        </button>
        <button onClick={handleDelete} className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-lg active:scale-95">
          <Trash2 className="w-5 h-5 shrink-0" /><span>Delete</span>
        </button>
      </div>
      {/* SAFE LINK: avoids /stock/undefined */}
      <Link
        to={
          hasStock && stock.id
            ? `/stock/${stock.id}`
            : `/stock/ticker-${item.ticker}`
        }
        onClick={swiped ? (e) => { e.preventDefault(); closeSwipe(); } : undefined}
      >
        {inner}
      </Link>
    </motion.div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function Watchlist() {
  const { user } = useAuth();
  const { quotes: globalQuotes, refreshQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [quotes, setQuotes] = useState(globalQuotes);
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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.contains(e.target) && !suggestionsRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search suggestions
  useEffect(() => {
    const q = ticker.trim();
    if (!q) { setSuggestions([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch("/api/finnhub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search", query: q }),
        });
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch { setSuggestions([]); }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [ticker]);

  // Load data from Supabase
  const load = async () => {
    if (!user?.id) return [];
    const [watchRes, stockRes] = await Promise.all([
      supabase.from("watchlist_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("stocks").select("*").eq("user_id", user.id),
    ]);
    const watchData = watchRes.data || [];
    const stockData = stockRes.data || [];
    setItems(watchData);
    setStocks(stockData);
    return watchData;
  };

  useEffect(() => {
    if (Object.keys(globalQuotes).length > 0) {
      setQuotes(prev => ({ ...prev, ...globalQuotes }));
    }
  }, [globalQuotes]);

  useEffect(() => {
    if (user?.id) {
      load().then(watchData => {
        setLoading(false);
        if (watchData?.length) refreshQuotes(watchData.map(i => i.ticker.toUpperCase()));
      });
    }
  }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("watchlist-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "watchlist_items",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase.from("watchlist_items").select("*").eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => setItems(data || []));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const addTicker = async (symbol, exchange = "") => {
    symbol = symbol.trim().toUpperCase();
    if (!symbol || !user) return;
    if (items.find(i => i.ticker.toUpperCase() === symbol)) {
      setToast(`"${symbol}" is already in your watchlist.`);
      return;
    }
    setAdding(true);
    setShowSuggestions(false);
    let company_name = "";
    try {
      const res = await fetch("/api/finnhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", ticker: symbol }),
      });
      const data = await res.json();
      company_name = data.name || "";
      if (!exchange && data.exchange) exchange = data.exchange;
    } catch {}
    const { error } = await supabase.from("watchlist_items").insert({
      user_id: user.id,
      ticker: symbol,
      exchange,
      company_name,
    });
    setTicker("");
    setAdding(false);
    if (error) {
      setToast("Failed to add ticker");
      return;
    }
    const watchData = await load();
    if (watchData?.length) refreshQuotes(watchData.map(i => i.ticker.toUpperCase()));
  };

  const handleAdd = (e) => { e.preventDefault(); addTicker(ticker); };

  const handleRemove = async (id) => {
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
    if (error) setItems(previous);
  };

  const handleStarToggle = async (item, stock) => {
    if (stock) {
      setStocks(prev => prev.filter(s => s.id !== stock.id));
      await supabase.from("stocks").delete().eq("id", stock.id);
    } else {
      setDialogItem({ ticker: item.ticker, companyName: getCompanyName(item.ticker, null, item) });
    }
  };

  const handlePortfolioAdded = async () => {
    setDialogItem(null);
    await load();
  };

  const findStock = (t) => stocks.find(s => s.ticker.toUpperCase() === t.toUpperCase());

  // Sort items by highest daily gainer first
  const sortedItems = [...items].sort((a, b) => {
    const aGain = quotes[a.ticker.toUpperCase()]?.dp ?? -Infinity;
    const bGain = quotes[b.ticker.toUpperCase()]?.dp ?? -Infinity;
    return bGain - aGain;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}>
      <AnimatePresence>{toast && <Toast message={toast} onDone={() => setToast(null)} />}</AnimatePresence>
      {dialogItem && (
        <AddToPortfolioDialog
          open={true}
          onOpenChange={() => setDialogItem(null)}
          ticker={dialogItem.ticker}
          companyName={dialogItem.companyName}
          onAdded={handlePortfolioAdded}
        />
      )}

      <header className="border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2">
              <Star className="w-7 h-7 text-amber-400 fill-amber-400" />
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight leading-none">Watchlist</h1>
                <p className="text-xs text-gray-500 mt-0.5">Stocks you're watching</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4 flex-1">
        {/* Search form with dropdown */}
        <form onSubmit={handleAdd} className="flex gap-2 relative justify-center">
          <div className="flex-[0_1_76%] relative">
            <Input
              ref={inputRef}
              placeholder="Enter Ticker or Company Name"
              value={ticker}
              onChange={e => { setTicker(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="uppercase"
            />
            {/* Suggestion dropdown - clicking auto-adds */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  ref={suggestionsRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
                >
                  {searchLoading && <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>}
                  {suggestions.map((s, i) => (
                    <button
                      key={s.symbol + i}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                      onClick={() => {
                        addTicker(s.symbol, s.primaryExchange || s.exchange || "");
                        setTicker(""); // clear input after adding
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="font-medium">{s.symbol}</span>
                      <span className="text-xs text-gray-500 truncate ml-2">{s.description}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Button type="submit" disabled={adding || !ticker.trim()}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">Nothing here yet. Add a ticker above.</div>
        ) : (
          <motion.div className="space-y-3" layout>
            <AnimatePresence>
              {sortedItems.map((item, index) => (
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
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
