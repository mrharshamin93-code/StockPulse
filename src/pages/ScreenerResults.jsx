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
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import SubPageHeader from "@/components/SubPageHeader";

function readStoredResults() {
  try {
    const stored =
      window.sessionStorage.getItem(
        "screener_last_results"
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function finiteNumber(
  value
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function formatFixed(
  value,
  digits = 2
) {
  const parsed =
    finiteNumber(value);

  return parsed === null
    ? null
    : parsed.toFixed(
        digits
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
    String(
      stock?.ticker || ""
    )
      .trim()
      .toUpperCase();

  const change =
    finiteNumber(
      stock?.changePercent
    );

  const week52Change =
    finiteNumber(
      stock?.week52Change
    );

  const price =
    finiteNumber(
      stock?.price
    );

  const changePositive =
    (change ?? 0) >=
    0;

  const week52Positive =
    (week52Change ??
      0) >= 0;

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
                  2
                )}`}
          </p>

          {change !==
            null && (
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
                2
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
                  1
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
            1
          )}
        />

        <Metric
          label="EPS"
          value={
            formatFixed(
              stock?.eps,
              2
            ) !== null
              ? `$${formatFixed(
                  stock?.eps,
                  2
                )}`
              : null
          }
        />

        <Metric
          label="D/E"
          value={formatFixed(
            stock?.deRatio,
            2
          )}
        />

        <Metric
          label="Mkt Cap"
          value={
            formatFixed(
              stock?.marketCapB,
              1
            ) !== null
              ? `$${formatFixed(
                  stock?.marketCapB,
                  1
                )}B`
              : null
          }
        />

        <Metric
          label="Div Yield"
          value={
            formatFixed(
              stock?.dividendYield,
              2
            ) !== null
              ? `${formatFixed(
                  stock?.dividendYield,
                  2
                )}%`
              : null
          }
        />

        <Metric
          label="P/B"
          value={formatFixed(
            stock?.pb,
            2
          )}
        />

        <Metric
          label="ROE %"
          value={
            formatFixed(
              stock?.roe,
              1
            ) !== null
              ? `${formatFixed(
                  stock?.roe,
                  1
                )}%`
              : null
          }
        />
      </div>
    </div>
  );
}

export default function ScreenerResults() {
  const {
    state,
  } = useLocation();

  const { user } =
    useAuth();

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
    new Set()
  );

  const toastTimerRef =
    useRef(null);

  const results =
    useMemo(() => {
      if (
        Array.isArray(
          state?.results
        )
      ) {
        if (
          state.results
            .length > 0
        ) {
          return state.results;
        }

        if (
          state?.loading
        ) {
          return [];
        }

        if (
          state?.error
        ) {
          return [];
        }
      }

      return readStoredResults();
    }, [
      state?.results,
      state?.loading,
      state?.error,
    ]);

  const loading =
    Boolean(
      state?.loading
    );

  const error =
    state?.error || "";

  useEffect(() => {
    return () => {
      window.clearTimeout(
        toastTimerRef.current
      );
    };
  }, []);

  const showToast = (
    message
  ) => {
    window.clearTimeout(
      toastTimerRef.current
    );

    setToast(
      message
    );

    toastTimerRef.current =
      window.setTimeout(
        () => {
          setToast(null);
        },
        2500
      );
  };

  const addToWatchlist =
    async (
      stock
    ) => {
      const ticker =
        String(
          stock?.ticker ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        !ticker ||
        !user?.id ||
        addingTicker
      ) {
        if (
          !user?.id
        ) {
          showToast(
            "Please sign in first."
          );
        }

        return;
      }

      setAddingTicker(
        ticker
      );

      try {
        const {
          data:
            existingItem,
          error:
            existingError,
        } = await supabase
          .from(
            "watchlist_items"
          )
          .select("id")
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "ticker",
            ticker
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
              ])
          );

          showToast(
            `${ticker} already in watchlist`
          );

          return;
        }

        const {
          error:
            insertError,
        } = await supabase
          .from(
            "watchlist_items"
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

        if (
          insertError
        ) {
          if (
            insertError.code ===
            "23505"
          ) {
            setAddedTickers(
              (
                previous
              ) =>
                new Set([
                  ...previous,
                  ticker,
                ])
            );

            showToast(
              `${ticker} already in watchlist`
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
            ])
        );

        showToast(
          `${ticker} added to watchlist`
        );
      } catch (error) {
        console.error(
          "Failed to add screener result to watchlist:",
          error
        );

        showToast(
          error?.message ||
            "Failed to add to watchlist"
        );
      } finally {
        setAddingTicker(
          ""
        );
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
        title={`Results · ${results.length} found`}
        backPath="/screener"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-6 sm:px-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              index
            ) => {
              const ticker =
                String(
                  stock?.ticker ||
                    ""
                )
                  .trim()
                  .toUpperCase();

              return (
                <ResultRow
                  key={`${ticker || "stock"}-${index}`}
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
                    ticker
                  )}
                />
              );
            }
          )}
      </main>
    </div>
  );
}
