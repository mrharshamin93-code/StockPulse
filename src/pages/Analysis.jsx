import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  FileText,
  Loader2,
  Newspaper,
  PieChart,
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

const FEATURE_CARDS = [
  {
    title: "AI-Powered Insights",
    description:
      "Uncover opportunities, risks, and important business trends.",
    icon: Sparkles,
  },
  {
    title: "Financial Analysis",
    description:
      "Review financial performance, profitability, and balance-sheet strength.",
    icon: PieChart,
  },
  {
    title: "Price & Trend Analysis",
    description:
      "Understand momentum, market performance, and long-term direction.",
    icon: TrendingUp,
  },
  {
    title: "News & Sentiment",
    description:
      "See recent developments, catalysts, and market-moving news.",
    icon: FileText,
  },
];

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
    <div className="mx-auto w-full max-w-5xl">
      <section className="flex flex-col items-center px-1 pb-14 pt-5 text-center sm:pt-10">
        <div
          className="relative mb-7 flex h-44 w-full max-w-md items-center justify-center overflow-hidden sm:h-52"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-1/2 h-28 w-60 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-emerald-50 blur-2xl" />

          <div className="absolute bottom-6 left-1/2 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="absolute bottom-9 left-[30%] h-14 w-7 rounded-t-xl border border-emerald-100 bg-emerald-50 shadow-sm" />
          <div className="absolute bottom-9 left-[39%] h-24 w-7 rounded-t-xl border border-emerald-200 bg-emerald-100 shadow-sm" />
          <div className="absolute bottom-9 left-[48%] h-16 w-7 rounded-t-xl border border-emerald-200 bg-emerald-50 shadow-sm" />
          <div className="absolute bottom-9 left-[57%] h-32 w-7 rounded-t-xl border border-emerald-300 bg-emerald-500 shadow-sm" />

          <svg
            viewBox="0 0 280 130"
            className="absolute bottom-7 left-1/2 h-28 w-64 -translate-x-1/2 overflow-visible"
          >
            <path
              d="M18 103 C52 96, 61 72, 91 77 C119 82, 126 49, 155 55 C184 62, 198 38, 225 42 C246 45, 255 20, 267 13"
              fill="none"
              stroke="#16a34a"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M254 13 L267 13 L267 26"
              fill="none"
              stroke="#16a34a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="absolute left-[27%] top-[29%] flex h-20 w-20 items-center justify-center rounded-full border-[9px] border-gray-800 bg-white shadow-lg">
            <Search className="h-8 w-8 text-gray-800" />
          </div>

          <div className="absolute left-[36%] top-[57%] h-4 w-16 rotate-[42deg] rounded-full bg-gray-800 shadow-md" />

          <div className="absolute right-[23%] top-[25%] rounded-2xl border border-gray-100 bg-white px-3 py-2 text-left shadow-md">
            <p className="text-[10px] font-medium text-gray-400">
              Growth
            </p>
            <p className="text-sm font-bold text-gray-950">
              +18.4%
            </p>
          </div>
        </div>

        <h1 className="max-w-3xl font-heading text-4xl font-bold tracking-[-0.035em] text-black sm:text-5xl">
          AI Stock Analysis
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
          Advanced AI insights to help you research smarter and invest with confidence.
        </p>

        <form
          onSubmit={onSubmit}
          className="relative mt-9 w-full max-w-3xl"
        >
          <div className="flex min-h-[60px] items-center rounded-[22px] border border-gray-200 bg-white p-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.08)]">
            <Search className="ml-4 h-5 w-5 shrink-0 text-gray-400" />

            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Search any stock ticker, e.g., AAPL"
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
                isLoading ||
                !q
              }
              className="h-12 shrink-0 rounded-2xl bg-black px-6 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-300"
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

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs font-medium text-gray-500">
            Popular tickers
          </span>

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
      </section>

      <section className="border-t border-gray-100 px-1 py-12">
        <div className="mb-8 text-center">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-black">
            Powerful analysis. Clear insights.
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Everything you need to evaluate a stock, backed by AI.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map(
            ({
              title,
              description,
              icon: Icon,
            }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-[0_4px_18px_rgba(15,23,42,0.035)]"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>

                <h3 className="font-heading text-sm font-bold text-black">
                  {title}
                </h3>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  {description}
                </p>
              </div>
            ),
          )}
        </div>

        <p className="mt-10 text-center text-[11px] text-gray-400">
          AI-generated research is for informational purposes only and is not financial advice.
        </p>
      </section>
    </div>
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
                  `“${normalizedTicker}” does not appear to be a valid ticker. Please try again.`,
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
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-4 sm:px-6">
          <h1 className="font-heading text-lg font-bold tracking-tight text-black">
            AI Stock Analysis
          </h1>
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
            <div className="mx-auto max-w-4xl space-y-6 py-6">
              <form
                onSubmit={
                  handleSubmit
                }
                className="relative w-full"
              >
                <div className="flex min-h-[54px] items-center rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
                  <Search className="ml-3 h-4 w-4 shrink-0 text-gray-400" />

                  <Input
                    placeholder="Search another ticker"
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
                      isLoading ||
                      !q
                    }
                    className="h-11 rounded-xl bg-black px-5 text-white hover:bg-gray-800"
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
