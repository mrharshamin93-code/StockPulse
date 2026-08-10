// src/pages/Analysis.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Database,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

import {
  financialDatasetsRequest,
} from "@/lib/financialDatasets";

import {
  POPULAR_TICKERS,
} from "@/lib/tickers";

import bullImage from "@/assets/StockPulse.png";

const POPULAR_SEARCHES = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "TSLA",
];


async function fetchMarketData(
  action,
  ticker,
) {
  return financialDatasetsRequest({
    action,
    ticker,
  });
}

function isValidAnalysis(result) {
  return Boolean(
    result &&
      typeof result.summary ===
        "string" &&
      Array.isArray(result.pros) &&
      Array.isArray(result.cons),
  );
}

function finiteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function formatMetric(
  value,
  {
    prefix = "",
    suffix = "",
    digits = 1,
  } = {},
) {
  const parsed =
    finiteNumber(value);

  if (parsed === null) {
    return "—";
  }

  return `${prefix}${parsed.toFixed(
    digits,
  )}${suffix}`;
}


function MetricCard({
  label,
  value,
}) {
  return (
    <div className="min-w-0 rounded-[16px] border border-border/70 bg-background/55 px-3 py-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 truncate text-[14px] font-bold tracking-[-0.2px] text-foreground">
        {value}
      </p>
    </div>
  );
}

function SearchSuggestions({
  suggestions,
  onSelect,
}) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[16px] border border-border bg-card shadow-xl">
      {suggestions.map(
        (stock, index) => (
          <button
            key={`${stock.ticker}-${index}`}
            type="button"
            onClick={() =>
              onSelect(stock)
            }
            className={[
              "flex min-h-[58px] w-full items-center justify-between gap-3 px-4 text-left transition-colors active:bg-muted/60",
              index <
              suggestions.length - 1
                ? "border-b border-border/80"
                : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="text-[14px] font-bold">
                {stock.ticker}
              </p>

              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {stock.name}
              </p>
            </div>

            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ),
      )}
    </div>
  );
}

function EmptyStateHero({
  query,
  isLoading,
  error,
  suggestions,
  showSuggestions,
  onQueryChange,
  onSubmit,
  onSuggestionSelect,
  onPopularSelect,
}) {
  return (
    <section className="pt-1">
      <div className="flex flex-col items-center text-center">
        <img
          src={bullImage}
          alt="StockPulse bull"
          className="h-[118px] w-auto object-contain"
        />

        <h1 className="mt-3 text-[26px] font-bold tracking-[-0.65px]">
          AI Stock Analysis
        </h1>

        <p className="mt-2 max-w-[320px] text-[12px] leading-5 text-muted-foreground">
          Search a stock to get an AI assessment, verified financial metrics, bullish and bearish factors, and recent news.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-5"
      >
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <div className="flex h-[50px] items-center rounded-[15px] border border-border bg-card shadow-[0_2px_7px_rgba(0,0,0,0.03)]">
              <Search className="ml-3.5 h-4.5 w-4.5 shrink-0 text-muted-foreground" />

              <Input
                placeholder="Ticker or company"
                value={query}
                onChange={onQueryChange}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[14px] uppercase shadow-none placeholder:normal-case focus-visible:ring-0"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {showSuggestions ? (
              <SearchSuggestions
                suggestions={
                  suggestions
                }
                onSelect={
                  onSuggestionSelect
                }
              />
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-[50px] min-w-[86px] shrink-0 rounded-[15px] px-3 text-[12px] font-semibold"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Analyze"
            )}
          </Button>
        </div>

        {error ? (
          <p className="mt-2 px-1 text-[12px] text-red-600">
            {error}
          </p>
        ) : null}
      </form>


      <section className="mt-5">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Popular
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {POPULAR_SEARCHES.map(
            (ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() =>
                  onPopularSelect(
                    ticker,
                  )
                }
                className="h-[42px] rounded-[13px] border border-border bg-card text-[11px] font-semibold shadow-[0_2px_7px_rgba(0,0,0,0.025)] active:bg-muted"
              >
                {ticker}
              </button>
            ),
          )}
        </div>
      </section>
    </section>
  );
}

export default function Analysis() {
  const {
    ticker: routeTicker,
  } = useParams();

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    loadingInsights,
    setLoadingInsights,
  ] = useState(false);

  const [
    loadingNews,
    setLoadingNews,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    analysis,
    setAnalysis,
  ] = useState(null);

  const [
    news,
    setNews,
  ] = useState(null);

  const [
    activeTicker,
    setActiveTicker,
  ] = useState("");

  const [
    activeCompany,
    setActiveCompany,
  ] = useState("");

  const [
    quote,
    setQuote,
  ] = useState(null);

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  const [
      setRecentSearches,
  ] = useState(
    loadRecentSearches,
  );

  const autoRunTicker =
    useRef("");

  const requestId =
    useRef(0);

  const q = query
    .trim()
    .toUpperCase();

  const suggestions =
    useMemo(() => {
      if (!q) {
        return [];
      }

      const exactStarts =
        POPULAR_TICKERS.filter(
          (stock) =>
            stock.ticker
              .toUpperCase()
              .startsWith(q),
        );

      const nameStarts =
        POPULAR_TICKERS.filter(
          (stock) =>
            !stock.ticker
              .toUpperCase()
              .startsWith(q) &&
            stock.name
              .toUpperCase()
              .startsWith(q),
        );

      const nameContains =
        POPULAR_TICKERS.filter(
          (stock) =>
            !stock.ticker
              .toUpperCase()
              .startsWith(q) &&
            !stock.name
              .toUpperCase()
              .startsWith(q) &&
            stock.name
              .toUpperCase()
              .includes(q),
        );

      return [
        ...exactStarts,
        ...nameStarts,
        ...nameContains,
      ].slice(0, 6);
    }, [q]);

  const runAnalysis =
    useCallback(
      async (ticker) => {
        const normalizedTicker =
          String(
            ticker || "",
          )
            .trim()
            .toUpperCase();

        if (!normalizedTicker) {
          setError(
            "Enter a ticker to analyze.",
          );
          return;
        }

        const currentRequest =
          requestId.current + 1;

        requestId.current =
          currentRequest;

        setShowSuggestions(
          false,
        );

        setLoadingInsights(
          true,
        );

        setLoadingNews(
          true,
        );

        setError("");
        setAnalysis(null);
        setNews(null);
        setQuote(null);

        const knownStock =
          POPULAR_TICKERS.find(
            (stock) =>
              stock.ticker
                .toUpperCase() ===
              normalizedTicker,
          );

        const companyName =
          knownStock?.name ||
          normalizedTicker;

        setActiveTicker(
          normalizedTicker,
        );

        setActiveCompany(
          companyName,
        );

        const insightsCall =
          supabase.functions
            .invoke(
              "stock-analysis",
              {
                body: {
                  ticker:
                    normalizedTicker,

                  company_name:
                    companyName,
                },
              },
            )
            .then(
              ({
                data,
                error:
                  functionError,
              }) => {
                if (
                  functionError
                ) {
                  throw functionError;
                }

                return data;
              },
            );

        const quoteCall =
          fetchMarketData(
            "quote",
            normalizedTicker,
          );

        const newsCall =
          fetchMarketData(
            "news",
            normalizedTicker,
          );

        insightsCall
          .then((result) => {
            if (
              requestId.current !==
              currentRequest
            ) {
              return;
            }

            if (!result?.valid) {
              setError(
                `“${normalizedTicker}” was not found in the stock database.`,
              );

              setLoadingInsights(
                false,
              );

              return;
            }

            if (
              !isValidAnalysis(
                result,
              )
            ) {
              throw new Error(
                "The analysis response was incomplete.",
              );
            }

            setActiveCompany(
              result.company_name ||
                companyName,
            );

            setAnalysis(
              result,
            );

            setLoadingInsights(
              false,
            );
          })
          .catch(
            (analysisError) => {
              if (
                requestId.current !==
                currentRequest
              ) {
                return;
              }

              console.error(
                "Stock analysis failed:",
                analysisError,
              );

              setError(
                analysisError?.message ||
                  "AI analysis is temporarily unavailable. Please try again.",
              );

              setLoadingInsights(
                false,
              );
            },
          );

        quoteCall
          .then((result) => {
            if (
              requestId.current ===
              currentRequest
            ) {
              setQuote(result);
            }
          })
          .catch(
            (quoteError) => {
              console.warn(
                "Quote request failed:",
                quoteError,
              );
            },
          );

        newsCall
          .then((result) => {
            if (
              requestId.current !==
              currentRequest
            ) {
              return;
            }

            setNews(
              result?.articles ||
                [],
            );

            setLoadingNews(
              false,
            );
          })
          .catch(
            (newsError) => {
              if (
                requestId.current !==
                currentRequest
              ) {
                return;
              }

              console.warn(
                "News request failed:",
                newsError,
              );

              setNews([]);

              setLoadingNews(
                false,
              );
            },
          );
      },
      [],
    );

  useEffect(() => {
    const queryTicker =
      new URLSearchParams(
        window.location.search,
      ).get("ticker");

    const initialTicker =
      String(
        routeTicker ||
          queryTicker ||
          "",
      )
        .trim()
        .toUpperCase();

    if (
      !initialTicker ||
      autoRunTicker.current ===
        initialTicker
    ) {
      return;
    }

    autoRunTicker.current =
      initialTicker;

    setQuery(
      initialTicker,
    );

    void runAnalysis(
      initialTicker,
    );
  }, [
    routeTicker,
    runAnalysis,
  ]);

  function handleRefresh() {
    setQuery(
      activeTicker,
    );

    void runAnalysis(
      activeTicker,
    );
  }

  function handleSubmit(
    event,
  ) {
    event.preventDefault();

    setShowSuggestions(
      false,
    );

    if (!q) {
      setError(
        "Enter a ticker to analyze.",
      );

      return;
    }

    void runAnalysis(q);
  }

  function handleSuggestionSelect(
    stock,
  ) {
    setQuery(
      stock.ticker,
    );

    setShowSuggestions(
      false,
    );

    void runAnalysis(
      stock.ticker,
    );
  }

  function handleTickerSelect(
    ticker,
  ) {
    setQuery(ticker);
    setError("");

    void runAnalysis(
      ticker,
    );
  }

  const isLoading =
    loadingInsights ||
    loadingNews;

  const quotePrice =
    Number.isFinite(
      quote?.c,
    )
      ? quote.c
      : null;

  const quoteChange =
    Number.isFinite(
      quote?.d,
    )
      ? quote.d
      : null;

  const quoteChangePercent =
    Number.isFinite(
      quote?.dp,
    )
      ? quote.dp
      : null;

  const showEmptyState =
    !analysis &&
    !loadingInsights;

  const metrics =
    analysis?.metrics ||
    {};

  const pricePositive =
    quoteChangePercent ===
      null
      ? true
      : quoteChangePercent >=
        0;

  return (
    <div
      className="min-h-full bg-background text-foreground"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 72px)",
      }}
    >
      <header
        className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-[58px] w-full max-w-[430px] items-end justify-center px-4 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </div>

            <h1 className="text-[20px] font-bold tracking-[-0.45px]">
              Analysis
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[430px] px-4 pb-7 pt-4">
        {showEmptyState ? (
          <EmptyStateHero
            query={query}
            isLoading={isLoading}
            error={error}
            suggestions={
              suggestions
            }
            showSuggestions={
              showSuggestions
            }
            onQueryChange={(
              event,
            ) => {
              setQuery(
                event.target.value,
              );

              setError("");

              setShowSuggestions(
                true,
              );
            }}
            onSubmit={
              handleSubmit
            }
            onSuggestionSelect={
              handleSuggestionSelect
            }
            onPopularSelect={
              handleTickerSelect
            }
          />
        ) : null}

        {loadingInsights ? (
          <div className="mt-6 rounded-[22px] border border-border bg-card px-5 py-10 text-center shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>

            <p className="mt-4 text-[15px] font-semibold">
              Analyzing {q}
            </p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              Generating AI assessment…
            </p>
          </div>
        ) : null}

        {!loadingInsights &&
        analysis ? (
          <div className="space-y-5">
            <form
              onSubmit={
                handleSubmit
              }
            >
              <div className="flex items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <div className="flex h-[48px] items-center rounded-[14px] border border-border bg-card">
                    <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />

                    <Input
                      placeholder="Ticker or company"
                      value={query}
                      onChange={(
                        event,
                      ) => {
                        setQuery(
                          event.target.value,
                        );

                        setError("");

                        setShowSuggestions(
                          true,
                        );
                      }}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] uppercase shadow-none placeholder:normal-case focus-visible:ring-0"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>

                  {showSuggestions ? (
                    <SearchSuggestions
                      suggestions={
                        suggestions
                      }
                      onSelect={
                        handleSuggestionSelect
                      }
                    />
                  ) : null}
                </div>

                <Button
                  type="submit"
                  disabled={
                    isLoading
                  }
                  className="h-[48px] rounded-[14px] px-4 text-[11px]"
                >
                  Analyze
                </Button>
              </div>

              {error ? (
                <p className="mt-2 px-1 text-[12px] text-red-600">
                  {error}
                </p>
              ) : null}
            </form>

            <section className="rounded-[22px] border border-border bg-card p-4 shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />

                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-600">
                      AI Assessment
                    </p>
                  </div>

                  <h2 className="mt-1 truncate text-[18px] font-bold tracking-[-0.35px]">
                    {activeTicker}
                  </h2>

                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {activeCompany}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleRefresh
                  }
                  aria-label="Refresh analysis"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground transition-colors active:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {quotePrice !==
              null ? (
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-[30px] font-bold leading-none tracking-[-0.8px]">
                    $
                    {quotePrice.toFixed(
                      2,
                    )}
                  </p>

                  {quoteChangePercent !==
                  null ? (
                    <div
                      className={[
                        "inline-flex h-[30px] items-center gap-1 rounded-[9px] px-2.5 text-[12px] font-semibold",
                        pricePositive
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-500/10 text-red-600",
                      ].join(" ")}
                    >
                      {pricePositive ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}

                      {quoteChange !==
                      null
                        ? `${quoteChange >= 0 ? "+" : ""}${quoteChange.toFixed(2)} · `
                        : ""}

                      {quoteChangePercent >=
                      0
                        ? "+"
                        : ""}

                      {quoteChangePercent.toFixed(
                        2,
                      )}
                      %
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-4 text-[13px] leading-[1.55] text-foreground/85">
                {analysis.summary}
              </p>

              <p className="mt-3 text-[9px] text-muted-foreground">
                Not financial advice
              </p>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-1.5 px-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />

                <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Verified Metrics
                </h2>
              </div>

              <div className="rounded-[22px] border border-border bg-card p-4 shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard
                    label="Market Cap"
                    value={formatMetric(
                      metrics.marketCapB,
                      {
                        prefix: "$",
                        suffix: "B",
                      },
                    )}
                  />

                  <MetricCard
                    label="P/E"
                    value={formatMetric(
                      metrics.pe,
                      {
                        suffix: "x",
                      },
                    )}
                  />

                  <MetricCard
                    label="Revenue Growth"
                    value={formatMetric(
                      metrics.revenueGrowthYoy,
                      {
                        suffix: "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="EPS Growth"
                    value={formatMetric(
                      metrics.epsGrowthYoy,
                      {
                        suffix: "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="Gross Margin"
                    value={formatMetric(
                      metrics.grossMargin,
                      {
                        suffix: "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="ROE"
                    value={formatMetric(
                      metrics.roe,
                      {
                        suffix: "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="Debt / Equity"
                    value={formatMetric(
                      metrics.debtToEquity,
                      {
                        suffix: "x",
                        digits: 2,
                      },
                    )}
                  />

                  <MetricCard
                    label="Dividend Yield"
                    value={formatMetric(
                      metrics.dividendYield,
                      {
                        suffix: "%",
                        digits: 2,
                      },
                    )}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Investment View
              </h2>

              <div className="space-y-2">
                <div className="rounded-[22px] border border-emerald-500/20 bg-card p-4 shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-600">
                      <ThumbsUp className="h-4 w-4" />
                    </div>

                    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-emerald-600">
                      Bullish
                    </p>
                  </div>

                  <div className="space-y-3">
                    {analysis.pros.map(
                      (
                        item,
                        index,
                      ) => (
                        <div
                          key={`${item.title}-${index}`}
                        >
                          <p className="text-[13px] font-semibold text-emerald-600">
                            {item.title}
                          </p>

                          <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-red-500/20 bg-card p-4 shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-red-500/10 text-red-600">
                      <ThumbsDown className="h-4 w-4" />
                    </div>

                    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-red-600">
                      Bearish
                    </p>
                  </div>

                  <div className="space-y-3">
                    {analysis.cons.map(
                      (
                        item,
                        index,
                      ) => (
                        <div
                          key={`${item.title}-${index}`}
                        >
                          <p className="text-[13px] font-semibold text-red-600">
                            {item.title}
                          </p>

                          <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5">
                  <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />

                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    Recent News
                  </h2>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
                {loadingNews ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading news…
                  </div>
                ) : news?.length ? (
                  news.map(
                    (
                      item,
                      index,
                    ) => (
                      <a
                        key={`${item.url || item.title}-${index}`}
                        href={
                          item.url ||
                          undefined
                        }
                        target={
                          item.url
                            ? "_blank"
                            : undefined
                        }
                        rel={
                          item.url
                            ? "noreferrer"
                            : undefined
                        }
                        className={[
                          "block px-4 py-4 transition-colors active:bg-muted/50",
                          index <
                          news.length - 1
                            ? "border-b border-border/80"
                            : "",
                        ].join(" ")}
                      >
                        <h3 className="text-[13px] font-semibold leading-[1.4]">
                          {item.title}
                        </h3>

                        {item.summary ? (
                          <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                            {item.summary}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2 text-[9px] text-muted-foreground">
                          {item.source ? (
                            <span>
                              {item.source}
                            </span>
                          ) : null}

                          {item.date ? (
                            <span>
                              {item.date}
                            </span>
                          ) : null}
                        </div>
                      </a>
                    ),
                  )
                ) : (
                  <div className="px-5 py-10 text-center">
                    <Newspaper className="mx-auto h-6 w-6 text-muted-foreground/40" />

                    <p className="mt-2 text-[12px] font-medium text-muted-foreground">
                      No recent news available.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
