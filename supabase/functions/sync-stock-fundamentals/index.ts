import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const API_BASE_URL =
  "https://api.financialdatasets.ai";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const DEFAULT_STALE_HOURS = 24;
const MAX_STALE_HOURS = 24 * 30;
const REQUEST_CONCURRENCY = 5;

type UnknownRecord =
  Record<string, unknown>;

type StockQueueRow = {
  symbol: string;
};

type ProcessResult = {
  symbol: string;
  ok: boolean;
  updatedFields: number;
  error: string | null;
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function normalizeText(
  value: unknown,
) {
  return String(value ?? "")
    .trim();
}

function normalizeSymbol(
  value: unknown,
) {
  return normalizeText(value)
    .toUpperCase();
}

function finiteNumber(
  value: unknown,
): number | null {
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

function roundNumber(
  value: number | null,
  digits = 6,
): number | null {
  if (value === null) {
    return null;
  }

  const multiplier =
    10 ** digits;

  return Math.round(
    value * multiplier,
  ) / multiplier;
}

function rawNumber(
  metrics: UnknownRecord,
  key: string,
): number | null {
  return finiteNumber(
    metrics[key],
  );
}

function percentNumber(
  metrics: UnknownRecord,
  key: string,
): number | null {
  const value =
    rawNumber(metrics, key);

  return value === null
    ? null
    : roundNumber(
        value * 100,
      );
}

function billionsNumber(
  metrics: UnknownRecord,
  key: string,
): number | null {
  const value =
    rawNumber(metrics, key);

  return value === null
    ? null
    : roundNumber(
        value / 1_000_000_000,
      );
}

function inverseYieldRatio(
  metrics: UnknownRecord,
  key: string,
): number | null {
  const value =
    rawNumber(metrics, key);

  if (
    value === null ||
    value <= 0
  ) {
    return null;
  }

  return roundNumber(
    1 / value,
  );
}

function buildFundamentalsUpdate(
  metrics: UnknownRecord,
  updatedAt: string,
) {
  return {
    market_cap_b:
      billionsNumber(
        metrics,
        "market_cap",
      ),

    enterprise_value_b:
      billionsNumber(
        metrics,
        "enterprise_value",
      ),

    pe:
      roundNumber(
        rawNumber(
          metrics,
          "price_to_earnings_ratio",
        ),
      ),

    forward_pe:
      null,

    peg:
      roundNumber(
        rawNumber(
          metrics,
          "peg_ratio",
        ),
      ),

    pb:
      roundNumber(
        rawNumber(
          metrics,
          "price_to_book_ratio",
        ),
      ),

    ps:
      roundNumber(
        rawNumber(
          metrics,
          "price_to_sales_ratio",
        ),
      ),

    ev_ebitda:
      roundNumber(
        rawNumber(
          metrics,
          "enterprise_value_to_ebitda_ratio",
        ),
      ),

    pcf:
      null,

    pfcf:
      inverseYieldRatio(
        metrics,
        "free_cash_flow_yield",
      ),

    gross_margin:
      percentNumber(
        metrics,
        "gross_margin",
      ),

    operating_margin:
      percentNumber(
        metrics,
        "operating_margin",
      ),

    net_margin:
      percentNumber(
        metrics,
        "net_margin",
      ),

    roe:
      percentNumber(
        metrics,
        "return_on_equity",
      ),

    roa:
      percentNumber(
        metrics,
        "return_on_assets",
      ),

    roic:
      percentNumber(
        metrics,
        "return_on_invested_capital",
      ),

    revenue_growth_yoy:
      percentNumber(
        metrics,
        "revenue_growth",
      ),

    eps_growth_yoy:
      percentNumber(
        metrics,
        "earnings_per_share_growth",
      ),

    ebitda_growth_yoy:
      percentNumber(
        metrics,
        "ebitda_growth",
      ),

    fcf_growth_yoy:
      percentNumber(
        metrics,
        "free_cash_flow_growth",
      ),

    debt_to_equity:
      roundNumber(
        rawNumber(
          metrics,
          "debt_to_equity",
        ),
      ),

    current_ratio:
      roundNumber(
        rawNumber(
          metrics,
          "current_ratio",
        ),
      ),

    quick_ratio:
      roundNumber(
        rawNumber(
          metrics,
          "quick_ratio",
        ),
      ),

    interest_coverage:
      roundNumber(
        rawNumber(
          metrics,
          "interest_coverage",
        ),
      ),

    debt_to_ebitda:
      null,

    asset_turnover:
      roundNumber(
        rawNumber(
          metrics,
          "asset_turnover",
        ),
      ),

    inventory_turnover:
      roundNumber(
        rawNumber(
          metrics,
          "inventory_turnover",
        ),
      ),

    receivables_turnover:
      roundNumber(
        rawNumber(
          metrics,
          "receivables_turnover",
        ),
      ),

    days_sales_outstanding:
      roundNumber(
        rawNumber(
          metrics,
          "days_sales_outstanding",
        ),
      ),

    // Financial Datasets' current financial-metrics snapshot
    // does not include these fields. Clear stale legacy values.
    dividend_yield:
      null,

    payout_ratio:
      percentNumber(
        metrics,
        "payout_ratio",
      ),

    dividend_growth_5y:
      null,

    eps_ttm:
      roundNumber(
        rawNumber(
          metrics,
          "earnings_per_share",
        ),
      ),

    book_value_per_share:
      roundNumber(
        rawNumber(
          metrics,
          "book_value_per_share",
        ),
      ),

    fcf_per_share:
      roundNumber(
        rawNumber(
          metrics,
          "free_cash_flow_per_share",
        ),
      ),

    fundamentals_updated_at:
      updatedAt,
  };
}

async function fetchFinancialDatasetsMetrics(
  symbol: string,
  apiKey: string,
): Promise<UnknownRecord> {
  const url =
    new URL(
      `${API_BASE_URL}/financial-metrics/snapshot`,
    );

  url.searchParams.set(
    "ticker",
    symbol,
  );

  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json",
          "X-API-KEY":
            apiKey,
        },
      },
    );

  const text =
    await response.text();

  let payload:
    unknown = null;

  if (text) {
    try {
      payload =
        JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload ===
        "object" &&
      !Array.isArray(payload)
        ? normalizeText(
            (
              payload as UnknownRecord
            ).message ||
              (
                payload as UnknownRecord
              ).error,
          )
        : normalizeText(
            payload,
          );

    throw new Error(
      message ||
        `Financial Datasets returned status ${response.status}.`,
    );
  }

  if (
    !payload ||
    typeof payload !==
      "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "Financial Datasets returned an invalid financial-metrics snapshot.",
    );
  }

  return payload as UnknownRecord;
}

async function processInBatches<T, R>(
  values: T[],
  concurrency: number,
  worker: (
    value: T,
  ) => Promise<R>,
) {
  const results: R[] = [];

  for (
    let index = 0;
    index < values.length;
    index += concurrency
  ) {
    const batch =
      values.slice(
        index,
        index + concurrency,
      );

    const batchResults =
      await Promise.all(
        batch.map(worker),
      );

    results.push(
      ...batchResults,
    );
  }

  return results;
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    const expectedSecret =
      Deno.env.get(
        "STOCK_SYNC_SECRET",
      );

    const receivedSecret =
      request.headers.get(
        "x-sync-secret",
      );

    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Unauthorized stock fundamentals sync request.",
        },
        401,
      );
    }

    const financialDatasetsApiKey =
      Deno.env.get(
        "FINANCIAL_DATASETS_API_KEY",
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (!financialDatasetsApiKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            "FINANCIAL_DATASETS_API_KEY is not configured.",
        },
        503,
      );
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Supabase service credentials are unavailable.",
        },
        503,
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        },
      );

    const body =
      await request
        .json()
        .catch(() => ({}));

    const rawSymbols:
      unknown[] =
      Array.isArray(
        body?.symbols,
      )
        ? body.symbols
        : [];

    const requestedSymbols = [
      ...new Set(
        rawSymbols
          .map(
            normalizeSymbol,
          )
          .filter(Boolean),
      ),
    ].slice(
      0,
      MAX_BATCH_SIZE,
    );

    const requestedBatchSize =
      Math.trunc(
        Number(
          body?.batchSize,
        ),
      );

    const batchSize =
      Number.isFinite(
        requestedBatchSize,
      )
        ? Math.min(
            Math.max(
              requestedBatchSize,
              1,
            ),
            MAX_BATCH_SIZE,
          )
        : DEFAULT_BATCH_SIZE;

    const requestedStaleHours =
      Number(
        body?.staleHours,
      );

    const staleHours =
      Number.isFinite(
        requestedStaleHours,
      )
        ? Math.min(
            Math.max(
              requestedStaleHours,
              1,
            ),
            MAX_STALE_HOURS,
          )
        : DEFAULT_STALE_HOURS;

    const staleBefore =
      new Date(
        Date.now() -
          staleHours *
            60 *
            60 *
            1000,
      ).toISOString();

    const startedAt =
      new Date()
        .toISOString();

    let syncRunId:
      number | null = null;

    try {
      let stocks:
        StockQueueRow[] = [];

      if (
        requestedSymbols.length >
        0
      ) {
        stocks =
          requestedSymbols.map(
            (symbol) => ({
              symbol,
            }),
          );
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "stock_screener_stocks",
            )
            .select("symbol")
            .eq(
              "is_active",
              true,
            )
            .eq(
              "is_common_stock",
              true,
            )
            .or(
              `fundamentals_updated_at.is.null,fundamentals_updated_at.lt.${staleBefore}`,
            )
            .order(
              "fundamentals_updated_at",
              {
                ascending:
                  true,
                nullsFirst:
                  true,
              },
            )
            .order(
              "symbol",
              {
                ascending:
                  true,
              },
            )
            .limit(
              batchSize,
            );

        if (error) {
          throw new Error(
            `Could not load the fundamentals queue: ${error.message}`,
          );
        }

        stocks =
          (data ?? []) as
            StockQueueRow[];
      }

      if (
        stocks.length === 0
      ) {
        return jsonResponse({
          ok: true,
          status:
            "idle",
          message:
            "No stocks have missing or stale fundamentals.",
          staleHours,
          staleBefore,
          symbolsRequested:
            0,
          symbolsSucceeded:
            0,
          symbolsFailed:
            0,
          startedAt,
          finishedAt:
            new Date()
              .toISOString(),
        });
      }

      const {
        data: syncRun,
        error:
          syncRunError,
      } =
        await supabase
          .from(
            "stock_sync_runs",
          )
          .insert({
            job_name:
              "sync-stock-fundamentals",
            status:
              "running",
            symbols_requested:
              stocks.length,
            started_at:
              startedAt,
            metadata: {
              manualSymbols:
                requestedSymbols.length >
                0,
              batchSize:
                stocks.length,
              staleHours,
              staleBefore,
            },
          })
          .select("id")
          .maybeSingle();

      if (syncRunError) {
        console.warn(
          "Could not create fundamentals-sync log:",
          syncRunError,
        );
      } else if (
        syncRun?.id !==
          undefined &&
        syncRun?.id !== null
      ) {
        syncRunId =
          Number(
            syncRun.id,
          );
      }

      const results =
        await processInBatches(
          stocks,
          REQUEST_CONCURRENCY,
          async (
            stock,
          ): Promise<ProcessResult> => {
            const symbol =
              stock.symbol;

            try {
              const metrics =
                await fetchFinancialDatasetsMetrics(
                  symbol,
                  financialDatasetsApiKey,
                );

              const updatedAt =
                new Date()
                  .toISOString();

              const values =
                buildFundamentalsUpdate(
                  metrics,
                  updatedAt,
                );

              const {
                error:
                  updateError,
              } =
                await supabase
                  .from(
                    "stock_screener_stocks",
                  )
                  .update(values)
                  .eq(
                    "symbol",
                    symbol,
                  );

              if (updateError) {
                throw new Error(
                  updateError.message,
                );
              }

              return {
                symbol,
                ok: true,
                updatedFields:
                  Object.keys(
                    values,
                  ).length,
                error:
                  null,
              };
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unknown fundamentals-sync error.";

              console.error(
                `Fundamentals sync failed for ${symbol}: ${message}`,
              );

              return {
                symbol,
                ok: false,
                updatedFields:
                  0,
                error:
                  message,
              };
            }
          },
        );

      const succeeded =
        results.filter(
          (result) =>
            result.ok,
        );

      const failed =
        results.filter(
          (result) =>
            !result.ok,
        );

      const status =
        failed.length === 0
          ? "completed"
          : succeeded.length > 0
            ? "partial"
            : "failed";

      const finishedAt =
        new Date()
          .toISOString();

      if (
        syncRunId !== null
      ) {
        const {
          error:
            finishLogError,
        } =
          await supabase
            .from(
              "stock_sync_runs",
            )
            .update({
              status,
              symbols_processed:
                results.length,
              symbols_succeeded:
                succeeded.length,
              symbols_failed:
                failed.length,
              finished_at:
                finishedAt,
              error_message:
                failed.length > 0
                  ? failed
                      .slice(0, 5)
                      .map(
                        (result) =>
                          `${result.symbol}: ${result.error}`,
                      )
                      .join(" | ")
                      .slice(
                        0,
                        2000,
                      )
                  : null,
            })
            .eq(
              "id",
              syncRunId,
            );

        if (finishLogError) {
          console.warn(
            "Could not finish fundamentals-sync log:",
            finishLogError,
          );
        }
      }

      return jsonResponse({
        ok:
          status !==
          "failed",
        status,
        staleHours,
        staleBefore,
        symbolsRequested:
          stocks.length,
        symbolsSucceeded:
          succeeded.length,
        symbolsFailed:
          failed.length,
        failed:
          failed.slice(
            0,
            20,
          ),
        startedAt,
        finishedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown fundamentals-sync error.";

      const finishedAt =
        new Date()
          .toISOString();

      if (
        syncRunId !== null
      ) {
        const {
          error:
            finishLogError,
        } =
          await supabase
            .from(
              "stock_sync_runs",
            )
            .update({
              status:
                "failed",
              finished_at:
                finishedAt,
              error_message:
                message.slice(
                  0,
                  2000,
                ),
            })
            .eq(
              "id",
              syncRunId,
            );

        if (finishLogError) {
          console.warn(
            "Could not finish failed fundamentals-sync log:",
            finishLogError,
          );
        }
      }

      return jsonResponse(
        {
          ok: false,
          status:
            "failed",
          error:
            message,
          startedAt,
          finishedAt,
        },
        500,
      );
    }
  },
);
