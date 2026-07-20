import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
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

  // US
  if (e.includes("NASDAQ")) return "NASDAQ";
  if (e.includes("NYSE AMERICAN") || e.includes("AMEX")) return "AMEX";
  if (e.includes("NEW YORK STOCK EXCHANGE") || e.includes("NYSE")) return "NYSE";
  if (e.includes("OTC") || e.includes("PINK")) return "OTC";
  if (e.includes("CBOE")) return "CBOE";
  if (e.includes("BATS")) return "BATS";

  // Canada
  if (e.includes("TSX VENTURE") || e.includes("TSXV")) return "TSXV";
  if (e.includes("TSX") || e.includes("TORONTO")) return "TSX";
  if (e.includes("CSE") || e.includes("CANADIAN SECURITIES")) return "CSE";
  if (e.includes("NEO")) return "NEO";

  // UK & Europe
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

  // Australia & New Zealand
  if (e.includes("ASX") || e.includes("AUSTRALIAN")) return "ASX";
  if (e.includes("NZX") || e.includes("NEW ZEALAND")) return "NZX";
  if (e.includes("CHI-X AUSTRALIA")) return "CXA";

  // Japan
  if (e.includes("TOKYO") || e.includes("TSE") || e.includes("JPX")) return "TSE";
  if (e.includes("OSAKA") || e.includes("OSE")) return "OSE";
  if (e.includes("NAGOYA") || e.includes("NSE")) return "NSE-JP";
  if (e.includes("FUKUOKA")) return "FKE";
  if (e.includes("SAPPORO")) return "SPE";

  // China
  if (e.includes("SHANGHAI") || e.includes("SSE") || e.includes("SHSE")) return "SSE";
  if (e.includes("SHENZHEN") || e.includes("SZSE")) return "SZSE";
  if (e.includes("HONG KONG") || e.includes("HKEX") || e.includes("HKG")) return "HKEX";

  // India
  if (e.includes("NSE") || e.includes("NATIONAL STOCK EXCHANGE")) return "NSE";
  if (e.includes("BSE") || e.includes("BOMBAY")) return "BSE";

  // South Korea
  if (e.includes("KRX") || e.includes("KOREA EXCHANGE")) return "KRX";
  if (e.includes("KOSDAQ")) return "KOSDAQ";
  if (e.includes("KOSPI")) return "KOSPI";

  // Taiwan
  if (e.includes("TWSE") || e.includes("TAIWAN")) return "TWSE";
  if (e.includes("TPEX")) return "TPEX";

  // Singapore & SE Asia
  if (e.includes("SGX") || e.includes("SINGAPORE")) return "SGX";
  if (e.includes("BURSA") || e.includes("MALAYSIA") || e.includes("KLSE")) return "KLSE";
  if (e.includes("SET") || e.includes("THAILAND")) return "SET";
  if (e.includes("IDX") || e.includes("INDONESIA")) return "IDX";
  if (e.includes("PSE") || e.includes("PHILIPPINES")) return "PSE";
  if (e.includes("HOSE") || e.includes("VIETNAM")) return "HOSE";

  // Middle East & Africa
  if (e.includes("TADAWUL") || e.includes("SAUDI")) return "TADAWUL";
  if (e.includes("DFM") || e.includes("DUBAI")) return "DFM";
  if (e.includes("ADX") || e.includes("ABU DHABI")) return "ADX";
  if (e.includes("TASE") || e.includes("TEL AVIV")) return "TASE";
  if (e.includes("JSE") || e.includes("JOHANNESBURG")) return "JSE";
  if (e.includes("EGX") || e.includes("EGYPT")) return "EGX";

  // Latin America
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

function AddToPortfolioDialog({ open, onOpenChange, ticker, companyName, onAdded }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let currentPrice = parseFloat(purchasePrice);
    try {
      const res = await base44.functions.invoke("finnhub", { action: "quote", ticker });
      if (res.data?.c) currentPrice = res.data.c;
    } catch {}
    await base44.entities.Stock.create({
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price: currentPrice,
      sector: ""
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add to Portfolio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MiniSparkline({ isPositive }) {
  const color = isPositive ? "#10b981" : "#ef4444";
  // Simple illustrative trend line: down-then-up for positive, up-then-down for negative
  const points = isPositive
    ? "2,28 8,22 14,26 20,18 26,20 32,12 38,8"
    : "2,8 8,12 14,10 20,18 26,16 32,22 38,28";
  return (
    <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    <span
      className="font-semibold text-sm transition-colors duration-500"
      style={{ color: flash === "up" ? "#10b981" : flash === "down" ? "#ef4444" : undefined }}
    >
      {value !== "—" ? `$${value}` : "—"}
    </span>
  );
}

function WatchlistCard({ item, stock, quote, onRemove, onStarToggle, index }) {
  const hasStock = !!stock;
  const companyName = getCompanyName(item.ticker, stock, item);
  const [dragX, setDragX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const cardRef = useRef(null);

  const REVEAL_WIDTH = 160; // px — two round buttons + gap + padding

  const displayPrice = quote?.c ? quote.c.toFixed(2) : (stock?.current_price?.toFixed(2) || "—");
  const dailyGainPct = quote?.dp ?? null;
  const dailyIsPositive = (dailyGainPct ?? 0) >= 0;

  // How far swiped as 0→1 ratio
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
      // Rubber-band past full reveal
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
    setIsDeleting(true);
    setDragX(-400);
    await new Promise(r => setTimeout(r, 260));
    onRemove(item.id);
  };



  const cardStyle = {
    transform: `translateX(${dragX}px)`,
    transition: isDragging.current ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
  };

  const inner = (
    <div
      className="border border-gray-100 rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 transition-all duration-200 h-[76px]"
      style={{ ...cardStyle, backgroundColor: "hsl(var(--card))" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Star toggle */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); onStarToggle(item, stock); }}
        className="p-1 min-h-[44px] min-w-[36px] flex items-center justify-center shrink-0"
      >
        <Star className={`w-5 h-5 transition-colors ${hasStock ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
      </button>

      {/* Ticker + company */}
      <div className="min-w-0 flex-[2]">
        <p className="font-heading font-bold text-base leading-tight">{item.ticker}</p>
        <p className="text-xs text-gray-500">{companyName}</p>
        {item.exchange && <p className="text-[10px] text-gray-400 uppercase tracking-wide">{abbreviateExchange(item.exchange)}</p>}
      </div>

      {/* Sparkline + Price + gain */}
      <div className="flex items-center gap-2 shrink-0">
        {quote?.c && <MiniSparkline isPositive={dailyIsPositive} />}
        <div className="text-center min-w-[64px]">
          <p><AnimatedPrice value={displayPrice} /></p>
          {dailyGainPct !== null ? (
            <div className={`inline-flex items-center gap-0.5 text-sm font-semibold px-1.5 py-0.5 rounded-md ${dailyIsPositive ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
              {dailyIsPositive ? "+" : ""}{dailyGainPct.toFixed(2)}%
            </div>
          ) : (
            <p className="text-xs text-gray-400">—</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      ref={cardRef}
      className="relative overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -80, scale: 0.94 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
      layout
    >
      {/* Revealed action buttons — round floating buttons */}
      <div
        className="absolute inset-y-0 right-0 flex items-center gap-3 pr-3"
        style={{ pointerEvents: revealRatio > 0.5 ? "auto" : "none" }}
      >
        {/* Share button — appears after ~50% swipe */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-black text-white text-[10px] font-semibold shadow-lg active:scale-95 transition-transform"
          style={{
            opacity: Math.min(Math.max((revealRatio - 0.5) / 0.5, 0), 1),
            transform: `scale(${Math.min(Math.max((revealRatio - 0.5) / 0.5, 0), 1)})`,
            transition: isDragging.current ? "none" : "opacity 0.28s ease, transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
          }}
        >
          <Share2 className="w-5 h-5 shrink-0" />
          <span>Share</span>
        </button>

        {/* Delete button — appears from the start of swipe */}
        <button
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-lg active:scale-95 transition-transform"
          style={{
            opacity: Math.min(revealRatio / 0.5, 1),
            transform: `scale(${Math.min(revealRatio / 0.5, 1)})`,
            transition: isDragging.current ? "none" : "opacity 0.28s ease, transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)",
          }}
        >
          <Trash2 className="w-5 h-5 shrink-0" />
          <span>Delete</span>
        </button>
      </div>

      {/* Card face */}
      <Link
        to={hasStock ? `/stock/${stock.id}` : `/stock/ticker-${item.ticker}`}
        onClick={swiped ? (e) => { e.preventDefault(); closeSwipe(); } : undefined}
      >
        {inner}
      </Link>
    </motion.div>
  );
}

export default function Watchlist() {
  const { user } = useAuth();
  const { quotes: globalQuotes, refreshQuotes } = useMarketData();
  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [quotes, setQuotes] = useState(globalQuotes); // { TICKER: { c, dp, d, pc } }
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialogItem, setDialogItem] = useState(null); // { ticker, companyName }

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
    if (!q) { setSuggestions([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await base44.functions.invoke("finnhub", { action: "search", query: q });
        setSuggestions(res.data?.results || []);
      } catch { setSuggestions([]); }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [ticker]);

  const load = async () => {
    if (!user?.id) return [];
    const [watchData, stockData] = await Promise.all([
      base44.entities.WatchlistItem.filter({ created_by_id: user.id }, "-created_date"),
      base44.entities.Stock.filter({ created_by_id: user.id }),
    ]);
    setItems(watchData);
    setStocks(stockData);

    // Seed quotes from server-cached values so prices show instantly
    const seedQuotes = {};
    [...watchData, ...stockData].forEach(item => {
      const t = item.ticker.toUpperCase();
      if (item.cached_price && !seedQuotes[t]) {
        seedQuotes[t] = { c: item.cached_price, dp: item.cached_change_pct, d: item.cached_change };
      }
    });
    if (Object.keys(seedQuotes).length > 0) {
      setQuotes(prev => ({ ...seedQuotes, ...prev }));
    }

    // Backfill exchange/company_name for items that don't have it yet
    const missing = watchData.filter(i => !i.exchange || !i.company_name);
    if (missing.length > 0) {
      await Promise.all(missing.map(async (item) => {
        try {
          const res = await base44.functions.invoke("finnhub", { action: "profile", ticker: item.ticker });
          const updates = {};
          if (res.data?.exchange) updates.exchange = res.data.exchange;
          if (res.data?.name) updates.company_name = res.data.name;
          if (Object.keys(updates).length) await base44.entities.WatchlistItem.update(item.id, updates);
        } catch {}
      }));
      // Reload to reflect the updated exchange values
      const updated = await base44.entities.WatchlistItem.filter({ created_by_id: user.id }, "-created_date");
      setItems(updated);
      return updated;
    }

    return watchData;
  };

  // Sync global pre-fetched quotes into local state
  useEffect(() => {
    if (Object.keys(globalQuotes).length > 0) {
      setQuotes(prev => ({ ...prev, ...globalQuotes }));
    }
  }, [globalQuotes]);

  useEffect(() => {
    if (user?.id) {
      load().then(watchData => {
        setLoading(false);
        // Trigger a refresh in the background via context (uses cache if recent)
        if (watchData?.length) refreshQuotes(watchData.map(i => i.ticker.toUpperCase()));
      });
    }
  }, [user?.id]);

  // Re-sync stocks when portfolio changes from anywhere (e.g. adding from Home)
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = base44.entities.Stock.subscribe(() => {
      base44.entities.Stock.filter({ created_by_id: user.id }).then(setStocks).catch(() => {});
    });
    return unsubscribe;
  }, [user?.id]);

  // Re-sync watchlist items when a new one is added from elsewhere (e.g. AddStockDialog)
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = base44.entities.WatchlistItem.subscribe(() => {
      base44.entities.WatchlistItem.filter({ created_by_id: user.id }, "-created_date")
        .then(watchData => {
          setItems(watchData);
        })
        .catch(() => {});
    });
    return unsubscribe;
  }, [user?.id]);

  const addTicker = async (symbol, exchange = "") => {
    symbol = symbol.trim().toUpperCase();
    if (!symbol) return;
    if (items.find(i => i.ticker.toUpperCase() === symbol.toUpperCase())) {
      setToast(`"${symbol}" is already in your watchlist.`);
      return;
    }
    setAdding(true);
    setShowSuggestions(false);
    // Fetch company name from profile
    let company_name = "";
    try {
      const profileRes = await base44.functions.invoke("finnhub", { action: "profile", ticker: symbol });
      company_name = profileRes.data?.name || "";
      if (!exchange && profileRes.data?.exchange) exchange = profileRes.data.exchange;
    } catch {}
    await base44.entities.WatchlistItem.create({ ticker: symbol, exchange, company_name });
    setTicker("");
    const watchData = await load();
    setAdding(false);
    if (watchData?.length) refreshQuotes(watchData.map(i => i.ticker.toUpperCase()));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    addTicker(ticker, "");
  };

  const handleRemove = async (id) => {
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await base44.entities.WatchlistItem.delete(id);
    } catch {
      setItems(previous);
      setToast("Failed to remove — please try again.");
    }
  };

  const handleStarToggle = async (item, stock) => {
    if (stock) {
      const previous = stocks;
      setStocks(prev => prev.filter(s => s.id !== stock.id));
      try {
        await base44.entities.Stock.delete(stock.id);
        setToast(`${item.ticker} removed from portfolio`);
      } catch {
        setStocks(previous);
        setToast("Failed to update — please try again.");
      }
    } else {
      const companyName = getCompanyName(item.ticker, null);
      setDialogItem({ ticker: item.ticker, companyName });
    }
  };

  const handlePortfolioAdded = async () => {
    const ticker = dialogItem.ticker;
    setDialogItem(null);
    await load();
    setToast(`${ticker} added to portfolio`);
  };

  const findStock = (ticker) => stocks.find(s => s.ticker.toUpperCase() === ticker.toUpperCase());

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)", backgroundColor: "hsl(var(--background))" }}
    >
      <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}</AnimatePresence>

      {dialogItem && (
        <AddToPortfolioDialog
          open={true}
          onOpenChange={() => setDialogItem(null)}
          ticker={dialogItem.ticker}
          companyName={dialogItem.companyName}
          onAdded={handlePortfolioAdded}
        />
      )}


      <header
        className="border-b border-gray-100 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "hsl(var(--background))" }}
      >
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
        <form onSubmit={handleAdd} className="flex gap-2 relative justify-center">
          <div className="flex-[0_1_76%] relative">
            <Input
              ref={inputRef}
              placeholder="Enter Ticker or Company Name"
              value={ticker}
              onChange={e => { setTicker(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="uppercase placeholder:normal-case w-full"
              autoComplete="off"
            />
            {showSuggestions && (searchLoading || suggestions.length > 0) && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                {searchLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                  </div>
                ) : suggestions.map(s => {
                  const alreadyAdded = !!items.find(i => i.ticker.toUpperCase() === s.ticker.toUpperCase());
                  const inPortfolio = !!stocks.find(st => st.ticker.toUpperCase() === s.ticker.toUpperCase());
                  return (
                    <button
                      key={s.ticker}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => { setTicker(s.ticker); setShowSuggestions(false); addTicker(s.ticker, s.exchange); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}
                    >
                      <div>
                        <p className="font-semibold text-sm">{s.ticker}</p>
                        <p className="text-xs text-gray-500">{s.name}</p>
                        {s.exchange && <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.exchange}</p>}
                      </div>
                      {alreadyAdded && <span className="text-[10px] text-gray-400 font-medium">Added</span>}
                      {!alreadyAdded && inPortfolio && <span className="text-[10px] text-emerald-600 font-medium">In portfolio</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button type="submit" disabled={adding || !ticker.trim()} className="min-w-[44px]">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="font-heading text-lg font-semibold mb-1 text-gray-900">Nothing here yet</h2>
              <p className="text-gray-500 text-sm">Add a ticker above to start watching it.</p>
          </div>
        ) : (
          <motion.div className="space-y-3" layout>
            <AnimatePresence initial={false}>
              {[...items].sort((a, b) => {
                const qa = quotes[a.ticker.toUpperCase()]?.dp ?? 0;
                const qb = quotes[b.ticker.toUpperCase()]?.dp ?? 0;
                return qb - qa;
              }).map((item, index) => (
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
