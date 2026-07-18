import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, SlidersHorizontal, Search, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const SECTORS = [
  "Technology",
  "Healthcare",
  "Finance",
  "Energy",
  "Consumer Cyclical",
  "Industrials",
  "Real Estate",
  "Utilities",
  "Materials",
  "Communication Services",
];

const POPULAR_SCREENS = [
  { label: "Large Cap Tech", filters: { sector: "Technology", minMarketCap: 10 } },
  { label: "High Dividend", filters: { minDividendYield: 3 } },
  { label: "Oversold (RSI < 30)", filters: { maxRsi: 30 } },
  { label: "Strong Momentum", filters: { minChangePercent: 5 } },
  { label: "Penny Stocks", filters: { maxPrice: 5 } },
];

export default function Screener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
  const [activeMetrics, setActiveMetrics] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [savedScreens, setSavedScreens] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("saved_screens")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setSavedScreens(data || []))
        .catch(() => {});
    }
  }, [user?.id]);

  const toggleMetric = (key) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

      const response = await fetch("/api/screener", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              stocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ticker: { type: "string" },
                    name: { type: "string" },
                    exchange: { type: "string" },
                    sector: { type: "string" },
                    price: { type: "number" },
                    changePercent: { type: "number" },
                    week52Change: { type: "number" },
                    pe: { type: "number" },
                    forwardPe: { type: "number" },
                    peg: { type: "number" },
                    pb: { type: "number" },
                    ps: { type: "number" },
                    evEbitda: { type: "number" },
                    pcf: { type: "number" },
                    pfcf: { type: "number" },
                    grossMargin: { type: "number" },
                    operatingMargin: { type: "number" },
                    netMargin: { type: "number" },
                    roe: { type: "number" },
                    roa: { type: "number" },
                    roic: { type: "number" },
                    revenueGrowth: { type: "number" },
                    epsGrowth: { type: "number" },
                    ebitdaGrowth: { type: "number" },
                    fcfGrowth: { type: "number" },
                    deRatio: { type: "number" },
                    currentRatio: { type: "number" },
                    quickRatio: { type: "number" },
                    interestCoverage: { type: "number" },
                    debtEbitda: { type: "number" },
                    assetTurnover: { type: "number" },
                    inventoryTurnover: { type: "number" },
                    receivablesTurnover: { type: "number" },
                    dso: { type: "number" },
                    dividendYield: { type: "number" },
                    payoutRatio: { type: "number" },
                    dividendGrowth: { type: "number" },
                    marketCapB: { type: "number" },
                    eps: { type: "number" },
                    bookValuePerShare: { type: "number" },
                    fcfPerShare: { type: "number" },
                  },
                },
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to run screen");
      }

      const res = await response.json();

      navigate("/screener/results", {
        state: { loading: false, results: res.stocks || [] },
      });
    } catch {
      navigate("/screener/results", { state: { loading: false, results: [] } });
    }

    setLoading(false);
  };

  const applyPreset = (preset, idx) => {
    setActivePreset(idx);
    setFilters(preset.filters);
    runScreen(preset.filters);
  };

  const saveScreen = async () => {
    if (!saveName.trim() || !user?.id) return;

    setSaving(true);

    await supabase.from("saved_screens").insert({
      user_id: user.id,
      name: saveName.trim(),
      filters,
      active_metrics: [...activeMetrics],
    });

    const { data } = await supabase
      .from("saved_screens")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setSavedScreens(data || []);
    setSaving(false);
    setSaveDialogOpen(false);
    setSaveName("");
  };

  const loadSavedScreen = (screen) => {
    const f = screen.filters || {};
    const metrics = new Set(screen.active_metrics || screen.activeMetrics || []);
    setFilters(f);
    setActiveMetrics(metrics);
    setActivePreset(null);
    runScreen(f);
  };

  const deleteSavedScreen = async (id, e) => {
    e.stopPropagation();

    await supabase.from("saved_screens").delete().eq("id", id).eq("user_id", user?.id);

    setSavedScreens((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)",
        backgroundColor: "hsl(var(--background))",
      }}
    >
      <header
        className="border-b border-gray-100 sticky top-0 z-10"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          backgroundColor: "hsl(var(--background))",
        }}
      >
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
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Quick Screens</Label>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {POPULAR_SCREENS.map((p, i) => (
              <Button
                key={i}
                variant={activePreset === i ? "default" : "outline"}
                onClick={() => applyPreset(p, i)}
                className="whitespace-nowrap"
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-gray-500 block">Saved Screens</Label>

          {savedScreens.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
              No saved screens yet.
            </div>
          ) : (
            <div className="space-y-2">
              {savedScreens.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => loadSavedScreen(screen)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{screen.name}</p>
                  </div>
                  <button
                    onClick={(e) => deleteSavedScreen(screen.id, e)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setSaveDialogOpen(true)} variant="outline" className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Save Screen
          </Button>

          <Button onClick={() => runScreen()} className="flex-1" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Run Screen
          </Button>
        </div>
      </main>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Screen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="screen-name">Screen Name</Label>
              <Input
                id="screen-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Dividend Value Stocks"
              />
            </div>

            <Button onClick={saveScreen} className="w-full" disabled={saving || !saveName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
