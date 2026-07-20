import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { Loader2, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ==================== HELPER FUNCTIONS ====================
function abbreviateExchange(exchange) {
  if (!exchange) return "";
  const e = exchange.toUpperCase();
  if (e.includes("NASDAQ")) return "NASDAQ";
  if (e.includes("NYSE")) return "NYSE";
  if (e.includes("TSX")) return "TSX";
  if (e.includes("LSE")) return "LSE";
  if (e.includes("ASX")) return "ASX";
  if (e.includes("TSE")) return "TSE";
  if (e.includes("HKEX")) return "HKEX";
  if (e.includes("NSE")) return "NSE";
  if (e.includes("KRX")) return "KRX";
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
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-gray-900 text-white text-sm shadow-lg">
      {message}
    </div>
  );
}

async function callFinnhub(params) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetch(`/api/finnhub?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch Finnhub data");
  return res.json();
}

// ==================== REAL 1-MONTH SPARKLINE ====================
function RealSparkline({ data, isPositive }) {
  if (!data || data.length < 2) return null;

  const prices = data.map((d) => Number(d.close)).filter(n => !isNaN(n));
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

  const color = isPositive ? "#10b981" : "#ef4444";

  return (
    <svg width="58" height="26" viewBox="0 0 100 100" className="shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="7"
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
    <span className={`text-lg font-semibold tabular-nums transition-colors ${
      flash === "up" ? "text-emerald-600" : flash === "down" ? "text-red-600" : "text-gray-900"
    }`}>
      {value !== "—" ? "$" + value : "—"}
    </span>
  );
}

// ==================== WATCHLIST CARD ====================
function WatchlistCard({ item, stock, quote, sparklineData, onStarToggle }) {
  const hasStock = !!stock;
  const companyName = getCompanyName(item.ticker, stock, item);
  const displayPrice = quote?.c ? quote.c.toFixed(2) : stock?.current_price?.toFixed(2) || "—";
  const dailyGainPct = quote?.dp ?? null;
  const dailyIsPositive = (dailyGainPct ?? 0) >= 0;

  return (
    <Link to={`/stock/${item.ticker}`} className="block rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-4 active:scale-[0.99] transition">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStarToggle(item, stock); }}
          className="p-1 min-h-[44px] min-w-[36px] flex items-center justify-center shrink-0"
        >
          <Star className={`h-5 w-5 ${hasStock ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{item.ticker}</div>
          <div className="text-sm text-gray-500 truncate">{companyName}</div>
          {item.exchange && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {abbreviateExchange(item.exchange)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RealSparkline data={sparklineData} isPositive={dailyIsPositive} />
          <div className="text-right">
            <AnimatedPrice value={displayPrice} />
            <div className={`text-sm font-medium ${dailyIsPositive ? "text-emerald-600" : "text-red-600"}`}>
              {dailyGainPct !== null ? `${dailyIsPositive ? "+" : ""}${dailyGainPct.toFixed(2)}%` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ==================== MAIN COMPONENT ====================
export default function Watchlist() {
  const { user } = useAuth();
  const { quotes, fetchQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialogItem, setDialogItem] = useState(null);

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // ==================== DEBUG VERSION OF SPARKLINE ====================
  const loadSparklines = async (tickers) => {
    const newData = {};

    await Promise.all(
      tickers.map(async (t) => {
        try {
          const res = await callFinnhub({
            action: "candles_range",
            ticker: t,
            resolution: "D",
            from: Math.floor(Date.now() / 1000) - 32 * 86400,
            to: Math.floor(Date.now() / 1000),
          });

          // ← TEMPORARY DEBUG LOG - Please copy this from console
          console.log(`Sparkline response for ${t}:`, res);

          if (res?.candles && Array.isArray(res.candles) && res.candles.length > 1) {
            // Try both c.v and c.c just in case
            newData[t] = res.candles.map((c) => ({ 
              close: c.v ?? c.c 
            }));
          }
        } catch (err) {
          console.error("Sparkline error for", t, err);
        }
      })
    );

    setSparklines((prev) => ({ ...prev, ...newData }));
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
      const tickers = [...new Set(watchData.map((i) => i.ticker.toUpperCase()))];
      fetchQuotes(tickers);
      loadSparklines(tickers);
    }
    return watchData;
  };

  useEffect(() => {
    if (!user?.id) return;
    load().then(() => setLoading(false));
  }, [user?.id]);

  // ... (rest of the functions are the same as before)

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().trim();
    setTicker(value);
    setShowSuggestions(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await callFinnhub({ action: "search", q: value });
        setSuggestions(res.result?.slice(0, 8) || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
  };

  const handleSelectSuggestion = (sugg) => {
    setTicker(sugg.symbol);
    setShowSuggestions(false);
    setSuggestions([]);
    handleAdd(sugg.symbol);
  };

  const handleAdd = async (newTicker) => {
    if (!user?.id || !newTicker) return;
    const upperTicker = newTicker.toUpperCase().trim();

    if (items.some((i) => i.ticker.toUpperCase() === upperTicker)) {
      setToast("Already in your watchlist");
      setTicker("");
      return;
    }

    setAdding(true);

    try {
      let companyName = upperTicker;
      let exchange = "";

      try {
        const profile = await callFinnhub({ action: "company-profile", symbol: upperTicker });
        if (profile?.name) companyName = profile.name;
        if (profile?.exchange) exchange = profile.exchange;
      } catch {}

      const { data, error } = await supabase
        .from("watchlist_items")
        .insert({
          user_id: user.id,
          ticker: upperTicker,
          company_name: companyName,
          exchange,
        })
        .select()
        .single();

      if (error) throw error;

      setItems((prev) => [data, ...prev]);
      fetchQuotes([upperTicker]);
      loadSparklines([upperTicker]);

      setToast(`Added ${upperTicker}`);
      setTicker("");
      setShowSuggestions(false);
    } catch (err) {
      setToast("Failed to add ticker");
    } finally {
      setAdding(false);
    }
  };

  const handleStarToggle = (item, stock) => {
    setDialogItem({
      ticker: item.ticker,
      companyName: getCompanyName(item.ticker, stock, item),
    });
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
          onAdded={async () => {
            const { data: newStocks } = await supabase.from("stocks").select("*").eq("user_id", user?.id);
            if (newStocks) setStocks(newStocks);
            setDialogItem(null);
          }}
          userId={user?.id}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Star className="h-7 w-7 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900">Watchlist</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1.5">Stocks you're watching</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (ticker.trim()) handleAdd(ticker); }} className="mb-6">
          <div className="relative">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={ticker}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Add ticker (e.g. AAPL, TSLA)"
                className="flex-1 text-lg"
                disabled={adding}
              />
              <Button type="submit" disabled={adding || !ticker.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>

            <AnimatePresence>
              {showSuggestions && (suggestions.length > 0 || searchLoading) && (
                <motion.div className="absolute z-[60] mt-1.5 w-full rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                  {searchLoading && <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>}
                  {suggestions.map((sugg, index) => (
                    <button key={index} type="button" onClick={() => handleSelectSuggestion(sugg)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between text-sm">
                      <div><span className="font-semibold">{sugg.symbol}</span> <span className="text-gray-500">{sugg.description}</span></div>
                      <span className="text-xs text-gray-400">{sugg.type}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">Nothing here yet</h2>
            <p className="text-sm text-gray-500 mt-2">Add a ticker above to start watching it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <WatchlistCard
                key={item.id}
                item={item}
                stock={findStock(item.ticker)}
                quote={quotes[item.ticker.toUpperCase()]}
                sparklineData={sparklines[item.ticker.toUpperCase()]}
                onStarToggle={handleStarToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
