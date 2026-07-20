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
  if (!res.ok) throw new Error("Failed to fetch Finnhub data");
  return res.json();
}

// Real 1-month sparkline component
function RealSparkline({ data, isPositive }) {
  if (!data || data.length < 2) return null;

  const prices = data.map(d => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.close - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  const color = isPositive ? "#10b981" : "#ef4444";

  return (
    <svg width="60" height="28" viewBox="0 0 100 100" className="shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="8"
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

function WatchlistCard({ item, stock, quote, sparklineData, onRemove, onStarToggle, index }) {
  const hasStock = !!stock;
  const companyName = getCompanyName(item.ticker, stock, item);
  const displayPrice = quote?.c ? quote.c.toFixed(2) : stock?.current_price?.toFixed(2) || "—";
  const dailyGainPct = quote?.dp ?? null;
  const dailyIsPositive = (dailyGainPct ?? 0) >= 0;

  return (
    <Link
      to={`/stock/${item.ticker}`}
      className="block rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-4 active:scale-[0.99] transition"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Star Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStarToggle(item, stock);
          }}
          className="p-1 min-h-[44px] min-w-[36px] flex items-center justify-center shrink-0"
        >
          <Star className={`h-5 w-5 ${hasStock ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>

        {/* Ticker + Name */}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{item.ticker}</div>
          <div className="text-sm text-gray-500 truncate">{companyName}</div>
          {item.exchange && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {abbreviateExchange(item.exchange)}
            </span>
          )}
        </div>

        {/* Sparkline + Price */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Real 1-Month Sparkline on the LEFT of price */}
          <div className="flex items-center">
            <RealSparkline data={sparklineData} isPositive={dailyIsPositive} />
          </div>

          {/* Price */}
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

export default function Watchlist() {
  const { user } = useAuth();
  const { quotes, refreshQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
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
  const suggestionsRef = useRef(null);
  const searchTimeout = useRef(null);

  // ... (keeping all your existing functions like load, addTicker, handleRemove, etc.)

  const loadSparklines = async (tickers) => {
    const newSparklines = {};

    await Promise.all(
      tickers.map(async (t) => {
        try {
          const res = await callFinnhub({
            action: "candles_range",
            ticker: t,
            resolution: "D",
            from: Math.floor(Date.now() / 1000) - 30 * 86400,
            to: Math.floor(Date.now() / 1000),
          });

          if (res?.candles?.length > 1) {
            newSparklines[t] = res.candles.map(c => ({
              close: c.c,
            }));
          }
        } catch (e) {
          console.error("Failed to load sparkline for", t);
        }
      })
    );

    setSparklines(newSparklines);
  };

  const load = async () => {
    if (!user?.id) return [];

    const [{ data: watchData = [] }, { data: stockData = [] }] = await Promise.all([
      supabase.from("watchlist_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("stocks").select("*").eq("user_id", user.id),
    ]);

    setItems(watchData);
    setStocks(stockData);

    // Load real 1-month sparkline data
    if (watchData.length > 0) {
      const tickers = watchData.map(i => i.ticker.toUpperCase());
      loadSparklines(tickers);
    }

    return watchData;
  };

  // ... (rest of your existing useEffects and functions remain the same)

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
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Star className="h-7 w-7 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900">Watchlist</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1.5">Stocks you're watching</p>
        </div>

        {/* Add Ticker Form */}
        <form onSubmit={handleAdd} className="mb-6">
          {/* ... your existing add form ... */}
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
                  sparklineData={sparklines[item.ticker.toUpperCase()]}
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
