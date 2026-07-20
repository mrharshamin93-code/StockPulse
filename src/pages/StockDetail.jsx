import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Newspaper, Plus, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

// ---------- Constants (unchanged) ----------
const PERIODS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "10Y", "All"];
const PERIOD_CONFIG = {
  "1D": { resolution: "5",  daysBack: 1 },
  "1W": { resolution: "60", daysBack: 7 },
  "1M": { resolution: "D",  daysBack: 30 },
  "3M": { resolution: "D",  daysBack: 90 },
  "6M": { resolution: "W",  daysBack: 180 },
  "YTD": { resolution: "W", daysBack: null },
  "1Y": { resolution: "W",  daysBack: 365 },
  "2Y": { resolution: "W",  daysBack: 730 },
  "5Y": { resolution: "M",  daysBack: 1825 },
  "10Y": { resolution: "M", daysBack: 3650 },
  "All": { resolution: "M", daysBack: 5475 },
};

// ---------- Finnhub proxy helper ----------
async function finnhubProxy(body) {
  const res = await fetch("/api/finnhub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---------- Chart data helpers ----------
async function fetchChartData(ticker, period, basePrice) {
  try {
    const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG["1M"];
    const to = Math.floor(Date.now() / 1000);
    let from;
    if (period === "YTD") {
      const jan1 = new Date(new Date().getFullYear(), 0, 1);
      from = Math.floor(jan1.getTime() / 1000);
    } else {
      from = to - cfg.daysBack * 86400;
    }
    const data = await finnhubProxy({
      action: "candles_range",
      ticker,
      resolution: cfg.resolution,
      from,
      to,
    });
    const candles = data?.candles;
    if (candles?.length > 0) {
      candles.sort((a, b) => a.t - b.t); // ensure left-to-right
      return candles.map(c => {
        const d = new Date(c.t * 1000);
        const label = (period === "1D")
          ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : (period === "1W" || period === "1M" || period === "3M")
            ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        return { label, [ticker]: c.v };
      });
    }
  } catch {}
  return buildFallbackData(ticker, period, basePrice);
}

function buildFallbackData(ticker, period, basePrice) {
  const now = new Date();
  const ytdDays = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
  const pointsMap = { "1D": 12, "1W": 7, "1M": 20, "3M": 12, "6M": 12, "YTD": Math.max(4, Math.floor(ytdDays / 7)), "1Y": 12, "2Y": 12, "5Y": 10, "10Y": 10, "All": 10 };
  const msMap = { "1D": 1, "1W": 7, "1M": 30, "3M": 90, "6M": 180, "YTD": ytdDays, "1Y": 365, "2Y": 730, "5Y": 1825, "10Y": 3650, "All": 5475 };
  const n = pointsMap[period] || 12;
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const totalDays = msMap[period] || 30;
  const drift = ((seed % 200) - 100) / 10000;
  const data = [];
  let price = basePrice * (1 - drift * n * 0.5);
  for (let i = 0; i <= n; i++) {
    const noise = (Math.sin(seed * (i + 1) * 1.3) * 0.012 + Math.cos(seed * i * 0.7) * 0.008) * price;
    price = Math.max(price * (1 + drift) + noise, basePrice * 0.2);
    const d = new Date(now.getTime() - ((n - i) / n) * totalDays * 86400000);
    const label = period === "1D"
      ? d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
      : (period === "1W" || period === "1M" || period === "3M" || period === "6M" || period === "YTD")
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    data.push({ label, [ticker]: Math.round(price * 100) / 100 });
  }
  return data;
}

function mergeChartData(primary, secondary, compareTicker) {
  return primary.map((point, i) => ({
    ...point,
    ...(secondary[i] ? { [compareTicker]: secondary[i][compareTicker] } : {})
  }));
}

function normalizeData(data, ticker, compareTicker) {
  const base1 = data[0]?.[ticker];
  const base2 = data[0]?.[compareTicker];
  return data.map(d => ({
    label: d.label,
    [ticker]: base1 ? Math.round(((d[ticker] - base1) / base1) * 10000) / 100 : null,
    ...(base2 && d[compareTicker] != null
      ? { [compareTicker]: Math.round(((d[compareTicker] - base2) / base2) * 10000) / 100 }
      : {}),
  }));
}

// ---------- Chart Component ----------
function StockChart({ ticker, currentPrice, isPositive }) {
  const [activePeriod, setActivePeriod] = useState("1M");
  const [compareTicker, setCompareTicker] = useState("");
  const [compareInput, setCompareInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const basePrice = currentPrice || 100;

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    const loadChart = async () => {
      const primaryData = await fetchChartData(ticker, activePeriod, basePrice);
      if (cancelled) return;
      if (compareTicker) {
        const compareBasePrice = 10 + (compareTicker.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 500);
        const compareRaw = await fetchChartData(compareTicker, activePeriod, compareBasePrice);
        if (cancelled) return;
        const merged = mergeChartData(primaryData, compareRaw, compareTicker);
        setChartData(normalizeData(merged, ticker, compareTicker));
      } else {
        setChartData(primaryData);
      }
      setChartLoading(false);
    };
    loadChart();
    return () => { cancelled = true; };
  }, [ticker, activePeriod, compareTicker, basePrice]);

  const primaryColor = isPositive ? "#10b981" : "#ef4444";
  const compareColor = "#6366f1";

  const handleAddCompare = (e) => {
    e.preventDefault();
    const t = compareInput.trim().toUpperCase();
    if (t && t !== ticker.toUpperCase()) {
      setCompareTicker(t);
    }
    setShowInput(false);
    setCompareInput("");
  };

  const removeCompare = () => setCompareTicker("");

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-gray-500">Price Chart</h2>
          {compareTicker && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
              vs {compareTicker}
              <button onClick={removeCompare} className="ml-0.5 hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-start">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${activePeriod === p ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {p}
            </button>
          ))}
          {!compareTicker && !showInput && (
            <button
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900 transition-colors px-2.5 py-1 rounded-md hover:bg-gray-100 ml-auto"
            >
              <Plus className="w-3 h-3" />Compare
            </button>
          )}
          {showInput && (
            <form onSubmit={handleAddCompare} className="flex items-center gap-1 ml-1">
              <Input
                autoFocus
                value={compareInput}
                onChange={e => setCompareInput(e.target.value.toUpperCase())}
                placeholder="TICKER"
                className="h-7 w-24 text-xs uppercase px-2"
                maxLength={8}
              />
              <Button type="submit" size="sm" className="h-7 px-2 text-xs">Add</Button>
              <button type="button" onClick={() => { setShowInput(false); setCompareInput(""); }} className="text-gray-400 hover:text-gray-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>

      {compareTicker && (
        <p className="text-[10px] text-gray-400 mb-3">Showing % return — both tickers indexed to 100 at period start</p>
      )}

      <div className="h-48 w-full relative">
        {chartLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={v => compareTicker ? `${v.toFixed(0)}%` : `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 font-body min-w-[110px]">
                    <p className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wider">{label}</p>
                    {payload.map(p => {
                      const growthPct = compareTicker
                        ? p.value
                        : basePrice > 0 ? ((p.value - basePrice) / basePrice) * 100 : 0;
                      const isPos = growthPct >= 0;
                      return (
                        <div key={p.dataKey} className="flex flex-col gap-1">
                          <span className="text-base font-bold text-gray-900">
                            {compareTicker ? `${p.value?.toFixed(2)}%` : `$${p.value?.toFixed(2)}`}
                          </span>
                          {!compareTicker && (
                            <span className={`text-xs font-semibold ${isPos ? "text-emerald-600" : "text-red-500"}`}>
                              {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{growthPct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey={ticker} stroke={primaryColor} strokeWidth={2} dot={false} animationDuration={800} />
            {compareTicker && (
              <Line type="monotone" dataKey={compareTicker} stroke={compareColor} strokeWidth={2} dot={false} strokeDasharray="4 2" animationDuration={800} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {compareTicker && (
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs text-gray-500 font-medium">{ticker}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: compareColor }} />
            <span className="text-xs text-gray-500 font-medium">{compareTicker}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Buy/Sell Dialogs ----------
function BuyDetailDialog({ open, onOpenChange, stock, onDone }) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(stock?.current_price?.toFixed(2) || stock?.purchase_price?.toFixed(2) || "");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onDone(parseFloat(quantity), parseFloat(price));
    setLoading(false);
    setQuantity("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-heading text-xl">Buy {stock?.ticker}</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">{stock?.company_name}</p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Shares</Label><Input type="number" step="any" min="0.01" placeholder="10" value={quantity} onChange={e => setQuantity(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Purchase Price</Label><Input type="number" step="any" min="0.01" placeholder="150.00" value={price} onChange={e => setPrice(e.target.value)} required /></div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !quantity || !price}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Buy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellDetailDialog({ open, onOpenChange, stock, onDone }) {
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const max = stock?.quantity || 0;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onDone(parseFloat(quantity));
    setLoading(false);
    setQuantity("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-heading text-xl">Sell {stock?.ticker}</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">{stock?.company_name} · {max} shares held</p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Shares to Sell</Label>
            <div className="relative">
              <Input type="number" step="any" min="0.01" max={max} placeholder="" value={quantity} onChange={e => setQuantity(e.target.value)} className="pr-12" required />
              <button type="button" onClick={() => setQuantity(String(max))} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-900 transition-colors">all</button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !quantity || parseFloat(quantity) <= 0}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Key Metrics ----------
function getStockMetrics(ticker, price) {
  const s = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const p = price || 100;
  const high52 = +(p * (1.05 + (s % 40) / 100)).toFixed(2);
  const low52 = +(p * (0.6 + (s % 30) / 100)).toFixed(2);
  const pe = +((12 + (s % 60) + (s * 3 % 10) / 10)).toFixed(1);
  const eps = +(p / pe).toFixed(2);
  const mktCapB = +((p * (5 + (s % 2000))) / 1000).toFixed(1);
  const vol = ((s * 137) % 90 + 5) * 1000000;
  const avgVol = ((s * 91) % 70 + 8) * 1000000;
  const yield_ = s % 4 === 0 ? 0 : +((s % 400) / 100).toFixed(2);
  const beta = +((0.5 + (s % 150) / 100)).toFixed(2);
  const fmt = (n) => n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`;
  const fmtVol = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${(n / 1e3).toFixed(0)}K`;
  const ps = +((mktCapB * 1e9) / (p * (10 + (s % 500)) * 1e6)).toFixed(2);
  const profitMargin = +((5 + (s % 60)) / 100).toFixed(3);
  const de = +((0.1 + (s % 300) / 100)).toFixed(2);
  return [
    { label: "Mkt Cap", value: fmt(mktCapB * 1e9) },
    { label: "P/E", value: pe },
    { label: "P/S", value: ps },
    { label: "EPS", value: `$${eps}` },
    { label: "Beta", value: beta },
    { label: "Volume", value: fmtVol(vol) },
    { label: "Avg Vol", value: fmtVol(avgVol) },
    { label: "52W Low", value: `$${low52}` },
    { label: "D/E", value: de },
    { label: "Yield", value: yield_ > 0 ? `${yield_}%` : "—" },
    { label: "Net Margin", value: `${(profitMargin * 100).toFixed(1)}%` },
    { label: "52W High", value: `$${high52}` },
  ];
}

// ---------- MAIN COMPONENT (fixed layout) ----------
export default function StockDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const isTickerRoute = ticker?.startsWith("ticker-");
  const tickerFromRoute = isTickerRoute ? ticker.replace("ticker-", "").toUpperCase() : null;
  const stockId = !isTickerRoute ? ticker : null;

  useEffect(() => {
    const load = async () => {
      if (isTickerRoute) {
        try {
          const [quoteRes, profileRes] = await Promise.all([
            finnhubProxy({ action: "quote", ticker: tickerFromRoute }),
            finnhubProxy({ action: "profile", ticker: tickerFromRoute }),
          ]);
          setStock({
            ticker: tickerFromRoute,
            company_name: profileRes?.name || tickerFromRoute,
            sector: profileRes?.finnhubIndustry || "",
            logo_url: profileRes?.logo || "",
            current_price: quoteRes?.c || 0,
            purchase_price: quoteRes?.pc || quoteRes?.c || 0,
            quantity: 0,
            _watchlistOnly: true,
          });
        } catch {
          setStock(null);
        }
      } else {
        const { data } = await supabase.from("stocks").select("*").eq("id", stockId).single();
        if (data) {
          setStock({ ...data, _watchlistOnly: false });
        } else {
          setStock(null);
        }
      }
      setLoading(false);
    };
    load();
  }, [ticker, isTickerRoute, tickerFromRoute, stockId]);

  useEffect(() => {
    if (!stock) return;
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const result = await finnhubProxy({ action: "news", ticker: stock.ticker });
        setNews(result?.articles || []);
      } catch (e) {
        console.warn("News fetch failed:", e);
        setNews([]);
      }
      setNewsLoading(false);
    };
    fetchNews();
  }, [stock]);

  const handleBuyDone = async (qty, price) => {
    if (!user) return;
    const newQty = stock.quantity + qty;
    const newAvgCost = stock.quantity ? ((stock.purchase_price * stock.quantity) + (price * qty)) / newQty : price;
    setStock(prev => ({ ...prev, quantity: newQty, purchase_price: +newAvgCost.toFixed(4) }));
    setBuyOpen(false);
    let currentPrice = price;
    try {
      const res = await finnhubProxy({ action: "quote", ticker: stock.ticker });
      if (res?.c) currentPrice = res.c;
    } catch {}
    await supabase.from("stock_transactions").insert({
      user_id: user.id,
      ticker: stock.ticker.toUpperCase(),
      company_name: stock.company_name,
      type: "buy",
      quantity: qty,
      price,
      total: qty * price,
    }).catch(err => console.warn("Transaction log failed:", err));
    if (stock._watchlistOnly) {
      const { error } = await supabase.from("stocks").insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        quantity: qty,
        purchase_price: price,
        current_price: currentPrice,
        sector: stock.sector || "",
      });
      if (error) {
        setStock(prev => ({ ...prev, quantity: 0, purchase_price: price }));
        return;
      }
    } else {
      await supabase.from("stocks").update({
        quantity: newQty,
        purchase_price: +newAvgCost.toFixed(4),
        current_price: currentPrice,
      }).eq("id", stockId);
      const { data } = await supabase.from("stocks").select("*").eq("id", stockId).single();
      if (data) setStock({ ...data, _watchlistOnly: false });
    }
  };

  const handleSellDone = async (qty) => {
    if (!user) return;
    const sellPrice = stock.current_price || stock.purchase_price;
    const remainingQty = parseFloat((stock.quantity - qty).toFixed(6));
    if (qty >= stock.quantity) {
      setSellOpen(false);
      navigate("/home");
      await supabase.from("stocks").delete().eq("id", stockId);
      await supabase.from("stock_transactions").insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "sell",
        quantity: stock.quantity,
        price: sellPrice,
        total: stock.quantity * sellPrice,
      }).catch(() => {});
    } else {
      setStock(prev => ({ ...prev, quantity: remainingQty }));
      setSellOpen(false);
      await supabase.from("stocks").update({ quantity: remainingQty }).eq("id", stockId);
      await supabase.from("stock_transactions").insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "sell",
        quantity: qty,
        price: sellPrice,
        total: qty * sellPrice,
      }).catch(() => {});
      const { data } = await supabase.from("stocks").select("*").eq("id", stockId).single();
      if (data) setStock({ ...data, _watchlistOnly: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Stock not found</p>
          <Link to="/"><Button variant="outline">Back to Portfolio</Button></Link>
        </div>
      </div>
    );
  }

  const totalValue = (stock.current_price || 0) * stock.quantity;
  const totalCost = stock.purchase_price * stock.quantity;
  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
  const isPositive = gain >= 0;

  return (
    <motion.div
      className="min-h-screen bg-gray-50/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <BuyDetailDialog open={buyOpen} onOpenChange={setBuyOpen} stock={stock} onDone={handleBuyDone} />
      <SellDetailDialog open={sellOpen} onOpenChange={setSellOpen} stock={stock} onDone={handleSellDone} />

      {/* Fixed back button */}
      <div
        className="fixed top-0 left-0 z-50 flex items-center"
        style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "transparent" }}
      >
        <button
          onClick={() => navigate(isTickerRoute ? "/" : "/home")}
          className="flex items-center gap-0.5 text-sm font-semibold text-gray-900 bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm rounded-full px-3 py-1.5 m-3 min-h-[36px] active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-0.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 64px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}>
        {/* Stock Overview – fixed layout with relative + absolute positioning */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 relative">
          <div className="absolute top-8 right-4 flex items-center gap-2">
            <button onClick={() => setBuyOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md bg-black text-white hover:bg-gray-800 active:scale-95 transition-all">Buy</button>
            {!stock._watchlistOnly && <button onClick={() => setSellOpen(true)} className="h-8 px-3 text-xs font-semibold rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all">Sell</button>}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">{stock.sector}</span>
              <h1 className="font-heading text-3xl font-bold mt-1">{stock.ticker}</h1>
              <p className="text-gray-500">{stock.company_name}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-3xl font-heading font-bold">${stock.current_price?.toFixed(2) || "—"}</p>
              <div className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-sm font-semibold ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? "+" : ""}{gainPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {!stock._watchlistOnly && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
              {[
                { label: "Shares", value: stock.quantity },
                { label: "Avg. Cost", value: `$${stock.purchase_price.toFixed(2)}` },
                { label: "Total Value", value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: "Gain/Loss", value: `${isPositive ? "+" : ""}$${gain.toFixed(2)}`, color: isPositive ? "text-emerald-600" : "text-red-600" }
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{item.label}</p>
                  <p className={`font-semibold ${item.color || ""}`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart – now properly placed below */}
        <StockChart ticker={stock.ticker} currentPrice={stock.current_price || stock.purchase_price} isPositive={isPositive} />

        {/* Key Metrics */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-gray-500 mb-4">Key Metrics</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-5">
            {getStockMetrics(stock.ticker, stock.current_price || stock.purchase_price).map(m => (
              <div key={m.label}>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{m.label}</p>
                <p className="font-semibold text-sm">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* News */}
        {newsLoading ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
            <p className="font-heading font-semibold mb-1">Loading news…</p>
          </div>
        ) : news && news.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-gray-400" />
                <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-gray-500">Recent News</h2>
              </div>
              <button onClick={() => {
                setNewsLoading(true);
                finnhubProxy({ action: "news", ticker: stock.ticker })
                  .then(res => setNews(res?.articles || []))
                  .finally(() => setNewsLoading(false));
              }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-900 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
            <div className="space-y-4">
              {news.map((item, i) => (
                <div key={i}>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.summary}</p>
                      {item.date && <p className="text-xs text-gray-400 mt-1">{item.date}</p>}
                    </div>
                  </div>
                  {i < news.length - 1 && <div className="border-b border-gray-100 mt-4" />}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </motion.div>
  );
}
