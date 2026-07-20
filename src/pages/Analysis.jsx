import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { POPULAR_TICKERS } from "@/lib/tickers";

async function fetchFinnhub(action, ticker) {
  const params = new URLSearchParams({
    action,
    ticker,
  });

  const response = await fetch(`/api/finnhub?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Unable to load ${action}`);
  }

  return payload;
}

function isValidAnalysis(result) {
  return Boolean(
    result &&
      typeof result.summary === "string" &&
      Array.isArray(result.pros) &&
      Array.isArray(result.cons),
  );
}

export default function Analysis() {
  const { ticker: routeTicker } = useParams();
  const [query, setQuery] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [news, setNews] = useState(null);
  const [activeTicker, setActiveTicker] = useState("");
  const [activeCompany, setActiveCompany] = useState("");
  const [quote, setQuote] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const autoRunTicker = useRef("");
  const requestId = useRef(0);

  const q = query.trim().toUpperCase();
  const suggestions = q
    ? [
        ...POPULAR_TICKERS.filter((stock) =>
          stock.ticker.toUpperCase().startsWith(q),
        ),
        ...POPULAR_TICKERS.filter(
          (stock) =>
            !stock.ticker.toUpperCase().startsWith(q) &&
            stock.name.toUpperCase().startsWith(q),
        ),
      ].slice(0, 6)
    : [];

  const runAnalysis = useCallback(async (ticker) => {
    const normalizedTicker = String(ticker || "").trim().toUpperCase();

    if (!normalizedTicker) return;

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setShowSuggestions(false);
    setLoadingInsights(true);
    setLoadingNews(true);
    setError("");
    setAnalysis(null);
    setNews(null);
    setQuote(null);

    const knownStock = POPULAR_TICKERS.find(
      (stock) => stock.ticker.toUpperCase() === normalizedTicker,
    );
    const companyName = knownStock?.name || normalizedTicker;

    setActiveTicker(normalizedTicker);
    setActiveCompany(companyName);

    const insightsCall = supabase.functions
      .invoke("stock-analysis", {
        body: {
          ticker: normalizedTicker,
          company_name: companyName,
        },
      })
      .then(({ data, error: functionError }) => {
        if (functionError) throw functionError;
        return data;
      });

    const quoteCall = fetchFinnhub("quote", normalizedTicker);
    const newsCall = fetchFinnhub("news", normalizedTicker);

    insightsCall
      .then((result) => {
        if (requestId.current !== currentRequest) return;

        if (!result?.valid) {
          setError(
            `“${normalizedTicker}” does not appear to be a valid ticker. Please try again.`,
          );
          setLoadingInsights(false);
          return;
        }

        if (!isValidAnalysis(result)) {
          throw new Error("The analysis response was incomplete");
        }

        setActiveCompany(result.company_name || companyName);
        setAnalysis(result);
        setLoadingInsights(false);
      })
      .catch((analysisError) => {
        if (requestId.current !== currentRequest) return;

        console.error("Stock analysis failed:", analysisError);
        setError("AI analysis is temporarily unavailable. Please try again.");
        setLoadingInsights(false);
      });

    quoteCall
      .then((result) => {
        if (requestId.current === currentRequest) {
          setQuote(result);
        }
      })
      .catch((quoteError) => {
        console.warn("Quote request failed:", quoteError);
      });

    newsCall
      .then((result) => {
        if (requestId.current !== currentRequest) return;

        setNews(result?.articles || []);
        setLoadingNews(false);
      })
      .catch((newsError) => {
        if (requestId.current !== currentRequest) return;

        console.warn("News request failed:", newsError);
        setNews([]);
        setLoadingNews(false);
      });
  }, []);

  useEffect(() => {
    const queryTicker = new URLSearchParams(window.location.search).get(
      "ticker",
    );
    const initialTicker = String(routeTicker || queryTicker || "")
      .trim()
      .toUpperCase();

    if (!initialTicker || autoRunTicker.current === initialTicker) return;

    autoRunTicker.current = initialTicker;
    setQuery(initialTicker);
    void runAnalysis(initialTicker);
  }, [routeTicker, runAnalysis]);

  const handleRefresh = () => {
    setQuery(activeTicker);
    void runAnalysis(activeTicker);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setShowSuggestions(false);
    void runAnalysis(q);
  };

  const isLoading = loadingInsights || loadingNews;
  const quotePrice = Number.isFinite(quote?.c) ? quote.c : null;
  const quoteChange = Number.isFinite(quote?.d) ? quote.d : null;
  const quoteChangePercent = Number.isFinite(quote?.dp) ? quote.dp : null;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <header
        className="sticky top-0 z-10 border-b border-border bg-background"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-5 text-center sm:px-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Analysis
          </h1>
          <p className="text-xs text-muted-foreground">
            Search any stock for AI insights
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center">
          {!analysis && !loadingInsights && (
            <>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 font-heading text-2xl font-bold">
                AI Stock Analysis
              </h2>
              <p className="mb-8 text-center text-sm text-muted-foreground">
                Enter any ticker to get bullish and bearish AI insights and news.
              </p>
            </>
          )}

          <form onSubmit={handleSubmit} className="relative w-full max-w-md">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="e.g. AAPL, TSLA, NVDA…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setError("");
                    setShowSuggestions(true);
                  }}
                  className="pr-3 uppercase placeholder:normal-case"
                  autoComplete="off"
                  autoCorrect="off"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                    {suggestions.map((stock) => (
                      <button
                        key={stock.ticker}
                        type="button"
                        onClick={() => {
                          setQuery(stock.ticker);
                          setShowSuggestions(false);
                          void runAnalysis(stock.ticker);
                        }}
                        className="w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted"
                      >
                        <p className="text-sm font-semibold">{stock.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {stock.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !q}
                className="min-w-[44px] gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
        </div>

        {loadingInsights && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            </div>
            <p className="mb-1 font-heading font-semibold">Analyzing {q}</p>
            <p className="text-sm text-muted-foreground">
              Generating bullish and bearish insights…
            </p>
          </div>
        )}

        {!loadingInsights && analysis && (
          <div className="space-y-6">
            <div
              className="rounded-2xl border p-6"
              style={{
                borderColor: "hsl(var(--primary) / 0.2)",
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--card)))",
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      AI Assessment
                    </span>
                  </div>
                  <p className="truncate font-heading text-lg font-bold">
                    {activeTicker} — {activeCompany}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="shrink-0 gap-1.5 text-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              {quotePrice !== null && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-heading text-2xl font-bold">
                    ${quotePrice.toFixed(2)}
                  </span>

                  {quoteChangePercent !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                        quoteChangePercent >= 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {quoteChange !== null
                        ? `${quoteChange >= 0 ? "+" : ""}${quoteChange.toFixed(2)} `
                        : ""}
                      ({quoteChangePercent >= 0 ? "+" : ""}
                      {quoteChangePercent.toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}

              <p className="text-sm leading-relaxed">{analysis.summary}</p>
              <p className="mt-3 text-[10px] text-muted-foreground">
                AI-generated insights · Not financial advice · For informational
                purposes only
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-5 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-emerald-700">
                    Bullish
                  </h2>
                </div>
                <div className="space-y-4">
                  {analysis.pros.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <p className="text-sm font-semibold text-emerald-700">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-5 flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-red-700">
                    Bearish
                  </h2>
                </div>
                <div className="space-y-4">
                  {analysis.cons.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <p className="text-sm font-semibold text-red-700">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent News
                </h2>
              </div>

              {loadingNews ? (
                <div className="flex items-center gap-3 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <p className="text-sm">Loading news sources…</p>
                </div>
              ) : news?.length ? (
                <div className="space-y-4">
                  {news.map((item, index) => (
                    <div key={`${item.url || item.title}-${index}`}>
                      <div className="flex items-start gap-3">
                        <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <div>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <p className="text-sm font-medium">{item.title}</p>
                          )}

                          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                            {item.summary}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {item.date && (
                              <p className="text-xs text-muted-foreground">
                                {item.date}
                              </p>
                            )}
                            {item.source && (
                              <>
                                {item.date && (
                                  <span className="text-xs text-muted-foreground">
                                    ·
                                  </span>
                                )}
                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-primary hover:underline"
                                  >
                                    {item.source} ↗
                                  </a>
                                ) : (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {item.source}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {index < news.length - 1 && (
                        <div className="mt-4 border-b border-border" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No recent news was found for this ticker.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
