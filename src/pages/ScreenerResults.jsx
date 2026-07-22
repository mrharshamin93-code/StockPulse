import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
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

const SCREENER_SESSION_KEY =
  "screener_server_results_v1";

const CURRENT_PAGE_KEY =
  "screener_results_current_page";

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

const SORT_OPTIONS = {
  marketCapB: {
    label:
      "Market Cap",
    sortBy:
      "marketCapB",
    sortDirection:
      "desc",
  },
  changePercent: {
    label:
      "Daily Change",
    sortBy:
      "changePercent",
    sortDirection:
      "desc",
  },
  week52Change: {
    label:
      "52W Change",
    sortBy:
      "week52Change",
    sortDirection:
      "desc",
  },
  pe: {
    label:
      "Lowest P/E",
    sortBy:
      "pe",
    sortDirection:
      "asc",
  },
  dividendYield: {
    label:
      "Dividend Yield",
    sortBy:
      "dividendYield",
    sortDirection:
      "desc",
  },
  roe: {
    label:
      "ROE",
    sortBy:
      "roe",
    sortDirection:
      "desc",
  },
};

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
    .filter(
      (stock) => {
        const ticker =
          normalizeTicker(
            stock?.ticker ||
              stock?.symbol,
          );

        if (
          !ticker ||
          seen.has(ticker)
        ) {
          return false;
        }

        seen.add(ticker);

        return true;
      },
    )
    .map(
      (stock) => ({
        ...stock,
        ticker:
          normalizeTicker(
            stock?.ticker ||
              stock?.symbol,
          ),
      }),
    );
}

function normalizeFilters(
  value,
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
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

    return normalizeFilters(
      JSON.parse(stored),
    );
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

function readStoredSession() {
  try {
    const stored =
      window.sessionStorage
        .getItem(
          SCREENER_SESSION_KEY,
        );

    if (!stored) {
      return null;
    }

    const parsed =
      JSON.parse(stored);

    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
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

function buildRequestFilters(
  baseFilters,
  selectedSector,
  positiveOnly,
) {
  const next = {
    ...normalizeFilters(
      baseFilters,
    ),
  };

  if (
    selectedSector !==
    "All"
  ) {
    delete next.sector;

    next.sectors = [
      selectedSector,
    ];
  }

  if (positiveOnly) {
    const currentMinimum =
      finiteNumber(
        next.minChangePercent,
      );

    next.minChangePercent =
      Math.max(
        currentMinimum ?? 0,
        0.000001,
      );
  }

  return next;
}

function buildPageItems(
  currentPage,
  totalPages,
) {
  if (totalPages <= 7) {
    return Array.from(
      {
        length:
          totalPages,
      },
      (
        _,
        index,
      ) =>
        index + 1,
    );
  }

  const values = [
    1,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    totalPages,
  ]
    .filter(
      (page) =>
        page >= 1 &&
        page <=
          totalPages,
    )
    .sort(
      (left, right) =>
        left - right,
    );

  const unique = [
    ...new Set(values),
  ];

  const items = [];

  unique.forEach(
    (
      page,
      index,
    ) => {
      if (
        index > 0 &&
        page -
          unique[index - 1] >
          1
      ) {
        items.push(
          `ellipsis-${page}`,
        );
      }

      items.push(page);
    },
  );

  return items;
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
  onOpen,
  adding,
  added,
}) {
  const ticker =
    normalizeTicker(
      stock?.ticker ||
        stock?.symbol,
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
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${ticker} stock details`}
      onClick={() =>
        onOpen(ticker)
      }
      onKeyDown={(event) => {
        if (
          event.key ===
            "Enter" ||
          event.key ===
            " "
        ) {
          event.preventDefault();
          onOpen(ticker);
        }
      }}
      className="cursor-pointer space-y-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-gray-200 hover:bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
    >
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
              stock?.companyName ||
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
          onClick={(event) => {
            event.stopPropagation();
            onAdd(stock);
          }}
          onKeyDown={(event) =>
            event.stopPropagation()
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
    </article>
  );
}

export default function ScreenerResults() {
  const { state } =
    useLocation();

  const navigate =
    useNavigate();

  const { user } =
    useAuth();

  const routeLoading =
    Boolean(
      state?.loading,
    );

  const routeError =
    state?.error || "";

  const storedSession =
    useMemo(
      readStoredSession,
      [],
    );

  const baseFilters =
    useMemo(
      () =>
        normalizeFilters(
          state?.filters ||
            state
              ?.screenerSession
              ?.filters ||
            storedSession
              ?.filters ||
            readStoredFilters(),
        ),
      [
        state,
        storedSession,
      ],
    );

  const initialResults =
    useMemo(
      () =>
        normalizeResults(
          Array.isArray(
            state?.results,
          )
            ? state.results
            : storedSession
                ?.results,
        ),
      [
        state,
        storedSession,
      ],
    );

  const [
    results,
    setResults,
  ] = useState(
    initialResults,
  );

  const [
    currentPage,
    setCurrentPage,
  ] = useState(() =>
    state?.filters
      ? 1
      : Math.max(
          1,
          Number(
            storedSession
              ?.pagination
              ?.page,
          ) ||
            readStoredPage(),
        ),
  );

  const [
    pagination,
    setPagination,
  ] = useState(() => ({
    page:
      currentPage,
    pageSize:
      PAGE_SIZE,
    totalResults:
      Number(
        state
          ?.pagination
          ?.totalResults ??
          storedSession
            ?.pagination
            ?.totalResults ??
          initialResults.length,
      ) || 0,
    totalPages:
      Number(
        state
          ?.pagination
          ?.totalPages ??
          storedSession
            ?.pagination
            ?.totalPages,
      ) ||
      (
        initialResults.length >
        0
          ? 1
          : 0
      ),
    hasNextPage:
      Boolean(
        state
          ?.pagination
          ?.hasNextPage ??
          storedSession
            ?.pagination
            ?.hasNextPage,
      ),
    hasPreviousPage:
      currentPage > 1,
  }));

  const [
    loading,
    setLoading,
  ] = useState(
    routeLoading ||
      initialResults.length ===
        0,
  );

  const [
    pageLoading,
    setPageLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(
    routeError,
  );

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
  ] = useState(
    storedSession
      ?.sortKey ||
      "marketCapB",
  );

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const [
    selectedSector,
    setSelectedSector,
  ] = useState(
    storedSession
      ?.selectedSector ||
      "All",
  );

  const [
    positiveOnly,
    setPositiveOnly,
  ] = useState(
    Boolean(
      storedSession
        ?.positiveOnly,
    ),
  );

  const toastTimerRef =
    useRef(null);

  const requestCounterRef =
    useRef(0);

  const pageCacheRef =
    useRef(
      new Map(),
    );

  const activeSort =
    SORT_OPTIONS[
      sortKey
    ] ||
    SORT_OPTIONS
      .marketCapB;

  const requestFilters =
    useMemo(
      () =>
        buildRequestFilters(
          baseFilters,
          selectedSector,
          positiveOnly,
        ),
      [
        baseFilters,
        selectedSector,
        positiveOnly,
      ],
    );

  const querySignature =
    useMemo(
      () =>
        JSON.stringify({
          filters:
            requestFilters,
          sortBy:
            activeSort.sortBy,
          sortDirection:
            activeSort
              .sortDirection,
          pageSize:
            PAGE_SIZE,
        }),
      [
        requestFilters,
        activeSort,
      ],
    );

  const totalPages =
    Math.max(
      0,
      Number(
        pagination
          ?.totalPages,
      ) || 0,
    );

  const totalResults =
    Math.max(
      0,
      Number(
        pagination
          ?.totalResults,
      ) || 0,
    );

  const pageItems =
    useMemo(
      () =>
        buildPageItems(
          currentPage,
          totalPages,
        ),
      [
        currentPage,
        totalPages,
      ],
    );

  const showToast =
    useCallback(
      (message) => {
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
      },
      [],
    );

  const loadPage =
    useCallback(
      async (
        requestedPage,
        {
          useCache = true,
          scroll = false,
        } = {},
      ) => {
        const safePage =
          Math.max(
            1,
            Math.trunc(
              Number(
                requestedPage,
              ),
            ) || 1,
          );

        const cacheKey =
          `${querySignature}|page:${safePage}`;

        if (
          useCache &&
          pageCacheRef
            .current
            .has(cacheKey)
        ) {
          const cached =
            pageCacheRef
              .current
              .get(cacheKey);

          setResults(
            cached.results,
          );

          setPagination(
            cached.pagination,
          );

          setCurrentPage(
            cached
              .pagination
              .page,
          );

          setLoading(false);
          setPageLoading(false);
          setError("");

          if (scroll) {
            window.scrollTo({
              top: 0,
              behavior:
                "smooth",
            });
          }

          return;
        }

        const requestId =
          requestCounterRef
            .current + 1;

        requestCounterRef.current =
          requestId;

        if (
          results.length ===
          0
        ) {
          setLoading(true);
        } else {
          setPageLoading(true);
        }

        setError("");

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
                    requestFilters,
                  page:
                    safePage,
                  pageSize:
                    PAGE_SIZE,
                  sortBy:
                    activeSort
                      .sortBy,
                  sortDirection:
                    activeSort
                      .sortDirection,
                  quoteStaleMinutes:
                    5,
                },
              },
            );

          if (
            requestId !==
            requestCounterRef
              .current
          ) {
            return;
          }

          if (functionError) {
            throw functionError;
          }

          if (
            data?.error ||
            data?.ok === false
          ) {
            throw new Error(
              data?.error ||
                "Unable to load screener results.",
            );
          }

          const nextResults =
            normalizeResults(
              data?.stocks,
            );

          const nextPagination = {
            page:
              Math.max(
                1,
                Number(
                  data
                    ?.pagination
                    ?.page,
                ) ||
                  safePage,
              ),
            pageSize:
              Math.max(
                1,
                Number(
                  data
                    ?.pagination
                    ?.pageSize,
                ) ||
                  PAGE_SIZE,
              ),
            totalResults:
              Math.max(
                0,
                Number(
                  data
                    ?.pagination
                    ?.totalResults ??
                    data?.total,
                ) || 0,
              ),
            totalPages:
              Math.max(
                0,
                Number(
                  data
                    ?.pagination
                    ?.totalPages,
                ) ||
                  (
                    Number(
                      data?.total,
                    ) > 0
                      ? Math.ceil(
                          Number(
                            data
                              ?.total,
                          ) /
                            PAGE_SIZE,
                        )
                      : 0
                  ),
              ),
            hasNextPage:
              Boolean(
                data
                  ?.pagination
                  ?.hasNextPage ??
                  data
                    ?.hasMore,
              ),
            hasPreviousPage:
              Boolean(
                data
                  ?.pagination
                  ?.hasPreviousPage ??
                  safePage > 1,
              ),
          };

          /*
           * If the database changed and a previously valid
           * page is now beyond the last page, load the new
           * final page automatically.
           */
          if (
            nextPagination
              .totalPages >
              0 &&
            safePage >
              nextPagination
                .totalPages
          ) {
            await loadPage(
              nextPagination
                .totalPages,
              {
                useCache:
                  false,
                scroll,
              },
            );

            return;
          }

          pageCacheRef
            .current
            .set(
              cacheKey,
              {
                results:
                  nextResults,
                pagination:
                  nextPagination,
              },
            );

          setResults(
            nextResults,
          );

          setPagination(
            nextPagination,
          );

          setCurrentPage(
            nextPagination
              .page,
          );

          try {
            window.sessionStorage
              .setItem(
                "screener_last_results",
                JSON.stringify(
                  nextResults,
                ),
              );

            window.sessionStorage
              .setItem(
                CURRENT_PAGE_KEY,
                String(
                  nextPagination
                    .page,
                ),
              );

            window.sessionStorage
              .setItem(
                SCREENER_SESSION_KEY,
                JSON.stringify({
                  version: 4,
                  filters:
                    baseFilters,
                  results:
                    nextResults,
                  pagination:
                    nextPagination,
                  sortKey,
                  selectedSector,
                  positiveOnly,
                  generatedAt:
                    Date.now(),
                }),
              );
          } catch {
            // Session storage is optional.
          }

          if (scroll) {
            window.scrollTo({
              top: 0,
              behavior:
                "smooth",
            });
          }
        } catch (
          loadError
        ) {
          if (
            requestId !==
            requestCounterRef
              .current
          ) {
            return;
          }

          console.error(
            "Failed to load screener page:",
            loadError,
          );

          setError(
            loadError
              ?.message ||
              "Unable to load screener results.",
          );

          if (
            results.length ===
            0
          ) {
            setResults([]);
          }
        } finally {
          if (
            requestId ===
            requestCounterRef
              .current
          ) {
            setLoading(false);
            setPageLoading(false);
          }
        }
      },
      [
        activeSort,
        baseFilters,
        positiveOnly,
        querySignature,
        requestFilters,
        results.length,
        selectedSector,
        sortKey,
      ],
    );

  useEffect(() => {
    return () => {
      window.clearTimeout(
        toastTimerRef.current,
      );

      requestCounterRef.current +=
        1;
    };
  }, []);

  /*
   * Screener.jsx starts the first request before navigating
   * here. Wait for that request to finish so two simultaneous
   * page-one requests cannot refresh the same quotes twice.
   *
   * Once the supplied first page arrives, keep it visible and
   * make one fast database request for exact count, sorting,
   * and server-pagination metadata. The quotes from the first
   * request are already fresh, so this second request normally
   * makes zero Finnhub quote calls.
   */
  useEffect(() => {
    if (routeLoading) {
      setLoading(true);
      return;
    }

    if (routeError) {
      setError(
        routeError,
      );
      setLoading(false);
      return;
    }

    if (
      Array.isArray(
        state?.results,
      )
    ) {
      setResults(
        normalizeResults(
          state.results,
        ),
      );

      setLoading(false);
    }

    pageCacheRef
      .current
      .clear();

    void loadPage(
      1,
      {
        useCache:
          false,
      },
    );
  }, [
    querySignature,
    routeLoading,
    routeError,
    state?.results,
  ]);

  const goToPage =
    useCallback(
      (pageNumber) => {
        if (
          pageLoading ||
          loading
        ) {
          return;
        }

        const nextPage =
          Math.min(
            Math.max(
              totalPages,
              1,
            ),
            Math.max(
              1,
              Number(
                pageNumber,
              ) || 1,
            ),
          );

        if (
          nextPage ===
          currentPage
        ) {
          return;
        }

        void loadPage(
          nextPage,
          {
            useCache:
              true,
            scroll:
              true,
          },
        );
      },
      [
        currentPage,
        loadPage,
        loading,
        pageLoading,
        totalPages,
      ],
    );

  const openStockDetail =
    useCallback(
      (ticker) => {
        const normalized =
          normalizeTicker(
            ticker,
          );

        if (!normalized) {
          return;
        }

        navigate(
          `/stock/ticker-${encodeURIComponent(
            normalized,
          )}`,
        );
      },
      [navigate],
    );

  const addToWatchlist =
    async (stock) => {
      const ticker =
        normalizeTicker(
          stock?.ticker ||
            stock?.symbol,
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
                stock
                  ?.companyName ||
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

  const showToolbar =
    !loading &&
    !error &&
    (
      totalResults > 0 ||
      results.length > 0
    );

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
          loading &&
          results.length === 0
            ? ""
            : `Results · ${totalResults.toLocaleString()} found`
        }
        backPath="/screener"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {showToolbar && (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
              <label className="min-w-0 flex-1">
                <span className="sr-only">
                  Sort results
                </span>

                <select
                  value={
                    sortKey
                  }
                  onChange={(event) =>
                    setSortKey(
                      event.target
                        .value,
                    )
                  }
                  className="h-10 w-full rounded-xl border-0 bg-gray-50 px-3 text-xs font-semibold text-gray-700 outline-none"
                >
                  {Object.entries(
                    SORT_OPTIONS,
                  ).map(
                    ([
                      key,
                      option,
                    ]) => (
                      <option
                        key={
                          key
                        }
                        value={
                          key
                        }
                      >
                        Sort:{" "}
                        {
                          option.label
                        }
                      </option>
                    ),
                  )}
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

                    <p className="text-[11px] text-gray-500">
                      Filters apply to the complete result set
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Close filters"
                    onClick={() =>
                      setFiltersOpen(
                        false,
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="mb-2 text-xs font-semibold text-gray-700">
                  Sector
                </p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    "All",
                    ...SECTORS,
                  ].map(
                    (sector) => (
                      <button
                        type="button"
                        key={
                          sector
                        }
                        onClick={() =>
                          setSelectedSector(
                            sector,
                          )
                        }
                        className={`min-h-9 rounded-full border px-3 text-xs font-medium ${
                          selectedSector ===
                          sector
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-700"
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
                    className="mt-3 min-h-10 w-full rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Clear result filters
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {pageLoading &&
          results.length >
            0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading page{" "}
              {currentPage}…
            </div>
          )}

        {loading &&
          results.length ===
            0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="mb-4 h-7 w-7 animate-spin text-muted-foreground" />

              <p className="text-sm font-semibold text-foreground">
                Loading results…
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Filtering the cached stock database.
              </p>
            </div>
          )}

        {!loading &&
          error && (
            <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
              <p className="text-sm font-medium text-red-700">
                Unable to load results
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadPage(
                    currentPage,
                    {
                      useCache:
                        false,
                    },
                  )
                }
                className="mt-4 min-h-10 rounded-xl bg-gray-900 px-4 text-xs font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          )}

        {!loading &&
          !error &&
          totalResults ===
            0 && (
            <div className="py-24 text-center text-sm text-muted-foreground">
              No stocks match the selected filters.
            </div>
          )}

        {!error &&
          results.map(
            (
              stock,
              index,
            ) => {
              const ticker =
                normalizeTicker(
                  stock?.ticker ||
                    stock?.symbol,
                );

              return (
                <ResultRow
                  key={`${ticker || "stock"}-${currentPage}-${index}`}
                  stock={
                    stock
                  }
                  onAdd={
                    addToWatchlist
                  }
                  onOpen={
                    openStockDetail
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
          totalPages > 1 && (
            <nav
              aria-label="Screener result pages"
              className="space-y-3 pt-4"
            >
              <p className="text-center text-xs text-gray-500">
                Page{" "}
                {currentPage.toLocaleString()}{" "}
                of{" "}
                {totalPages.toLocaleString()}
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={
                    currentPage <=
                      1 ||
                    pageLoading
                  }
                  onClick={() =>
                    goToPage(
                      currentPage -
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

                <div className="no-scrollbar flex max-w-[58vw] items-center gap-1 overflow-x-auto">
                  {pageItems.map(
                    (item) => {
                      if (
                        typeof item ===
                        "string"
                      ) {
                        return (
                          <span
                            key={
                              item
                            }
                            className="px-1 text-xs text-gray-400"
                            aria-hidden="true"
                          >
                            …
                          </span>
                        );
                      }

                      const isCurrent =
                        item ===
                        currentPage;

                      return (
                        <button
                          key={
                            item
                          }
                          type="button"
                          aria-label={`Page ${item}`}
                          aria-current={
                            isCurrent
                              ? "page"
                              : undefined
                          }
                          disabled={
                            pageLoading
                          }
                          onClick={() =>
                            goToPage(
                              item,
                            )
                          }
                          className={
                            isCurrent
                              ? "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-2 text-xs font-semibold text-white"
                              : "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          }
                        >
                          {item}
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={
                    currentPage >=
                      totalPages ||
                    pageLoading
                  }
                  onClick={() =>
                    goToPage(
                      currentPage +
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
              </div>
            </nav>
          )}
      </main>
    </div>
  );
}
