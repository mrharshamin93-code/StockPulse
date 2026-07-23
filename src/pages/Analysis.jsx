import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Database,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { POPULAR_TICKERS } from "@/lib/tickers";
import bullImage from "@/assets/StockPulse.png";

const POPULAR_SEARCHES = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "TSLA",
];

async function fetchFinnhub(
  action,
  ticker,
) {
  const params =
    new URLSearchParams({
      action,
      ticker,
    });

  const response =
    await fetch(
      `/api/finnhub?${params.toString()}`,
    );

  const payload =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        `Unable to load ${action}`,
    );
  }

  return payload;
}

function isValidAnalysis(
  result,
) {
  return Boolean(
    result &&
      typeof result.summary ===
        "string" &&
      Array.isArray(
        result.pros,
      ) &&
      Array.isArray(
        result.cons,
      ),
  );
}

function finiteNumber(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
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
    <div className="min-w-0 rounded-xl bg-gray-50 px-3 py-3">
      <p className="truncate text-[10px] font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-bold text-black">
        {value}
      </p>
    </div>
  );
}

function EmptyStateHero({
  query,
  q,
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
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-1 pb-12 pt-6 text-center sm:pt-10">
      <img
        src={bullImage}
        alt="Charging bull illustration"
        className="mb-5 h-36 w-auto object-contain sm:h-44"
      />

      <h1 className="font-heading text-4xl font-bold tracking-[-0.035em] text-black sm:text-5xl">
        AI Stock Analysis
      </h1>

      <p className="mt-4 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
        Bullish and bearish AI insights backed by verified financial metrics.
      </p>

      <form
        onSubmit={onSubmit}
        className="relative mt-8 w-full max-w-3xl"
      >
        <div className="flex min-h-[60px] items-center rounded-[22px] border border-gray-200 bg-white p-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
          <Search className="ml-4 h-5 w-5 shrink-0 text-gray-400" />

          <div className="relative min-w-0 flex-1">
            <Input
              placeholder="Enter Ticker"
              value={query}
              onChange={onQueryChange}
              className="h-12 border-0 bg-transparent px-3 text-sm uppercase text-black shadow-none placeholder:normal-case placeholder:text-gray-400 focus-visible:ring-0"
              autoComplete="off"
              autoCorrect="off"
            />

            {showSuggestions &&
              suggestions.length >
                0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-xl">
                  {suggestions.map(
                    (stock) => (
                      <button
                        key={
                          stock.ticker
                        }
                        type="button"
                        onClick={() =>
                          onSuggestionSelect(
                            stock,
                          )
                        }
                        className="w-full border-b border-gray-100 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-black">
                          {
                            stock.ticker
                          }
                        </p>

                        <p className="text-xs text-gray-500">
                          {
                            stock.name
                          }
                        </p>
                      </button>
                    ),
                  )}
                </div>
              )}
          </div>

          <Button
            type="submit"
            disabled={
              isLoading
            }
            className="h-12 shrink-0 rounded-2xl bg-black px-6 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            Analyze
            <Sparkles className="ml-1.5 h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      <div className="mt-6 flex flex-col items-center">
        <p className="text-center text-xs font-medium text-gray-500">
          Popular tickers
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
                className="min-h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                {ticker}
              </button>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

export default function Analysis() {
  const {
    ticker:
      routeTicker,
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

  const autoRunTicker =
    useRef("");

  const requestId =
    useRef(0);

  const q =
    query
      .trim()
      .toUpperCase();

  const suggestions =
    q
      ? [
          ...POPULAR_TICKERS.filter(
            (stock) =>
              stock.ticker
                .toUpperCase()
                .startsWith(q),
          ),

          ...POPULAR_TICKERS.filter(
            (stock) =>
              !stock.ticker
                .toUpperCase()
                .startsWith(q) &&
              stock.name
                .toUpperCase()
                .startsWith(q),
          ),
        ].slice(
          0,
          6,
        )
      : [];

  const runAnalysis =
    useCallback(
      async (ticker) => {
        const normalizedTicker =
          String(
            ticker || "",
          )
            .trim()
            .toUpperCase();

        if (
          !normalizedTicker
        ) {
          setError(
            "Enter a ticker to analyze.",
          );

          return;
        }

        const currentRequest =
          requestId.current +
          1;

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
          fetchFinnhub(
            "quote",
            normalizedTicker,
          );

        const newsCall =
          fetchFinnhub(
            "news",
            normalizedTicker,
          );

        insightsCall
          .then(
            (result) => {
              if (
                requestId.current !==
                currentRequest
              ) {
                return;
              }

              if (
                !result?.valid
              ) {
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
                  "The analysis response was incomplete",
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
            },
          )
          .catch(
            (
              analysisError,
            ) => {
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
          .then(
            (result) => {
              if (
                requestId.current ===
                currentRequest
              ) {
                setQuote(
                  result,
                );
              }
            },
          )
          .catch(
            (quoteError) => {
              console.warn(
                "Quote request failed:",
                quoteError,
              );
            },
          );

        newsCall
          .then(
            (result) => {
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
            },
          )
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
      ).get(
        "ticker",
      );

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

  const handleRefresh =
    () => {
      setQuery(
        activeTicker,
      );

      void runAnalysis(
        activeTicker,
      );
    };

  const handleSubmit =
    (event) => {
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
    };

  const handleSuggestionSelect =
    (stock) => {
      setQuery(
        stock.ticker,
      );

      setShowSuggestions(
        false,
      );

      void runAnalysis(
        stock.ticker,
      );
    };

  const handlePopularSelect =
    (ticker) => {
      setQuery(ticker);
      setError("");

      void runAnalysis(
        ticker,
      );
    };

  const handleBackToAnalysis =
    () => {
      requestId.current +=
        1;

      autoRunTicker.current =
        "";

      setQuery("");
      setError("");
      setAnalysis(null);
      setNews(null);
      setQuote(null);
      setActiveTicker("");
      setActiveCompany("");
      setShowSuggestions(
        false,
      );
      setLoadingInsights(
        false,
      );
      setLoadingNews(false);

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    };

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

  return (
    <div
      className="min-h-screen bg-white text-black"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",
      }}
    >
      <header
        className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-xl"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex max-w-5xl justify-center px-4 py-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>

            <h1 className="font-heading text-2xl font-bold tracking-tight text-black">
              Analysis
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {showEmptyState && (
          <EmptyStateHero
            query={query}
            q={q}
            isLoading={
              isLoading
            }
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
                event.target
                  .value,
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
              handlePopularSelect
            }
          />
        )}

        {loadingInsights && (
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-12 shadow-sm">
            <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <span className="absolute inset-0 animate-pulse rounded-2xl bg-emerald-100 blur-md" />
              <span className="absolute -inset-1 animate-ping rounded-2xl border border-emerald-200" />
              <Sparkles className="relative h-6 w-6 animate-pulse text-emerald-600" />
            </div>

            <p className="mb-1 font-heading font-semibold text-black">
              Analyzing {q}
            </p>

            <p className="text-sm text-gray-500">
              Generating bullish and bearish insights…
            </p>
          </div>
        )}

        {!loadingInsights &&
          analysis && (
            <div className="mx-auto max-w-4xl space-y-6 py-3">
              <button
                type="button"
                onClick={
                  handleBackToAnalysis
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-gray-700 transition-colors hover:text-black"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Analysis
              </button>

              <form
                onSubmit={
                  handleSubmit
                }
                className="relative w-full"
              >
                <div className="flex min-h-[54px] items-center rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                  <Search className="ml-3 h-4 w-4 shrink-0 text-gray-400" />

                  <Input
                    placeholder="Enter Ticker"
                    value={query}
                    onChange={(
                      event,
                    ) => {
                      setQuery(
                        event.target
                          .value,
                      );

                      setError("");

                      setShowSuggestions(
                        true,
                      );
                    }}
                    className="h-11 flex-1 border-0 bg-transparent px-3 uppercase shadow-none placeholder:normal-case focus-visible:ring-0"
                    autoComplete="off"
                    autoCorrect="off"
                  />

                  <Button
                    type="submit"
                    disabled={
                      isLoading
                    }
                    className="h-11 rounded-xl bg-black px-5 text-white hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    Analyze
                  </Button>
                </div>

                {showSuggestions &&
                  suggestions.length >
                    0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                      {suggestions.map(
                        (stock) => (
                          <button
                            key={
                              stock.ticker
                            }
                            type="button"
                            onClick={() =>
                              handleSuggestionSelect(
                                stock,
                              )
                            }
                            className="w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                          >
                            <p className="text-sm font-semibold text-black">
                              {
                                stock.ticker
                              }
                            </p>

                            <p className="text-xs text-gray-500">
                              {
                                stock.name
                              }
                            </p>
                          </button>
                        ),
                      )}
                    </div>
                  )}

                {error && (
                  <p className="mt-2 text-sm text-red-600">
                    {error}
                  </p>
                )}
              </form>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />

                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        AI Assessment
                      </span>
                    </div>

                    <p className="truncate font-heading text-lg font-bold text-black">
                      {activeTicker} —{" "}
                      {activeCompany}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={
                      handleRefresh
                    }
                    className="shrink-0 gap-1.5 text-gray-600"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>

                {quotePrice !==
                  null && (
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="font-heading text-2xl font-bold text-black">
                      $
                      {quotePrice.toFixed(
                        2,
                      )}
                    </span>

                    {quoteChangePercent !==
                      null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                          quoteChangePercent >=
                          0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {quoteChange !==
                        null
                          ? `${
                              quoteChange >=
                              0
                                ? "+"
                                : ""
                            }${quoteChange.toFixed(
                              2,
                            )} `
                          : ""}
                        (
                        {quoteChangePercent >=
                        0
                          ? "+"
                          : ""}
                        {quoteChangePercent.toFixed(
                          2,
                        )}
                        %)
                      </span>
                    )}
                  </div>
                )}

                <p className="text-sm leading-relaxed text-gray-700">
                  {
                    analysis.summary
                  }
                </p>

                <p className="mt-3 text-[10px] text-gray-400">
                  AI-generated insights · Not financial advice · For informational purposes only
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-600" />

                  <div>
                    <h2 className="font-heading text-sm font-bold text-black">
                      Verified Financial Metrics
                    </h2>

                    <p className="text-[10px] text-gray-400">
                      Sourced from the StockPulse database
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricCard
                    label="Market Cap"
                    value={formatMetric(
                      metrics.marketCapB,
                      {
                        prefix:
                          "$",
                        suffix:
                          "B",
                      },
                    )}
                  />

                  <MetricCard
                    label="P/E"
                    value={formatMetric(
                      metrics.pe,
                      {
                        suffix:
                          "x",
                      },
                    )}
                  />

                  <MetricCard
                    label="Revenue Growth"
                    value={formatMetric(
                      metrics.revenueGrowthYoy,
                      {
                        suffix:
                          "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="EPS Growth"
                    value={formatMetric(
                      metrics.epsGrowthYoy,
                      {
                        suffix:
                          "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="Gross Margin"
                    value={formatMetric(
                      metrics.grossMargin,
                      {
                        suffix:
                          "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="ROE"
                    value={formatMetric(
                      metrics.roe,
                      {
                        suffix:
                          "%",
                      },
                    )}
                  />

                  <MetricCard
                    label="Debt / Equity"
                    value={formatMetric(
                      metrics.debtToEquity,
                      {
                        suffix:
                          "x",
                        digits:
                          2,
                      },
                    )}
                  />

                  <MetricCard
                    label="Dividend Yield"
                    value={formatMetric(
                      metrics.dividendYield,
                      {
                        suffix:
                          "%",
                        digits:
                          2,
                      },
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-emerald-600" />

                    <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-emerald-700">
                      Bullish
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {analysis.pros.map(
                      (
                        item,
                        index,
                      ) => (
                        <div
                          key={`${item.title}-${index}`}
                        >
                          <p className="text-sm font-semibold text-emerald-700">
                            {
                              item.title
                            }
                          </p>

                          <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                            {
                              item.detail
                            }
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-red-600" />

                    <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-red-700">
                      Bearish
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {analysis.cons.map(
                      (
                        item,
                        index,
                      ) => (
                        <div
                          key={`${item.title}-${index}`}
                        >
                          <p className="text-sm font-semibold text-red-700">
                            {
                              item.title
                            }
                          </p>

                          <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                            {
                              item.detail
                            }
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-gray-500" />

                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-500">
                    Recent News
                  </h2>
                </div>

                {loadingNews ? (
                  <div className="flex items-center gap-3 py-4 text-gray-500">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />

                    <p className="text-sm">
                      Loading news sources…
                    </p>
                  </div>
                ) : news?.length ? (
                  <div className="space-y-4">
                    {news.map(
                      (
                        item,
                        index,
                      ) => (
                        <div
                          key={`${item.url || item.title}-${index}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />

                            <div>
                              {item.url ? (
                                <a
                                  href={
                                    item.url
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-black hover:underline"
                                >
                                  {
                                    item.title
                                  }
                                </a>
                              ) : (
                                <p className="text-sm font-medium text-black">
                                  {
                                    item.title
                                  }
                                </p>
                              )}

                              <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                                {
                                  item.summary
                                }
                              </p>

                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {item.date && (
                                  <p className="text-xs text-gray-400">
                                    {
                                      item.date
                                    }
                                  </p>
                                )}

                                {item.source && (
                                  <>
                                    {item.date && (
                                      <span className="text-xs text-gray-400">
                                        ·
                                      </span>
                                    )}

                                    {item.url ? (
                                      <a
                                        href={
                                          item.url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-emerald-700 hover:underline"
                                      >
                                        {
                                          item.source
                                        }{" "}
                                        ↗
                                      </a>
                                    ) : (
                                      <span className="text-xs font-medium text-gray-400">
                                        {
                                          item.source
                                        }
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {index <
                            news.length -
                              1 && (
                            <div className="mt-4 border-b border-gray-100" />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-gray-500">
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
