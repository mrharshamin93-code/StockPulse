import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import SubPageHeader from "@/components/SubPageHeader";

const PAGE_SIZE = 12;
const MAX_PAGES = 10;
const SCREENER_SESSION_KEY =
  "screener_paginated_results_v2";

function readStoredResults() {
  try {
    const stored =
      window.sessionStorage.getItem(
        "screener_last_results",
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function readStoredFilters() {
  try {
    const stored =
      window.sessionStorage.getItem(
        "screener_filters",
      );

    if (!stored) {
      return {};
    }

    const parsed =
      JSON.parse(stored);

    return (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(parsed)
    )
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeTicker(
  value,
) {
  return String(
    value || "",
  )
    .trim()
    .toUpperCase();
}

function normalizeScreenerSession(
  value,
) {
  if (
    !value ||
    value.version !== 2 ||
    !Array.isArray(
      value.pages,
    )
  ) {
    return null;
  }

  const pages =
    value.pages
      .filter(
        Array.isArray,
      )
      .map((page) =>
        page.filter(
          (stock) =>
            stock &&
            typeof stock ===
              "object",
        ),
      );

  if (
    pages.length === 0
  ) {
    return null;
  }

  const requestedPage =
    Number(
      value.currentPage,
    );

  const currentPage =
    Number.isInteger(
      requestedPage,
    )
      ? Math.min(
          pages.length,
          Math.max(
            1,
            requestedPage,
          ),
        )
      : 1;

  const filters =
    value.filters &&
    typeof value.filters ===
      "object" &&
    !Array.isArray(
      value.filters,
    )
      ? value.filters
      : {};

  return {
    version: 2,
    filters,
    pages,
    currentPage,
    hasMore:
      Boolean(
        value.hasMore,
      ) &&
      pages.length <
        MAX_PAGES,
    generatedAt:
      Number(
        value.generatedAt,
      ) || Date.now(),
  };
}

function sessionFromLocationState(
  state,
) {
  const supplied =
    normalizeScreenerSession(
      state?.screenerSession,
    );

  if (supplied) {
    return supplied;
  }

  if (
    !state?.loading &&
    Array.isArray(
      state?.results,
    )
  ) {
    return {
      version: 2,
      filters:
        state?.filters || {},
      pages: [
        state.results,
      ],
      currentPage: 1,
      hasMore:
        Boolean(
          state?.hasMore ??
            state.results
              .length > 0,
        ),
      generatedAt:
        Date.now(),
    };
  }

  return null;
}

function readStoredScreenerSession() {
  try {
    const stored =
      window.sessionStorage.getItem(
        SCREENER_SESSION_KEY,
      );

    if (!stored) {
      return null;
    }

    return normalizeScreenerSession(
      JSON.parse(stored),
    );
  } catch {
    return null;
  }
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

function formatFixed(
  value,
  digits = 2,
) {
  const parsed =
    finiteNumber(value);

  return parsed === null
    ? null
    : parsed.toFixed(digits);
}

function Metric({
  label,
  value,
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">
        {label}
      </p>

      <div className="text-xs font-semibold">
        {value ?? "—"}
      </div>
    </div>
  );
}

function ResultRow({
  stock,
  onAdd,
  adding,
  added,
}) {
  const ticker =
    String(
      stock?.ticker || "",
    )
      .trim()
      .toUpperCase();

  const change =
    finiteNumber(
      stock?.changePercent,
    );

  const week52Change =
    finiteNumber(
      stock?.week52Change,
    );

  const price =
    finiteNumber(
      stock?.price,
    );

  const changePositive =
    (change ?? 0) >= 0;

  const week52Positive =
    (week52Change ?? 0) >= 0;

  const formattedEps =
    formatFixed(
      stock?.eps,
      2,
    );

  const formattedMarketCap =
    formatFixed(
      stock?.marketCapB,
      1,
    );

  const formattedDividendYield =
    formatFixed(
      stock?.dividendYield,
      2,
    );

  const formattedRoe =
    formatFixed(
      stock?.roe,
      1,
    );

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-bold">
              {ticker}
            </span>

            {stock?.exchange && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                {stock.exchange}
              </span>
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {stock?.name || ticker}
          </p>

          {stock?.sector && (
            <p className="text-[10px] text-muted-foreground/50">
              {stock.sector}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">
            {price === null
              ? "—"
              : `$${price.toFixed(2)}`}
          </p>

          {change !== null && (
            <div
              className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                changePositive
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {changePositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}

              {changePositive
                ? "+"
                : ""}
              {change.toFixed(2)}%
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={
            adding ||
            added ||
            !ticker
          }
          onClick={() =>
            onAdd(stock)
          }
          className="min-h-[36px] shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adding
            ? "Adding…"
            : added
              ? "Added"
              : "+ Watch"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-2 sm:grid-cols-8">
        <Metric
          label="52W Chg"
          value={
            week52Change !== null ? (
              <span
                className={
                  week52Positive
                    ? "text-emerald-600"
                    : "text-red-600"
                }
              >
                {week52Positive
                  ? "+"
                  : ""}
                {week52Change.toFixed(1)}%
              </span>
            ) : null
          }
        />

        <Metric
          label="P/E"
          value={formatFixed(
            stock?.pe,
            1,
          )}
        />

        <Metric
          label="EPS"
          value={
            formattedEps !== null
              ? `$${formattedEps}`
              : null
          }
        />

        <Metric
          label="D/E"
          value={formatFixed(
            stock?.deRatio,
            2,
          )}
        />

        <Metric
          label="Mkt Cap"
          value={
            formattedMarketCap !== null
              ? `$${formattedMarketCap}B`
              : null
          }
        />

        <Metric
          label="Div Yield"
          value={
            formattedDividendYield !== null
              ? `${formattedDividendYield}%`
              : null
          }
        />

        <Metric
          label="P/B"
          value={formatFixed(
            stock?.pb,
            2,
          )}
        />

        <Metric
          label="ROE %"
          value={
            formattedRoe !== null
              ? `${formattedRoe}%`
              : null
          }
        />
      </div>
    </div>
  );
}

export default function ScreenerResults() {
  const { state } =
    useLocation();

  const { user } =
    useAuth();

  const loading =
    Boolean(
      state?.loading,
    );

  const error =
    state?.error || "";

  const [
    toast,
    setToast,
  ] = useState(null);

  const [
    addingTicker,
    setAddingTicker,
  ] = useState("");

  const [
    addedTickers,
    setAddedTickers,
  ] = useState(
    new Set(),
  );

  const [
    session,
    setSession,
  ] = useState(() => {
    const supplied =
      sessionFromLocationState(
        state,
      );

    if (supplied) {
      return supplied;
    }

    const stored =
      readStoredScreenerSession();

    if (stored) {
      return stored;
    }

    const legacyResults =
      readStoredResults();

    return {
      version: 2,
      filters:
        state?.filters ||
        readStoredFilters(),
      pages:
        legacyResults.length >
        0
          ? [
              legacyResults,
            ]
          : [],
      currentPage: 1,
      hasMore:
        legacyResults.length > 0,
      generatedAt:
        Date.now(),
    };
  });

  const [
    pageLoading,
    setPageLoading,
  ] = useState(false);

  const [
    requestedPage,
    setRequestedPage,
  ] = useState(null);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const toastTimerRef =
    useRef(null);

  const pageRequestRef =
    useRef(false);

  const results =
    useMemo(
      () =>
        session.pages[
          session.currentPage -
            1
        ] || [],
      [
        session.pages,
        session.currentPage,
      ],
    );

  const pageNumbers =
    useMemo(() => {
      const loadedCount =
        session.pages.length;

      if (
        loadedCount === 0
      ) {
        return [];
      }

      const count =
        loadedCount +
        (session.hasMore &&
        loadedCount <
          MAX_PAGES
          ? 1
          : 0);

      return Array.from(
        {
          length: count,
        },
        (
          _,
          index,
        ) => index + 1,
      );
    }, [
      session.pages.length,
      session.hasMore,
    ]);

  const canGoNext =
    session.currentPage <
      session.pages.length ||
    (
      session.currentPage ===
        session.pages.length &&
      session.hasMore &&
      session.pages.length <
        MAX_PAGES
    );

  useEffect(() => {
    return () => {
      window.clearTimeout(
        toastTimerRef.current,
      );
    };
  }, []);

  useEffect(() => {
    if (
      loading ||
      error
    ) {
      return;
    }

    const supplied =
      sessionFromLocationState(
        state,
      );

    if (supplied) {
      setSession(
        supplied,
      );

      setPageError(
        "",
      );
    }
  }, [
    state,
    loading,
    error,
  ]);

  useEffect(() => {
    if (
      loading ||
      error ||
      session.pages.length ===
        0
    ) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        SCREENER_SESSION_KEY,
        JSON.stringify(
          session,
        ),
      );

      window.sessionStorage.setItem(
        "screener_last_results",
        JSON.stringify(
          session.pages[0],
        ),
      );
    } catch {
      // Session storage is optional.
    }
  }, [
    session,
    loading,
    error,
  ]);

  const showToast = (
    message,
  ) => {
    window.clearTimeout(
      toastTimerRef.current,
    );

    setToast(
      message,
    );

    toastTimerRef.current =
      window.setTimeout(
        () => {
          setToast(null);
        },
        2500,
      );
  };

  const scrollToResults =
    () => {
      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    };

  const loadPage =
    async (
      pageNumber,
    ) => {
      if (
        !Number.isInteger(
          pageNumber,
        ) ||
        pageNumber < 1 ||
        pageNumber >
          MAX_PAGES ||
        pageLoading ||
        pageRequestRef.current
      ) {
        return;
      }

      const cached =
        session.pages[
          pageNumber - 1
        ];

      if (
        Array.isArray(
          cached,
        )
      ) {
        setSession(
          (previous) => ({
            ...previous,
            currentPage:
              pageNumber,
          }),
        );

        setPageError(
          "",
        );

        scrollToResults();

        return;
      }

      if (
        pageNumber !==
          session.pages.length +
            1 ||
        !session.hasMore
      ) {
        return;
      }

      pageRequestRef.current =
        true;

      setPageLoading(
        true,
      );

      setRequestedPage(
        pageNumber,
      );

      setPageError(
        "",
      );

      const excludedTickers = [
        ...new Set(
          session.pages
            .flat()
            .map((stock) =>
              normalizeTicker(
                stock?.ticker,
              ),
            )
            .filter(
              Boolean,
            ),
        ),
      ];

      try {
        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            "stock-screener",
            {
              body: {
                filters:
                  session.filters,
                page:
                  pageNumber,
                excludedTickers,
              },
            },
          );

        if (
          functionError
        ) {
          throw functionError;
        }

        if (
          data?.error
        ) {
          throw new Error(
            data.error,
          );
        }

        const excludedSet =
          new Set(
            excludedTickers,
          );

        const pageTickers =
          new Set();

        const nextResults =
          (
            Array.isArray(
              data?.stocks,
            )
              ? data.stocks
              : []
          ).filter(
            (stock) => {
              const ticker =
                normalizeTicker(
                  stock?.ticker,
                );

              if (
                !ticker ||
                excludedSet.has(
                  ticker,
                ) ||
                pageTickers.has(
                  ticker,
                )
              ) {
                return false;
              }

              pageTickers.add(
                ticker,
              );

              return true;
            },
          );

        if (
          nextResults.length ===
          0
        ) {
          setSession(
            (previous) => ({
              ...previous,
              hasMore:
                false,
            }),
          );

          showToast(
            "No more matching stocks were found.",
          );

          return;
        }

        setSession(
          (previous) => ({
            ...previous,
            pages: [
              ...previous.pages,
              nextResults,
            ],
            currentPage:
              pageNumber,
            hasMore:
              pageNumber <
                MAX_PAGES &&
              Boolean(
                data?.hasMore ??
                  nextResults.length > 0,
              ),
            generatedAt:
              Date.now(),
          }),
        );

        scrollToResults();
      } catch (
        pageLoadError
      ) {
        console.error(
          "Failed to load screener page:",
          pageLoadError,
        );

        const message =
          pageLoadError?.message ||
          "Unable to load this results page.";

        setPageError(
          message,
        );

        showToast(
          "Unable to load page " +
            pageNumber +
            ".",
        );
      } finally {
        pageRequestRef.current =
          false;

        setPageLoading(
          false,
        );

        setRequestedPage(
          null,
        );
      }
    };

  const addToWatchlist =
    async (stock) => {
      const ticker =
        String(
          stock?.ticker || "",
        )
          .trim()
          .toUpperCase();

      if (
        !ticker ||
        !user?.id ||
        addingTicker
      ) {
        if (!user?.id) {
          showToast(
            "Please sign in first.",
          );
        }

        return;
      }

      setAddingTicker(ticker);

      try {
        const {
          data: existingItem,
          error: existingError,
        } = await supabase
          .from(
            "watchlist_items",
          )
          .select("id")
          .eq(
            "user_id",
            user.id,
          )
          .eq(
            "ticker",
            ticker,
          )
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        if (existingItem) {
          setAddedTickers(
            (previous) =>
              new Set([
                ...previous,
                ticker,
              ]),
          );

          showToast(
            `${ticker} already in watchlist`,
          );

          return;
        }

        const {
          error: insertError,
        } = await supabase
          .from(
            "watchlist_items",
          )
          .insert({
            user_id:
              user.id,
            ticker,
            company_name:
              stock?.name ||
              ticker,
            exchange:
              stock?.exchange ||
              "",
          });

        if (insertError) {
          if (
            insertError.code ===
            "23505"
          ) {
            setAddedTickers(
              (previous) =>
                new Set([
                  ...previous,
                  ticker,
                ]),
            );

            showToast(
              `${ticker} already in watchlist`,
            );

            return;
          }

          throw insertError;
        }

        setAddedTickers(
          (previous) =>
            new Set([
              ...previous,
              ticker,
            ]),
        );

        showToast(
          `${ticker} added to watchlist`,
        );
      } catch (error) {
        console.error(
          "Failed to add screener result to watchlist:",
          error,
        );

        showToast(
          error?.message ||
            "Failed to add to watchlist",
        );
      } finally {
        setAddingTicker("");
      }
    };

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50/50"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",
      }}
    >
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <SubPageHeader
        title={
          loading
            ? ""
            : "Results · Page " +
              session.currentPage
        }
        backPath="/screener"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="mb-4 h-7 w-7 animate-spin text-muted-foreground" />

            <p className="text-sm font-semibold text-foreground">
              Please wait...
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Finding stocks that match your filters.
            </p>
          </div>
        )}

        {!loading &&
          error && (
            <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
              <p className="text-sm font-medium text-red-700">
                Unable to run screen
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          results.length ===
            0 && (
            <div className="py-24 text-center text-sm text-muted-foreground">
              No results found. Try adjusting your filters.
            </div>
          )}

        {!loading &&
          !error &&
          results.map(
            (
              stock,
              index,
            ) => {
              const ticker =
                normalizeTicker(
                  stock?.ticker,
                );

              return (
                <ResultRow
                  key={
                    (ticker ||
                      "stock") +
                    "-" +
                    index
                  }
                  stock={
                    stock
                  }
                  onAdd={
                    addToWatchlist
                  }
                  adding={
                    addingTicker ===
                    ticker
                  }
                  added={addedTickers.has(
                    ticker,
                  )}
                />
              );
            },
          )}

        {!loading &&
          !error &&
          pageError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs text-red-700">
              {pageError}
            </div>
          )}

        {!loading &&
          !error &&
          results.length >
            0 &&
          pageNumbers.length >
            1 && (
            <nav
              aria-label="Screener result pages"
              className="flex items-center justify-center gap-2 pt-4"
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={
                  session.currentPage ===
                    1 ||
                  pageLoading
                }
                onClick={() =>
                  void loadPage(
                    session.currentPage -
                      1,
                  )
                }
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Previous
                </span>
              </button>

              <div className="no-scrollbar flex max-w-[55vw] items-center gap-1 overflow-x-auto">
                {pageNumbers.map(
                  (
                    pageNumber,
                  ) => {
                    const isCurrent =
                      pageNumber ===
                      session.currentPage;

                    const isLoading =
                      pageLoading &&
                      requestedPage ===
                        pageNumber;

                    return (
                      <button
                        key={
                          pageNumber
                        }
                        type="button"
                        aria-label={
                          "Page " +
                          pageNumber
                        }
                        aria-current={
                          isCurrent
                            ? "page"
                            : undefined
                        }
                        disabled={
                          pageLoading
                        }
                        onClick={() =>
                          void loadPage(
                            pageNumber,
                          )
                        }
                        className={
                          isCurrent
                            ? "flex h-10 min-w-10 items-center justify-center rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white"
                            : "flex h-10 min-w-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          pageNumber
                        )}
                      </button>
                    );
                  },
                )}
              </div>

              <button
                type="button"
                aria-label="Next page"
                disabled={
                  !canGoNext ||
                  pageLoading
                }
                onClick={() =>
                  void loadPage(
                    session.currentPage +
                      1,
                  )
                }
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="hidden sm:inline">
                  Next
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
      </main>
    </div>
  );
}
