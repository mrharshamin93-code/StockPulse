import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, SlidersHorizontal, Search, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const SECTORS = ["Technology", "Healthcare", "Finance", "Energy", "Consumer Cyclical", "Industrials", "Real Estate", "Utilities", "Materials", "Communication Services"];

const POPULAR_SCREENS = [
  { label: "Large Cap Tech", filters: { sector: "Technology", minMarketCap: 10 } },
  { label: "High Dividend", filters: { minDividendYield: 3 } },
  { label: "Oversold (RSI < 30)", filters: { maxRsi: 30 } },
  { label: "Strong Momentum", filters: { minChangePercent: 5 } },
  { label: "Penny Stocks", filters: { maxPrice: 5 } },
];




function FilterChip({ label, active, onClick, tooltip }) {
  const [showTip, setShowTip] = React.useState(false);
  const btnRef = React.useRef(null);
  const [tipStyle, setTipStyle] = React.useState({});

  const openTip = () => {
    if (!tooltip) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tipWidth = 240;
      // Align left edge to button left, but clamp so right edge stays in viewport
      let left = rect.left;
      left = Math.min(left, window.innerWidth - tipWidth - 12);
      left = Math.max(12, left);
      setTipStyle({ position: "fixed", top: rect.top - 8, transform: "translateY(-100%)", left, width: tipWidth, zIndex: 9999 });
    }
    setShowTip(true);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={openTip}
        onMouseLeave={() => setShowTip(false)}
        onTouchStart={openTip}
        onTouchEnd={() => setTimeout(() => setShowTip(false), 1800)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
          active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:border-gray-400"
        }`}
      >
        {label}
      </button>
      {showTip && tooltip && (
        <div
          className="bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2.5 shadow-xl pointer-events-none whitespace-normal break-words"
          style={tipStyle}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

const METRIC_GROUPS = [
  {
    group: "Valuation",
    metrics: [
      { key: "pe", label: "P/E Ratio", desc: "Price ÷ EPS. Lower is generally cheaper; compare to peers. Negative earnings = no P/E.", unit: "x", minKey: "minPe", maxKey: "maxPe", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 25" },
      { key: "forwardPe", label: "Forward P/E", desc: "Price ÷ estimated future EPS. Reflects expected earnings growth.", unit: "x", minKey: "minForwardPe", maxKey: "maxForwardPe", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 30" },
      { key: "peg", label: "PEG Ratio", desc: "P/E ÷ earnings growth rate. Accounts for growth; < 1 often considered attractive.", unit: "x", minKey: "minPeg", maxKey: "maxPeg", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 1" },
      { key: "pb", label: "P/B Ratio", desc: "Price ÷ book value per share. Useful for asset-heavy companies; < 1 may indicate undervaluation.", unit: "x", minKey: "minPb", maxKey: "maxPb", minPlaceholder: "e.g. 0.5", maxPlaceholder: "e.g. 5" },
      { key: "ps", label: "P/S Ratio", desc: "Price ÷ revenue per share. Good for unprofitable or high-growth companies.", unit: "x", minKey: "minPs", maxKey: "maxPs", minPlaceholder: "e.g. 0.5", maxPlaceholder: "e.g. 10" },
      { key: "evEbitda", label: "EV/EBITDA", desc: "Enterprise Value ÷ EBITDA. Better than P/E for comparing companies with different debt levels.", unit: "x", minKey: "minEvEbitda", maxKey: "maxEvEbitda", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "pcf", label: "P/Cash Flow", desc: "Price ÷ operating cash flow per share. Harder to manipulate than earnings.", unit: "x", minKey: "minPcf", maxKey: "maxPcf", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 30" },
      { key: "pfcf", label: "P/Free Cash Flow", desc: "Price ÷ free cash flow per share. More conservative; FCF = what's left after capex.", unit: "x", minKey: "minPfcf", maxKey: "maxPfcf", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 40" },
    ]
  },
  {
    group: "Profitability",
    metrics: [
      { key: "grossMargin", label: "Gross Margin", desc: "Gross Profit ÷ Revenue. Shows pricing power and production efficiency. Higher is better.", unit: "%", minKey: "minGrossMargin", maxKey: "maxGrossMargin", minPlaceholder: "e.g. 20", maxPlaceholder: "e.g. 80" },
      { key: "operatingMargin", label: "Operating Margin", desc: "Operating Income ÷ Revenue. Profit after operating costs but before interest and taxes.", unit: "%", minKey: "minOperatingMargin", maxKey: "maxOperatingMargin", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 40" },
      { key: "netMargin", label: "Net Profit Margin", desc: "Net Income ÷ Revenue. The bottom-line profitability after all expenses.", unit: "%", minKey: "minNetMargin", maxKey: "maxNetMargin", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 30" },
      { key: "roe", label: "ROE", desc: "Net Income ÷ Shareholders' Equity. Measures management efficiency; > 15–20% is strong for most sectors.", unit: "%", minKey: "minRoe", maxKey: "maxRoe", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 50" },
      { key: "roa", label: "ROA", desc: "Net Income ÷ Total Assets. How efficiently the company uses its assets to generate profit.", unit: "%", minKey: "minRoa", maxKey: "maxRoa", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 25" },
      { key: "roic", label: "ROIC", desc: "Return on Invested Capital. Measures how efficiently capital is allocated across the business.", unit: "%", minKey: "minRoic", maxKey: "maxRoic", minPlaceholder: "e.g. 8", maxPlaceholder: "e.g. 40" },
    ]
  },
  {
    group: "Growth",
    metrics: [
      { key: "revenueGrowth", label: "Revenue Growth (YoY)", desc: "Year-over-year revenue increase. Shows top-line business expansion.", unit: "%", minKey: "minRevenueGrowth", maxKey: "maxRevenueGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "epsGrowth", label: "EPS Growth (YoY)", desc: "Year-over-year earnings per share growth. Indicates profit expansion for shareholders.", unit: "%", minKey: "minEpsGrowth", maxKey: "maxEpsGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "ebitdaGrowth", label: "EBITDA Growth", desc: "Growth in Earnings Before Interest, Taxes, Depreciation & Amortization. Proxy for operating cash generation.", unit: "%", minKey: "minEbitdaGrowth", maxKey: "maxEbitdaGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "fcfGrowth", label: "FCF Growth", desc: "Growth in Free Cash Flow. Indicates improving ability to generate cash after reinvestment.", unit: "%", minKey: "minFcfGrowth", maxKey: "maxFcfGrowth", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 50" },
      { key: "week52Change", label: "52W Price Change", desc: "Stock price change over the past 52 weeks. Reflects market momentum and sentiment.", unit: "%", minKey: "minWeek52Change", maxKey: "maxWeek52Change", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 100" },
    ]
  },
  {
    group: "Financial Health",
    metrics: [
      { key: "deRatio", label: "D/E Ratio", desc: "Total Debt ÷ Shareholders' Equity. Lower is safer; < 1–2 preferred (varies by industry).", unit: "x", minKey: "minDe", maxKey: "maxDe", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 1.5" },
      { key: "currentRatio", label: "Current Ratio", desc: "Current Assets ÷ Current Liabilities. > 1.5 generally healthy; measures short-term liquidity.", unit: "x", minKey: "minCurrentRatio", maxKey: "maxCurrentRatio", minPlaceholder: "e.g. 1.5", maxPlaceholder: "e.g. 5" },
      { key: "quickRatio", label: "Quick Ratio", desc: "(Current Assets − Inventory) ÷ Current Liabilities. Stricter liquidity test excluding inventory.", unit: "x", minKey: "minQuickRatio", maxKey: "maxQuickRatio", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 4" },
      { key: "interestCoverage", label: "Interest Coverage", desc: "EBIT ÷ Interest Expense. > 3–5 preferred; measures ability to pay interest on debt.", unit: "x", minKey: "minInterestCoverage", maxKey: "maxInterestCoverage", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "debtEbitda", label: "Debt/EBITDA", desc: "Total Debt ÷ EBITDA. Measures leverage; lower means debt is more manageable.", unit: "x", minKey: "minDebtEbitda", maxKey: "maxDebtEbitda", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 4" },
    ]
  },
  {
    group: "Efficiency",
    metrics: [
      { key: "assetTurnover", label: "Asset Turnover", desc: "Revenue ÷ Average Total Assets. How efficiently the company uses assets to generate sales.", unit: "x", minKey: "minAssetTurnover", maxKey: "maxAssetTurnover", minPlaceholder: "e.g. 0.3", maxPlaceholder: "e.g. 2" },
      { key: "inventoryTurnover", label: "Inventory Turnover", desc: "COGS ÷ Average Inventory. Higher means inventory sells faster; low can signal slow sales.", unit: "x", minKey: "minInventoryTurnover", maxKey: "maxInventoryTurnover", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "receivablesTurnover", label: "Receivables Turnover", desc: "Revenue ÷ Average Accounts Receivable. Higher means the company collects payments faster.", unit: "x", minKey: "minReceivablesTurnover", maxKey: "maxReceivablesTurnover", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
      { key: "dso", label: "Days Sales Outstanding", desc: "Average days to collect payment after a sale. Lower is better — faster cash collection.", unit: "days", minKey: "minDso", maxKey: "maxDso", minPlaceholder: "e.g. 10", maxPlaceholder: "e.g. 60" },
    ]
  },
  {
    group: "Dividends & Returns",
    metrics: [
      { key: "dividendYield", label: "Dividend Yield", desc: "Annual Dividend ÷ Stock Price. Income generated from holding the stock.", unit: "%", minKey: "minDividendYield", maxKey: "maxDividendYield", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 8" },
      { key: "payoutRatio", label: "Payout Ratio", desc: "Dividends ÷ Net Income. Sustainable below 60–70% for most companies.", unit: "%", minKey: "minPayoutRatio", maxKey: "maxPayoutRatio", minPlaceholder: "e.g. 0", maxPlaceholder: "e.g. 60" },
      { key: "dividendGrowth", label: "Dividend Growth (5Y)", desc: "Compound annual dividend growth over 5 years. Indicates commitment to returning capital.", unit: "%", minKey: "minDividendGrowth", maxKey: "maxDividendGrowth", minPlaceholder: "e.g. 3", maxPlaceholder: "e.g. 20" },
    ]
  },
  {
    group: "Per-Share & Size",
    metrics: [
      { key: "marketCapB", label: "Market Cap", desc: "Total market value in billions. Large-cap > $10B, Mid-cap $2–10B, Small-cap < $2B.", unit: "B", minKey: "minMarketCapB", maxKey: "maxMarketCapB", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 500" },
      { key: "eps", label: "EPS (TTM)", desc: "Trailing twelve-month earnings per share. Core measure of per-share profitability.", unit: "$", minKey: "minEps", maxKey: "maxEps", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 20" },
      { key: "bookValuePerShare", label: "Book Value/Share", desc: "Net assets per share (Assets − Liabilities). Useful for comparing price to intrinsic asset value.", unit: "$", minKey: "minBookValue", maxKey: "maxBookValue", minPlaceholder: "e.g. 5", maxPlaceholder: "e.g. 100" },
      { key: "fcfPerShare", label: "FCF/Share", desc: "Free Cash Flow per share. Shows cash generated for each share after capital expenditures.", unit: "$", minKey: "minFcfPerShare", maxKey: "maxFcfPerShare", minPlaceholder: "e.g. 1", maxPlaceholder: "e.g. 50" },
    ]
  },
];

// Flat list for lookups
const ALL_METRIC_DEFS = METRIC_GROUPS.flatMap(g => g.metrics);



export default function Screener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("screener_filters") || "{}"); } catch { return {}; }
  });
  const [activeMetrics, setActiveMetrics] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("screener_metrics") || "[]")); } catch { return new Set(); }
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [savedScreens, setSavedScreens] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      base44.entities.SavedScreen.filter({ created_by_id: user.id }, "-created_date").then(setSavedScreens).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    sessionStorage.setItem("screener_filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    sessionStorage.setItem("screener_metrics", JSON.stringify([...activeMetrics]));
  }, [activeMetrics]);

  const toggleMetric = (key) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Clear related filter keys
        const def = ALL_METRIC_DEFS.find(d => d.key === key);
        if (def) setFilters(f => { const n = { ...f }; delete n[def.minKey]; delete n[def.maxKey]; return n; });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const runScreen = async (overrideFilters) => {
    const f = overrideFilters ?? filters;
    setLoading(true);
    navigate("/screener/results", { state: { loading: true, results: [] } });
    try {
      const prompt = `You are a fundamental stock screener. Return a JSON list of 12 real, publicly traded US stocks that match these criteria:
${JSON.stringify(f, null, 2)}

For each stock return realistic, approximate fundamental data for ALL of these fields (use null for unknown):
ticker, name, exchange (NASDAQ/NYSE/AMEX), sector, price, changePercent, week52Change,
pe, forwardPe, peg, pb, ps, evEbitda, pcf, pfcf,
grossMargin, operatingMargin, netMargin, roe, roa, roic,
revenueGrowth, epsGrowth, ebitdaGrowth, fcfGrowth,
deRatio, currentRatio, quickRatio, interestCoverage, debtEbitda,
assetTurnover, inventoryTurnover, receivablesTurnover, dso,
dividendYield, payoutRatio, dividendGrowth,
marketCapB, eps, bookValuePerShare, fcfPerShare

Return only real companies. Vary sectors unless filters require otherwise.
Return as JSON: { "stocks": [...] }`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            stocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ticker: { type: "string" }, name: { type: "string" }, exchange: { type: "string" }, sector: { type: "string" },
                  price: { type: "number" }, changePercent: { type: "number" }, week52Change: { type: "number" },
                  pe: { type: "number" }, forwardPe: { type: "number" }, peg: { type: "number" }, pb: { type: "number" },
                  ps: { type: "number" }, evEbitda: { type: "number" }, pcf: { type: "number" }, pfcf: { type: "number" },
                  grossMargin: { type: "number" }, operatingMargin: { type: "number" }, netMargin: { type: "number" },
                  roe: { type: "number" }, roa: { type: "number" }, roic: { type: "number" },
                  revenueGrowth: { type: "number" }, epsGrowth: { type: "number" }, ebitdaGrowth: { type: "number" }, fcfGrowth: { type: "number" },
                  deRatio: { type: "number" }, currentRatio: { type: "number" }, quickRatio: { type: "number" },
                  interestCoverage: { type: "number" }, debtEbitda: { type: "number" },
                  assetTurnover: { type: "number" }, inventoryTurnover: { type: "number" },
                  receivablesTurnover: { type: "number" }, dso: { type: "number" },
                  dividendYield: { type: "number" }, payoutRatio: { type: "number" }, dividendGrowth: { type: "number" },
                  marketCapB: { type: "number" }, eps: { type: "number" }, bookValuePerShare: { type: "number" }, fcfPerShare: { type: "number" }
                }
              }
            }
          }
        }
      });
      navigate("/screener/results", { state: { loading: false, results: res.stocks || [] } });
    } catch {
      navigate("/screener/results", { state: { loading: false, results: [] } });
    }
    setLoading(false);
  };

  const applyPreset = (preset, idx) => {
    setActivePreset(idx);
    setFilters(preset.filters);
    // Auto-activate metrics that have filter values in preset
    const metricKeys = new Set();
    ALL_METRIC_DEFS.forEach(d => {
      if (preset.filters[d.minKey] != null || preset.filters[d.maxKey] != null) metricKeys.add(d.key);
    });
    setActiveMetrics(metricKeys);
    runScreen(preset.filters);
  };

  const saveScreen = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    await base44.entities.SavedScreen.create({
      name: saveName.trim(),
      filters,
      activeMetrics: [...activeMetrics],
    });
    const updated = await base44.entities.SavedScreen.filter({ created_by_id: user?.id }, "-created_date");
    setSavedScreens(updated);
    setSaving(false);
    setSaveDialogOpen(false);
    setSaveName("");
    setToast("Screen saved!");
    setTimeout(() => setToast(null), 2500);
  };

  const loadSavedScreen = (screen) => {
    const f = screen.filters || {};
    const metrics = new Set(screen.activeMetrics || []);
    setFilters(f);
    setActiveMetrics(metrics);
    setActivePreset(null);
    runScreen(f);
  };

  const deleteSavedScreen = async (id, e) => {
    e.stopPropagation();
    await base44.entities.SavedScreen.delete(id);
    setSavedScreens(prev => prev.filter(s => s.id !== id));
  };



  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)", backgroundColor: "hsl(var(--background))" }}>
...
      <header className="border-b border-gray-100 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "hsl(var(--background))" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">Screener</h1>
              <p className="text-xs text-gray-500">Filter stocks by criteria</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5 flex-1">
        {/* Preset screens */}
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Quick Screens</Label>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {POPULAR_SCREENS.map((p, i) => (
              <FilterChip key={i} label={p.label} active={activePreset === i} onClick={() => applyPreset(p, i)} />
            ))}
          </div>

          {savedScreens.length > 0 && (
            <div className="mt-3">
              <Label className="text-xs text-gray-500 mb-2 block">Saved Screens</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {savedScreens.map(s => (
                  <div key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-3 pr-1.5 py-1 shrink-0 hover:border-gray-400 transition-colors">
                    <button onClick={() => loadSavedScreen(s)} className="text-xs font-medium whitespace-nowrap">{s.name}</button>
                    <button onClick={(e) => deleteSavedScreen(s.id, e)} className="text-muted-foreground hover:text-red-500 transition-colors p-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="border border-gray-100 rounded-2xl p-4 space-y-5" style={{ backgroundColor: "hsl(var(--card))" }}>
          <p className="font-heading font-semibold text-sm">Filters</p>

          {/* Sector */}
          <div>
            <Label className="text-xs text-gray-500 mb-2 block">Sector</Label>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="All"
                active={!filters.sector}
                onClick={() => setFilters(f => { const n = { ...f }; delete n.sector; return n; })}
              />
              {SECTORS.map(s => (
                <FilterChip
                  key={s}
                  label={s}
                  active={filters.sector === s}
                  onClick={() => setFilters(f => ({ ...f, sector: s }))}
                />
              ))}
            </div>
          </div>

          {/* Metric toggles grouped by category */}
          <div className="space-y-4">
            <Label className="text-xs text-gray-500 block">Metrics — tap to add a filter</Label>
            {METRIC_GROUPS.map(g => (
              <div key={g.group}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{g.group}</p>
                <div className="flex flex-wrap gap-2">
                  {g.metrics.map(d => (
                    <FilterChip key={d.key} label={d.label} active={activeMetrics.has(d.key)} onClick={() => toggleMetric(d.key)} tooltip={d.desc} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Expanded min/max inputs for active metrics */}
          {activeMetrics.size > 0 && (
            <div className="space-y-4 border-t border-gray-50 pt-4">
              <p className="text-xs font-semibold text-gray-500">Active Filters</p>
              {ALL_METRIC_DEFS.filter(d => activeMetrics.has(d.key)).map(d => (
                <div key={d.key}>
                  <p className="text-xs font-medium mb-2 text-gray-900">{d.label} <span className="text-gray-500 font-normal">({d.unit})</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-gray-500 mb-1 block">Min</Label>
                      <input
                        type="number" placeholder={d.minPlaceholder}
                        value={filters[d.minKey] ?? ""}
                        onChange={e => setFilters(f => ({ ...f, [d.minKey]: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full h-9 rounded-md border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500 mb-1 block">Max</Label>
                      <input
                        type="number" placeholder={d.maxPlaceholder}
                        value={filters[d.maxKey] ?? ""}
                        onChange={e => setFilters(f => ({ ...f, [d.maxKey]: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full h-9 rounded-md border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { setActivePreset(null); runScreen(); }} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Run Screen
            </Button>
            <Button variant="outline" onClick={() => { setSaveName(""); setSaveDialogOpen(true); }} disabled={loading}>
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>



        {!loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <SlidersHorizontal className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="font-heading text-lg font-semibold mb-1 text-gray-900">Find your next pick</h2>
              <p className="text-gray-500 text-sm">Set filters above or pick a quick screen to get started.</p>
          </div>
        )}
      </main>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Screen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-sm mb-1.5 block">Screen name</Label>
              <Input
                placeholder="e.g. High-growth tech"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveScreen()}
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={saveScreen} disabled={saving || !saveName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Screen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}