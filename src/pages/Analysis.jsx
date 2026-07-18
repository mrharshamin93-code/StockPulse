import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Search, Newspaper, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { POPULAR_TICKERS } from "@/lib/tickers";
import { Loader2 } from "lucide-react";

export default function Analysis() {
  const [query, setQuery] = useState("");
  const didAutoRun = useRef(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [news, setNews] = useState(null);
  const [activeTicker, setActiveTicker] = useState("");
  const [activeCompany, setActiveCompany] = useState("");
  const [quote, setQuote] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const q = query.trim().toUpperCase();
  const suggestions = q
    ? [
        ...POPULAR_TICKERS.filter(s => s.ticker.toUpperCase().startsWith(q)),
        ...POPULAR_TICKERS.filter(s => !s.ticker.toUpperCase().startsWith(q) && s.name.toUpperCase().startsWith(q)),
      ].slice(0, 6)
    : [];

  const runAnalysis = async (ticker) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setShowSuggestions(false);
    setLoadingInsights(true);
    setLoadingNews(true);
    setError("");
    setAnalysis(null);
    setNews(null);
    setQuote(null);

    const found = POPULAR_TICKERS.find(s => s.ticker.toUpperCase() === t);
    const companyName = found?.name || t;

    setActiveTicker(t);
    setActiveCompany(companyName);

    // Mock data for now
    setAnalysis({
      company_name: companyName,
      pros: [
        { title: "Strong Growth", detail: "Consistent revenue growth over the past 5 years" },
        { title: "Market Leader", detail: "Dominant position in its industry" },
      ],
      cons: [
        { title: "High Valuation", detail: "Trading at premium multiples" },
        { title: "Competition", detail: "Increasing competition from new entrants" },
      ],
      summary: `Overall positive outlook for ${companyName}. Strong fundamentals with some valuation concerns.`
    });

    setNews([
      { title: "Company beats earnings expectations", summary: "Strong quarterly results announced today.", source: "CNBC" },
      { title: "Analyst upgrades stock", summary: "Major bank raises price target.", source: "Bloomberg" },
    ]);

    setQuote({ c: 225.5, dp: 1.2 });

    setLoadingInsights(false);
    setLoadingNews(false);
  };

  useEffect(() => {
    if (didAutoRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("ticker");
    if (t) {
      didAutoRun.current = true;
      setQuery(t.toUpperCase());
      runAnalysis(t);
    }
  }, []);

  const handleRefresh = () => {
    setQuery(activeTicker);
    runAnalysis(activeTicker);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    runAnalysis(q);
  };

  const isLoading = loadingInsights || loadingNews;

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)", backgroundColor: "hsl(var(--background))" }}
    >
      <header
        className="border-b border-gray-100 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "hsl(var(--background))" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Analysis</h1>
          <p className="text-xs text-gray-500">Search any stock for AI insights</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col items-center">
          {!analysis && !loadingInsights && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-violet-500" />
              </div>
              <h2 className="font-heading text-2xl font-bold mb-2">AI Stock Analysis</h2>
              <p className="text-gray-500 text-sm mb-8 text-center">Enter any ticker to get bullish & bearish AI insights and news.</p>
            </>
          )}

          <form onSubmit={handleSubmit} className="w-full max-w-md relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="e.g. AAPL, TSLA, NVDA…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setError(""); setShowSuggestions(true); }}
                  className="uppercase placeholder:normal-case pr-3"
                  autoComplete="off"
                  autoCorrect="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.ticker}
                        type="button"
                        onClick={() => { setQuery(s.ticker); setShowSuggestions(false); runAnalysis(s.ticker); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm">{s.ticker}</p>
                          <p className="text-xs text-gray-500">{s.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" disabled={isLoading || !q} className="gap-2 min-w-[44px]">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </form>
        </div>

        {loadingInsights && (
          <div className="border border-gray-100 rounded-2xl p-12 flex flex-col items-center justify-center" style={{ backgroundColor: "hsl(var(--card))" }}>
            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-violet-500 animate-pulse" />
            </div>
            <p className="font-heading font-semibold mb-1">Analyzing {q}</p>
            <p className="text-sm text-gray-500">Generating bullish & bearish insights…</p>
          </div>
        )}

        {!loadingInsights && analysis && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    <span className="text-xs uppercase tracking-wider font-semibold text-violet-700">AI Assessment</span>
                  </div>
                  <p className="font-heading font-bold text-lg">{activeTicker} — {activeCompany}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-violet-600 hover:text-violet-800 gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </Button>
              </div>
              {quote && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold font-heading text-violet-950">${quote.c?.toFixed(2)}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${quote.dp >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {quote.dp >= 0 ? "+" : ""}{quote.d?.toFixed(2)} ({quote.dp >= 0 ? "+" : ""}{quote.dp?.toFixed(2)}%)
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed text-violet-900">{analysis.summary}</p>
              <p className="text-[10px] text-violet-400 mt-3">AI-generated insights · Not financial advice</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-100 rounded-2xl p-6" style={{ backgroundColor: "hsl(var(--card))" }}>
                <div className="flex items-center gap-2 mb-5">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-emerald-700">Bullish</h2>
                </div>
                <div className="space-y-4">
                  {analysis.pros?.map((item, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-emerald-800">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-gray-100 rounded-2xl p-6" style={{ backgroundColor: "hsl(var(--card))" }}>
                <div className="flex items-center gap-2 mb-5">
                  <ThumbsDown className="w-4 h-4 text-red-600" />
                  <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-red-700">Bearish</h2>
                </div>
                <div className="space-y-4">
                  {analysis.cons?.map((item, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-red-800">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-gray-100 rounded-2xl p-6" style={{ backgroundColor: "hsl(var(--card))" }}>
              <div className="flex items-center gap-2 mb-5">
                <Newspaper className="w-4 h-4 text-gray-400" />
                <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-gray-500">Recent News</h2>
              </div>

              {loadingNews ? (
                <div className="flex items-center gap-3 py-4 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <p className="text-sm">Loading news sources…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {news?.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                        <div>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline">{item.title}</a>
                          ) : (
                            <p className="font-medium text-sm">{item.title}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.summary}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.date && <p className="text-xs text-gray-400">{item.date}</p>}
                            {item.source && (
                              <>
                                {item.date && <span className="text-xs text-gray-300">·</span>}
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline font-medium">
                                    {item.source} ↗
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400 font-medium">{item.source}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {i < (news?.length ?? 0) - 1 && <div className="border-b border-gray-50 mt-4" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
