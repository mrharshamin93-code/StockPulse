import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Newspaper,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "10Y", "All"];

const PERIOD_CONFIG = {
  "1D": { resolution: "5", daysBack: 1 },
  "1W": { resolution: "60", daysBack: 7 },
  "1M": { resolution: "D", daysBack: 30 },
  "3M": { resolution: "D", daysBack: 90 },
  "6M": { resolution: "W", daysBack: 180 },
  YTD: { resolution: "W", daysBack: null },
  "1Y": { resolution: "W", daysBack: 365 },
  "2Y": { resolution: "W", daysBack: 730 },
  "5Y": { resolution: "M", daysBack: 1825 },
  "10Y": { resolution: "M", daysBack: 3650 },
  All: { resolution: "M", daysBack: 5475 },
};

async function callFinnhub(params) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetch(`/api/finnhub?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch Finnhub data");
  return res.json();
}

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

    const res = await callFinnhub({
      action: "candles_range",
      ticker,
      resolution: cfg.resolution,
      from,
      to,
    });

    const candles = res?.candles;
    if (candles?.length > 0) {
      return candles.map((c) => {
        const d = new Date(c.t * 1000);
        const label =
          period === "1D"
            ? d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : period === "1W" || period === "1M" || period === "3M"
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
  const pointsMap = {
    "1D": 12,
    "1W": 7,
    "1M": 20,
    "3M": 12,
    "6M": 12,
    YTD: Math.max(4, Math.floor(ytdDays / 7)),
    "1Y": 12,
    "2Y": 12,
    "5Y": 10,
    "10Y": 10,
    All: 10,
  };
  const msMap = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    YTD: ytdDays,
    "1Y": 365,
    "2Y": 730,
    "5Y": 1825,
    "10Y": 3650,
    All: 5475,
  };
  const n = pointsMap[period] || 12;
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const totalDays = msMap[period] || 30;
  const drift = ((seed % 200) - 100) / 10000;
  const data = [];
  let price = basePrice * (1 - drift * n * 0.5);

  for (let i = 0; i <= n; i++) {
    const noise =
      (Math.sin(seed * (i + 1) * 1.3) * 0.012 + Math.cos(seed * i * 0.7) * 0.008) * price;
    price = Math.max(price * (1 + drift) + noise, basePrice * 0.2);
    const d = new Date(now.getTime() - ((n - i) / n) * totalDays * 86400000);
    const label =
      period === "1D"
        ? d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
        : period === "1W" ||
            period === "1M" ||
            period === "3M" ||
            period === "6M" ||
            period === "YTD"
          ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    data.push({ label, [ticker]: Math.round(price * 100) / 100 });
  }

  return data;
}

function mergeChartData(primary, secondary, compareTicker) {
  return primary.map((point, i) => ({
    ...point,
    ...(secondary[i] ? { [compareTicker]: secondary[i][compareTicker] } : {}),
  }));
}

function getStockMetrics(ticker, price) {
  const s = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const p = price || 100;
  const high52 = +(p * (1.05 + (s % 40) / 100)).toFixed(2);
  const low52 = +(p * (0.6 + (s % 30) / 100)).toFixed(2);
  const pe = +(12 + (s % 60) + ((s * 3) % 10) / 10).toFixed(1);
  const eps = +(p / pe).toFixed(2);
  const mktCapB = +((p * (5 + (s % 2000))) / 1000).toFixed(1);
  const vol = ((s * 137) % 90 + 5) * 1000000;
  const avgVol = ((s * 91) % 70 + 8) * 1000000;
  const yield_ = s % 4 === 0 ? 0 : +((s % 400) / 100).toFixed(2);
  const beta = +(0.5 + (s % 150) / 100).toFixed(2);

  const fmt = (n) =>
    n >= 1e12
      ? "$" + (n / 1e12).toFixed(2) + "T"
      : n >= 1e9
        ? "$" + (n / 1e9).toFixed(1) + "B"
        : "$" + (n / 1e6).toFixed(0) + "M";

  const fmtVol = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${(n / 1e3).toFixed(0)}K`);

  const ps = +((mktCapB * 1e9) / (p * (10 + (s % 500)) * 1e6)).toFixed(2);
  const profitMargin = +((5 + (s % 60)) / 100).toFixed(3);
  const de = +(0.1 + (s % 300) / 100).toFixed(2);

  return [
    { label: "Mkt Cap", value: fmt(mktCapB * 1e9) },
    { label: "P/E", value: pe },
    { label: "P/S", value: ps },
    { label: "EPS", value: "$" + eps },
    { label: "Beta", value: beta },
    { label: "Volume", value: fmtVol(vol) },
    { label: "Avg Vol", value: fmtVol(avgVol) },
    { label: "52W Low", value: "$" + low52 },
    { label: "D/E", value: de },
    { label: "Yield", value: yield_ > 0 ? `${yield_}%` : "—" },
    { label: "Net Margin", value: `${(profitMargin * 100).toFixed(1)}%` },
    { label: "52W High", value: "$" + high52 },
  ];
}

function normalizeData(data, ticker, compareTicker) {
  const base1 = data[0]?.[ticker];
  const base2 = data[0]?.[compareTicker];

  return data.map((d) => ({
    label: d.label,
    [ticker]: base1 ? Math.round(((d[ticker] - base1) / base1) * 10000) / 100 : null,
    ...(base2 && d[compareTicker] != null
      ? { [compareTicker]: Math.round(((d[compareTicker] - base2) / base2) * 10000) / 100 }
      : {}),
  }));
}

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
        const compareBasePrice =
          10 + (compareTicker.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 500);
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
    return () => {
      cancelled = true;
    };
  }, [ticker, activePeriod, compareTicker, basePrice]);

  const primaryColor = isPositive ? "#10b981" : "#ef4444";
  const compareColor = "#6366f1";

  const handleAddCompare = (e) => {
    e.preventDefault();
    const t = compareInput.trim().toUpperCase();
    if (t && t !== ticker.toUpperCase()) setCompareTicker(t);
    setShowInput(false);
    setCompareInput("");
  };

  const removeCompare = () => setCompareTicker("");

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-500">
            Price Chart
          </h2>
          {compareTicker && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              vs {compareTicker}
              <button onClick={removeCompare} className="ml-0.5 hover:text-indigo-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-start gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activePeriod === p ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}

          {!compareTicker && !showInput && (
            <button
              onClick={() => setShowInput(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <Plus className="h-3 w-3" />
              Compare
            </button>
          )}

          {showInput && (
            <form onSubmit={handleAddCompare} className="ml-1 flex items-center gap-1">
              <Input
                autoFocus
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                placeholder="TICKER"
                className="h-7 w-24 px-2 text-xs uppercase"
                maxLength={8}
              />
              <Button type="submit" size="sm" className="h-7 px-2 text-xs">
                Add
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowInput(false);
                  setCompareInput("");
                }}
                className="text-gray-400 hover:text-gray-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>

      {compareTicker && (
        <p className="mb-3 text-[10px] text-gray-400">
          Showing % return — both tickers indexed to 100 at period start
        </p>
      )}

      <div className="relative h-48 w-full">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => (compareTicker ? `${v.toFixed(0)}%` : "$" + v.toFixed(0))}
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
                  <div className="min-w-[110px] rounded-xl border border-gray-200 bg-white px-4 py-3 font-body shadow-lg">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                      {label}
                    </p>
                    {payload.map((p) => {
                      const growthPct = compareTicker
                        ? p.value
                        : basePrice > 0
                          ? ((p.value - basePrice) / basePrice) * 100
                          : 0;
                      const linePositive = growthPct >= 0;

                      return (
                        <div key={p.dataKey} className="flex flex-col gap-1">
                          <span className="text-base font-bold text-gray-900">
                            {compareTicker ? `${p.value?.toFixed(2)}%` : "$" + p.value?.toFixed(2)}
                          </span>
                          {!compareTicker && (
                            <span
                              className={`text-xs font-semibold ${
                                linePositive ? "text-emerald-600" : "text-red-500"
                              }`}
                            >
                              {linePositive ? "▲" : "▼"} {linePositive ? "+" : ""}
                              {growthPct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey={ticker} stroke={primaryColor} strokeWidth={2} dot={false} />
            {compareTicker && (
              <Line
                type="monotone"
                dataKey={compareTicker}
                stroke={compareColor}
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {compareTicker && (
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-medium text-gray-500">{ticker}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-4 rounded border-t-2 border-dashed"
              style={{ borderColor: compareColor }}
            />
            <span className="text-xs font-medium text-gray-500">{compareTicker}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BuyDetailDialog({ open, onOpenChange, stock, onDone }) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(
    stock?.current_price?.toFixed(2) || stock?.purchase_price?.toFixed(2) || ""
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPrice(stock?.current_price?.toFixed(2) || stock?.purchase_price?.toFixed(2) || "");
    setQuantity("");
  }, [stock, open]);

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
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Buy {stock?.ticker}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-gray-500">{stock?.company_name}</p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shares</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !quantity || !price}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Buy
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

  useEffect(() => {
    setQuantity("");
  }, [stock, open]);

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
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Sell {stock?.ticker}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-gray-500">
          {stock?.company_name} · {max} shares held
        </p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Shares to Sell</Label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0.01"
                max={max}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity(String(max))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-900"
              >
                all
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !quantity || parseFloat(quantity) <= 0}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockDetail() {
  const { ticker: routeTicker } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const ticker = String(routeTicker || "").trim().toUpperCase();

  useEffect(() => {
    const load = async () => {
      if (!ticker || !user?.id) {
        setStock(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [{ data: ownedStock }, { data: watchlistItem }, quoteData, profileData] = await Promise.all([
          supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .maybeSingle(),
          supabase
            .from("watchlist_items")
            .select("*")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .maybeSingle(),
          callFinnhub({ action: "quote", ticker }),
          callFinnhub({ action: "profile", ticker }),
        ]);

        if (ownedStock) {
          setStock({
            ...ownedStock,
            ticker,
            company_name:
              ownedStock.company_name || profileData?.name || watchlistItem?.company_name || ticker,
            sector: ownedStock.sector || profileData?.finnhubIndustry || "",
            logo_url: ownedStock.logo_url || profileData?.logo || "",
            current_price: quoteData?.c || ownedStock.current_price || 0,
            _watchlistOnly: false,
          });
        } else {
          setStock({
            ticker,
            company_name: profileData?.name || watchlistItem?.company_name || ticker,
            sector: profileData?.finnhubIndustry || "",
            logo_url: profileData?.logo || "",
            current_price: quoteData?.c || 0,
            purchase_price: quoteData?.pc || quoteData?.c || 0,
            quantity: 0,
            _watchlistOnly: true,
          });
        }
      } catch {
        setStock(null);
      }

      setLoading(false);
    };

    load();
  }, [ticker, user?.id]);

  const fetchAnalysis = async () => {
    if (!stock) return;

    setAnalyzing(true);

    try {
      const newsData = await callFinnhub({ action: "news", ticker: stock.ticker });
      setAnalysis({ news: newsData?.articles || [] });
    } catch {
      setAnalysis({ news: [] });
    }

    setAnalyzing(false);
  };

  useEffect(() => {
    if (stock && !analysis) {
      fetchAnalysis();
    }
  }, [stock]);

  const handleBuyDone = async (qty, price) => {
    const existingQty = stock.quantity || 0;
    const newQty = existingQty + qty;
    const newAvgCost = ((stock.purchase_price || 0) * existingQty + price * qty) / newQty;

    setStock((prev) => ({
      ...prev,
      quantity: newQty,
      purchase_price: +newAvgCost.toFixed(4),
      _watchlistOnly: false,
    }));
    setBuyOpen(false);

    let currentPrice = price;

    try {
      const res = await callFinnhub({ action: "quote", ticker: stock.ticker });
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
    });

    const { data: existingStock } = await supabase
      .from("stocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("ticker", stock.ticker.toUpperCase())
      .maybeSingle();

    if (existingStock) {
      await supabase
        .from("stocks")
        .update({
          quantity: newQty,
          purchase_price: +newAvgCost.toFixed(4),
          current_price: currentPrice,
          company_name: stock.company_name,
          sector: stock.sector || "",
        })
        .eq("id", existingStock.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("stocks").insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        quantity: qty,
        purchase_price: price,
        current_price: currentPrice,
        sector: stock.sector || "",
      });
    }

    const { data: existingWatchlist } = await supabase
      .from("watchlist_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("ticker", stock.ticker.toUpperCase())
      .limit(1);

    if (!existingWatchlist || existingWatchlist.length === 0) {
      await supabase.from("watchlist_items").insert({
        user_id: user.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        exchange: "",
      });
    }

    const { data: refreshed } = await supabase
      .from("stocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("ticker", stock.ticker.toUpperCase())
      .maybeSingle();

    if (refreshed) {
      setStock((prev) => ({
        ...prev,
        ...refreshed,
        current_price: currentPrice,
        _watchlistOnly: false,
      }));
    }
  };

  const handleSellDone = async (qty) => {
    const sellPrice = stock.current_price || stock.purchase_price;
    const originalQty = stock.quantity || 0;
    const remainingQty = parseFloat((originalQty - qty).toFixed(6));

    if (qty >= originalQty) {
      setSellOpen(false);
      setStock((prev) => ({
        ...prev,
        quantity: 0,
        _watchlistOnly: true,
      }));
    } else {
      setStock((prev) => ({ ...prev, quantity: remainingQty }));
      setSellOpen(false);
    }

    await supabase.from("stock_transactions").insert({
      user_id: user.id,
      ticker: stock.ticker.toUpperCase(),
      company_name: stock.company_name,
      type: "sell",
      quantity: qty,
      price: sellPrice,
      total: qty * sellPrice,
    });

    const { data: existingStock } = await supabase
      .from("stocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("ticker", stock.ticker.toUpperCase())
      .maybeSingle();

    if (existingStock) {
      if (qty >= originalQty) {
        await supabase
          .from("stocks")
          .delete()
          .eq("id", existingStock.id)
          .eq("user_id", user.id);

        setStock((prev) => ({
          ...prev,
          quantity: 0,
          _watchlistOnly: true,
        }));
      } else {
        await supabase
          .from("stocks")
          .update({ quantity: remainingQty })
          .eq("id", existingStock.id)
          .eq("user_id", user.id);

        setStock((prev) => ({
          ...prev,
          quantity: remainingQty,
          _watchlistOnly: false,
        }));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <div className="text-center">
          <p className="mb-4 text-gray-500">Stock not found</p>
          <Link to="/watchlist">
            <Button variant="outline">Back to Watchlist</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalValue = (stock.current_price || 0) * (stock.quantity || 0);
  const totalCost = (stock.purchase_price || 0) * (stock.quantity || 0);
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

      <SubPageHeader title={stock.ticker} onBack={() => navigate(-1)} />

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 pb-safe sm:px-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
                {stock.sector}
              </span>
              <h1 className="mt-1 font-heading text-3xl font-bold">{stock.ticker}</h1>
              <p className="text-gray-500">{stock.company_name}</p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="text-left sm:text-right">
                <p className="font-heading text-3xl font-bold">
                  {stock.current_price ? "$" + stock.current_price.toFixed(2) : "—"}
                </p>
                <div
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                    isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {isPositive ? "+" : ""}
                  {gainPct.toFixed(2)}%
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBuyOpen(true)}
                  className="h-8 rounded-md bg-black px-3 text-xs font-semibold text-white transition-all hover:bg-gray-800 active:scale-95"
                >
                  Buy
                </button>
                {!stock._watchlistOnly && (
                  <button
                    onClick={() => setSellOpen(true)}
                    className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-black transition-all hover:bg-gray-50 active:scale-95"
                  >
                    Sell
                  </button>
                )}
              </div>
            </div>
          </div>

          {!stock._watchlistOnly && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-6 sm:grid-cols-4">
              {[
                { label: "Shares", value: stock.quantity },
                { label: "Avg. Cost", value: "$" + stock.purchase_price.toFixed(2) },
                {
                  label: "Total Value",
                  value:
                    "$" +
                    totalValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                },
                {
                  label: "Gain/Loss",
                  value: `${isPositive ? "+" : ""}$${gain.toFixed(2)}`,
                  color: isPositive ? "text-emerald-600" : "text-red-600",
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                    {item.label}
                  </p>
                  <p className={`font-semibold ${item.color || ""}`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <StockChart
          ticker={stock.ticker}
          currentPrice={stock.current_price || stock.purchase_price}
          isPositive={isPositive}
        />

        {(() => {
          const metrics = getStockMetrics(stock.ticker, stock.current_price || stock.purchase_price);

          return (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-gray-500">
                Key Metrics
              </h2>
              <div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {m.label}
                    </p>
                    <p className="text-sm font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {analyzing ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
              <Sparkles className="h-6 w-6 animate-pulse text-blue-500" />
            </div>
            <p className="mb-1 font-heading font-semibold">Loading news…</p>
          </div>
        ) : analysis?.news?.length > 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-gray-400" />
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Recent News
                </h2>
              </div>
              <button
                onClick={fetchAnalysis}
                className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-900"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {analysis.news.map((item, i) => (
                <div key={i}>
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{item.summary}</p>
                      {item.date && <p className="mt-1 text-xs text-gray-400">{item.date}</p>}
                    </div>
                  </div>
                  {i < analysis.news.length - 1 && <div className="mt-4 border-b border-gray-100" />}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </motion.div>
  );
}
