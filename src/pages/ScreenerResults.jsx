import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
} from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";
import {
  useAuth,
} from "@/lib/AuthContext";
import SubPageHeader from "@/components/SubPageHeader";

const PAGE_SIZE = 12;
const RESULT_LIMIT = 48;
const SCREENER_SESSION_KEY =
  "screener_paginated_results_v2";
const CURRENT_PAGE_KEY =
  "screener_results_current_page";

function normalizeTicker(
  value,
) {
  return String(
    value || "",
  )
    .trim()
    .toUpperCase();
}

function normalizeResults(
  value,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen =
    new Set();

  return value
    .filter(
      (stock) =>
        stock &&
        typeof stock ===
          "object",
    )
    .filter((stock) => {
      const ticker =
        normalizeTicker(
          stock?.ticker,
        );

      if (
        !ticker ||
        seen.has(ticker)
      ) {
        return false;
      }

      seen.add(ticker);
      return true;
    })
    .slice(
      0,
      RESULT_LIMIT,
    );
}

function flattenSessionResults(
  value,
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  if (
    Array.isArray(
      value.results,
    )
  ) {
    return normalizeResults(
      value.results,
    );
  }

  if (
    Array.isArray(
      value.pages,
    )
  ) {
    return normalizeResults(
      value.pages.flatMap(
        (page) =>
          Array.isArray(page)
            ? page
            : [],
      ),
    );
  }

  return [];
}

function readStoredResults() {
  try {
    const stored =
      window.sessionStorage
        .getItem(
          "screener_last_results",
        );

    if (!stored) {
      return [];
    }

    return normalizeResults(
      JSON.parse(stored),
    );
  } catch {
    return [];
  }
}

function readStoredSessionResults() {
  try {
    const stored =
      window.sessionStorage
        .getItem(
          SCREENER_SESSION_KEY,
        );

    if (!stored) {
      return [];
    }

    return flattenSessionResults(
      JSON.parse(stored),
    );
  } catch {
    return [];
  }
}

function readStoredFilters() {
  try {
    const stored =
      window.sessionStorage
        .getItem(
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

function readStoredPage() {
  try {
    const parsed =
      Number(
        window.sessionStorage
          .getItem(
            CURRENT_PAGE_KEY,
          ),
      );

    return Number.isInteger(
      parsed,
    )
      ? Math.max(
          1,
          parsed,
        )
      : 1;
  } catch {
    return 1;
  }
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

function formatFixed(
  value,
  digits = 2,
) {
  const parsed =
    finiteNumber(
      value,
    );

  return parsed === null
    ? null
    : parsed.toFixed(
        digits,
      );
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
    normalizeTicker(
      stock?.ticker,
    );

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
    (week52Change ?? 0) >=
    0;

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
                {
                  stock.exchange
                }
              </span>
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {stock?.name ||
              ticker}
          </p>

          {stock?.sector && (
            <p className="text-[10px] text-muted-foreground/50">
              {
                stock.sector
              }
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">
            {price === null
              ? "—"
              : `$${price.toFixed(
                  2,
                )}`}
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
              {change.toFixed(
                2,
              )}
              %
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
            week52Change !==
            null ? (
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
                {week52Change.toFixed(
                  1,
                )}
                %
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
            formattedEps !==
            null
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
            formattedMarketCap !==
            null
              ? `$${formattedMarketCap}B`
              : null
          }
        />

        <Metric
          label="Div Yield"
          value={
            formattedDividendYield !==
            null
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
            formattedRoe !==
            null
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
    sortKey,
    setSortKey,
  ] = useState("marketCapB");

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    selectedSector,
    setSelectedSector,
  ] = useState("All");

  const [
    positiveOnly,
    setPositiveOnly,
  ] = useState(false);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(
    readStoredPage,
  );

  const toastTimerRef =
    useRef(null);

  const allResults =
    useMemo(() => {
      if (
        loading ||
        error
      ) {
        return [];
      }

      /*
       * A freshly completed screen always wins, including
       * an intentionally empty result array. This prevents
       * stale results from an older screen appearing.
       */
      if (
        Array.isArray(
          state?.results,
        )
      ) {
        return normalizeResults(
          state.results,
        );
      }

      const suppliedSession =
        flattenSessionResults(
          state
            ?.screenerSession,
        );

      if (
        suppliedSession.length >
        0
      ) {
        return suppliedSession;
      }

      const storedSession =
        readStoredSessionResults();

      if (
        storedSession.length >
        0
      ) {
        return storedSession;
      }

      return readStoredResults();
    }, [
      state,
      loading,
      error,
    ]);

  const filters =
    useMemo(
      () =>
        state?.filters ||
        state
          ?.screenerSession
          ?.filters ||
        readStoredFilters(),
      [state],
    );

  const availableSectors =
    useMemo(
      () => [
        "All",
        ...[
          ...new Set(
            allResults
              .map((stock) =>
                String(
                  stock?.sector ||
                    "",
                ).trim(),
              )
              .filter(Boolean),
          ),
        ].sort(),
      ],
      [allResults],
    );

  const filteredResults =
    useMemo(() => {
      const next =
        allResults.filter(
          (stock) => {
            const sectorMatches =
              selectedSector ===
                "All" ||
              String(
                stock?.sector ||
                  "",
              ) ===
                selectedSector;

            const change =
              finiteNumber(
                stock
                  ?.changePercent,
              );

            const directionMatches =
              !positiveOnly ||
              (change !== null &&
                change > 0);

            return (
              sectorMatches &&
              directionMatches
            );
          },
        );

      const numericSort = (
        key,
        direction = "desc",
      ) =>
        [...next].sort(
          (a, b) => {
            const left =
              finiteNumber(
                a?.[key],
              );
            const right =
              finiteNumber(
                b?.[key],
              );

            if (
              left === null &&
              right === null
            ) {
              return 0;
            }

            if (left === null) {
              return 1;
            }

            if (right === null) {
              return -1;
            }

            return direction ===
              "asc"
              ? left - right
              : right - left;
          },
        );

      switch (sortKey) {
        case "changePercent":
          return numericSort(
            "changePercent",
          );

        case "week52Change":
          return numericSort(
            "week52Change",
          );

        case "pe":
          return numericSort(
            "pe",
            "asc",
          );

        case "dividendYield":
          return numericSort(
            "dividendYield",
          );

        case "roe":
          return numericSort(
            "roe",
          );

        case "marketCapB":
        default:
          return numericSort(
            "marketCapB",
          );
      }
    }, [
      allResults,
      selectedSector,
      positiveOnly,
      sortKey,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredResults.length /
          PAGE_SIZE,
      ),
    );

  const safeCurrentPage =
    Math.min(
      totalPages,
      Math.max(
        1,
        currentPage,
      ),
    );

  const results =
    useMemo(() => {
      const start =
        (safeCurrentPage -
          1) *
        PAGE_SIZE;

      return filteredResults.slice(
        start,
        start +
          PAGE_SIZE,
      );
    }, [
      filteredResults,
      safeCurrentPage,
    ]);

  const pageNumbers =
    useMemo(
      () =>
        Array.from(
          {
            length:
              totalPages,
          },
          (
            _,
            index,
          ) => index + 1,
        ),
      [totalPages],
    );

  const resultSignature =
    useMemo(
      () =>
        allResults
          .map((stock) =>
            normalizeTicker(
              stock?.ticker,
            ),
          )
          .join("|"),
      [allResults],
    );

  useEffect(() => {
    return () => {
      window.clearTimeout(
        toastTimerRef.current,
      );
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    sortKey,
    selectedSector,
    positiveOnly,
  ]);

  useEffect(() => {
    /*
     * A different screen begins on page one. Returning to
     * the same stored result set preserves its current page.
     */
    if (!resultSignature) {
      setCurrentPage(1);
      return;
    }

    const storedResults =
      readStoredResults();

    const storedSignature =
      storedResults
        .map((stock) =>
          normalizeTicker(
            stock?.ticker,
          ),
        )
        .join("|");

    if (
      storedSignature &&
      storedSignature !==
        resultSignature
    ) {
      setCurrentPage(1);
    }
  }, [
    resultSignature,
  ]);

  useEffect(() => {
    if (
      currentPage !==
      safeCurrentPage
    ) {
      setCurrentPage(
        safeCurrentPage,
      );
    }
  }, [
    currentPage,
    safeCurrentPage,
  ]);

  useEffect(() => {
    if (
      loading ||
      error
    ) {
      return;
    }

    try {
      window.sessionStorage
        .setItem(
          "screener_last_results",
          JSON.stringify(
            allResults,
          ),
        );

      window.sessionStorage
        .setItem(
          SCREENER_SESSION_KEY,
          JSON.stringify({
            version: 3,
            filters,
            results:
              allResults,
            currentPage:
              safeCurrentPage,
            generatedAt:
              Date.now(),
          }),
        );

      window.sessionStorage
        .setItem(
          CURRENT_PAGE_KEY,
          String(
            safeCurrentPage,
          ),
        );
    } catch {
      // Session storage is optional.
    }
  }, [
    allResults,
    filters,
    loading,
    error,
    safeCurrentPage,
  ]);

  const showToast = (
    message,
  ) => {
    window.clearTimeout(
      toastTimerRef.current,
    );

    setToast(message);

    toastTimerRef.current =
      window.setTimeout(
        () => {
          setToast(null);
        },
        2500,
      );
  };

  const goToPage = (
    pageNumber,
  ) => {
    const nextPage =
      Math.min(
        totalPages,
        Math.max(
          1,
          pageNumber,
        ),
      );

    setCurrentPage(
      nextPage,
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  };

  const addToWatchlist =
    async (stock) => {
      const ticker =
        normalizeTicker(
          stock?.ticker,
        );

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

      setAddingTicker(
        ticker,
      );

      try {
        const {
          data:
            existingItem,
          error:
            existingError,
        } =
          await supabase
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

        if (
          existingError
        ) {
          throw existingError;
        }

        if (
          existingItem
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

        const {
          error:
            insertError,
        } =
          await supabase
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
                stock
                  ?.exchange ||
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
      } catch (
        addError
      ) {
        console.error(
          "Failed to add screener result to watchlist:",
          addError,
        );

        showToast(
          addError
            ?.message ||
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
            : `Results · ${filteredResults.length} found`
        }
        backPath="/screener"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {!loading &&
          !error &&
          allResults.length >
            0 && (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">
                    Sort results
                  </span>

                  <select
                    value={sortKey}
                    onChange={(event) =>
                      setSortKey(
                        event.target
                          .value,
                      )
                    }
                    className="h-10 w-full rounded-xl border-0 bg-gray-50 px-3 text-xs font-semibold text-gray-700 outline-none"
                  >
                    <option value="marketCapB">
                      Sort: Market Cap
                    </option>
                    <option value="changePercent">
                      Sort: Daily Change
                    </option>
                    <option value="week52Change">
                      Sort: 52W Change
                    </option>
                    <option value="pe">
                      Sort: Lowest P/E
                    </option>
                    <option value="dividendYield">
                      Sort: Dividend Yield
                    </option>
                    <option value="roe">
                      Sort: ROE
                    </option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setFiltersOpen(
                      (value) =>
                        !value,
                    )
                  }
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    filtersOpen ||
                    selectedSector !==
                      "All" ||
                    positiveOnly
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
              </div>

              {filtersOpen && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-950">
                        Filter results
                      </p>

                      <p className="text-[11px] text-gray-400">
                        Refine the stocks already returned
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setFiltersOpen(
                          false,
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mb-2 text-xs font-semibold text-gray-700">
                    Sector
                  </p>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {availableSectors.map(
                      (sector) => (
                        <button
                          type="button"
                          key={sector}
                          onClick={() =>
                            setSelectedSector(
                              sector,
                            )
                          }
                          className={`min-h-9 rounded-full border px-3 text-xs font-medium ${
                            selectedSector ===
                            sector
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                        >
                          {sector}
                        </button>
                      ),
                    )}
                  </div>

                  <label className="flex min-h-11 items-center justify-between rounded-xl bg-gray-50 px-3">
                    <span className="text-xs font-semibold text-gray-700">
                      Daily gainers only
                    </span>

                    <input
                      type="checkbox"
                      checked={
                        positiveOnly
                      }
                      onChange={(event) =>
                        setPositiveOnly(
                          event.target
                            .checked,
                        )
                      }
                      className="h-4 w-4 accent-gray-900"
                    />
                  </label>

                  {(selectedSector !==
                    "All" ||
                    positiveOnly) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSector(
                          "All",
                        );
                        setPositiveOnly(
                          false,
                        );
                      }}
                      className="mt-3 w-full min-h-10 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Clear result filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="mb-4 h-7 w-7 animate-spin text-muted-foreground" />

            <p className="text-sm font-semibold text-foreground">
              Please wait...
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Finding up to 48 stocks that match your filters.
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
          filteredResults.length ===
            0 && (
            <div className="py-24 text-center text-sm text-muted-foreground">
              No results match the selected result filters.
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
                  key={`${ticker || "stock"}-${(safeCurrentPage - 1) * PAGE_SIZE + index}`}
                  stock={stock}
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
          filteredResults.length >
            PAGE_SIZE && (
            <nav
              aria-label="Screener result pages"
              className="flex items-center justify-center gap-2 pt-4"
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={
                  safeCurrentPage ===
                  1
                }
                onClick={() =>
                  goToPage(
                    safeCurrentPage -
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
                      safeCurrentPage;

                    return (
                      <button
                        key={
                          pageNumber
                        }
                        type="button"
                        aria-label={`Page ${pageNumber}`}
                        aria-current={
                          isCurrent
                            ? "page"
                            : undefined
                        }
                        onClick={() =>
                          goToPage(
                            pageNumber,
                          )
                        }
                        className={
                          isCurrent
                            ? "flex h-10 min-w-10 items-center justify-center rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white"
                            : "flex h-10 min-w-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        }
                      >
                        {
                          pageNumber
                        }
                      </button>
                    );
                  },
                )}
              </div>

              <button
                type="button"
                aria-label="Next page"
                disabled={
                  safeCurrentPage ===
                  totalPages
                }
                onClick={() =>
                  goToPage(
                    safeCurrentPage +
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
