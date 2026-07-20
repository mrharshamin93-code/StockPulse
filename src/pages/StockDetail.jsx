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

// ---------- Constants & helpers (unchanged) ----------
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

async function finnhubProxy(body) {
  const res = await fetch("/api/finnhub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---------- Chart & other functions (updated) ----------
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
      // ✅ FIX: sort by timestamp to ensure left-to-right order
      candles.sort((a, b) => a.t - b.t);
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
  } catch (e) {
    console.warn("Candle fetch failed, using fallback", e);
  }
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
            {/* ✅ FIX: added animationDuration for left-to-right draw */}
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

// ---------- Buy/Sell Dialogs (unchanged) ----------
function BuyDetailDialog({ open, onOpenChange, stock, onDone }) {
  // ... keep exactly as you had
}

function SellDetailDialog({ open, onOpenChange, stock, onDone }) {
  // ... keep exactly as you had
}

// ---------- Key Metrics (unchanged) ----------
function getStockMetrics(ticker, price) {
  // ... keep exactly as you had
}

// ---------- MAIN COMPONENT (unchanged except the chart call) ----------
export default function StockDetail() {
  // ... keep exactly as you had, including the layout with absolute positioning for buttons
}
