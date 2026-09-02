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
const QUEUE_PAGE_SIZE = 1000;
const AUTO_BACKFILL_MAX_RUNTIME_MS = 120_000;

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

function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function looksLikeFinancialMetrics(
  value: UnknownRecord,
): boolean {
  const keys = [
    "market_cap",
    "enterprise_value",
    "price_to_earnings_ratio",
    "price_to_book_ratio",
    "gross_margin",
    "operating_margin",
    "net_margin",
    "return_on_equity",
    "revenue_growth",
    "earnings_per_share",
  ];

  return keys.some(
    (key) =>
      value[key] !== undefined &&
      value[key] !== null,
  );
}

function extractFinancialMetrics(
  payload: unknown,
): UnknownRecord {
  const root =
    asRecord(payload);

  if (!root) {
    throw new Error(
      "Financial Datasets returned an invalid financial-metrics snapshot.",
    );
  }

  if (
    looksLikeFinancialMetrics(
      root,
    )
  ) {
    return root;
  }

  const directKeys = [
    "financial_metrics",
    "financialMetrics",
    "metrics",
    "snapshot",
    "data",
  ];

  for (
    const key of directKeys
  ) {
    const candidate =
      asRecord(root[key]);

    if (
      candidate &&
      looksLikeFinancialMetrics(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  // Some API wrappers place the record one level deeper
  // (for example: { data: { financial_metrics: {...} } }).
  for (
    const outerKey of directKeys
  ) {
    const outer =
      asRecord(
        root[outerKey],
      );

    if (!outer) {
      continue;
    }

    for (
      const innerKey of directKeys
    ) {
      const candidate =
        asRecord(
          outer[innerKey],
        );

      if (
        candidate &&
        looksLikeFinancialMetrics(
          candidate,
        )
      ) {
        return candidate;
      }
    }
  }

  const topLevelKeys =
    Object.keys(root)
      .slice(0, 20)
      .join(", ");

  throw new Error(
    `Financial Datasets response did not contain a recognizable metrics object. Top-level keys: ${topLevelKeys || "(none)"}`,
  );
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

  const metrics =
    extractFinancialMetrics(
      payload,
    );

  // Safety guard: never overwrite a valid screener row with a
  // fully-null fundamentals payload if the provider response shape
  // changes again.
  if (
    !looksLikeFinancialMetrics(
      metrics,
    )
  ) {
    throw new Error(
      `No usable financial metrics were returned for ${symbol}.`,
    );
  }

  return metrics;
}

function extractTickerSet(
  payload: unknown,
): Set<string> {
  const result =
    new Set<string>();

  const addValue = (
    value: unknown,
  ) => {
    if (
      typeof value === "string"
    ) {
      const symbol =
        normalizeSymbol(value);

      if (symbol) {
        result.add(symbol);
      }

      return;
    }

    const record =
      asRecord(value);

    if (!record) {
      return;
    }

    const symbol =
      normalizeSymbol(
        record.ticker ??
          record.symbol,
      );

    if (symbol) {
      result.add(symbol);
    }
  };

  const visitCandidate = (
    value: unknown,
  ) => {
    if (
      Array.isArray(value)
    ) {
      for (
        const item of value
      ) {
        addValue(item);
      }

      return;
    }

    const record =
      asRecord(value);

    if (!record) {
      return;
    }

    const keys = [
      "tickers",
      "symbols",
      "data",
      "results",
    ];

    for (
      const key of keys
    ) {
      const nested =
        record[key];

      if (
        Array.isArray(nested)
      ) {
        for (
          const item of nested
        ) {
          addValue(item);
        }
      } else {
        const nestedRecord =
          asRecord(nested);

        if (nestedRecord) {
          visitCandidate(
            nestedRecord,
          );
        }
      }
    }
  };

  visitCandidate(payload);

  if (
    result.size === 0
  ) {
    throw new Error(
      "Financial Datasets returned an empty or unrecognized supported-ticker list.",
    );
  }

  return result;
}

async function fetchSupportedFinancialMetricsTickers(
  apiKey: string,
): Promise<Set<string>> {
  const url =
    `${API_BASE_URL}/financial-metrics/snapshot/tickers`;

  const response =
    await fetch(
      url,
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
        `Could not load Financial Datasets supported tickers (status ${response.status}).`,
    );
  }

  return extractTickerSet(
    payload,
  );
}

async function loadSupportedFundamentalsQueue(
  supabase: any,
  supportedTickers: Set<string>,
  staleBefore: string,
  batchSize: number,
  excludedSymbols:
    Set<string> = new Set(),
): Promise<{
  stocks: StockQueueRow[];
  rowsScanned: number;
  unsupportedSkipped: number;
}> {
  const stocks:
    StockQueueRow[] = [];

  let rowsScanned = 0;
  let unsupportedSkipped = 0;
  let offset = 0;

  while (
    stocks.length <
    batchSize
  ) {
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
        .range(
          offset,
          offset +
            QUEUE_PAGE_SIZE -
            1,
        );

    if (error) {
      throw new Error(
        `Could not load the fundamentals queue: ${error.message}`,
      );
    }

    const rows =
      (data ?? []) as
        StockQueueRow[];

    if (
      rows.length === 0
    ) {
      break;
    }

    for (
      const row of rows
    ) {
      const symbol =
        normalizeSymbol(
          row.symbol,
        );

      rowsScanned += 1;

      if (
        !symbol ||
        !supportedTickers.has(
          symbol,
        )
      ) {
        unsupportedSkipped +=
          1;
        continue;
      }

      if (
        excludedSymbols.has(
          symbol,
        )
      ) {
        continue;
      }

      stocks.push({
        symbol,
      });

      if (
        stocks.length >=
        batchSize
      ) {
        break;
      }
    }

    if (
      stocks.length >=
        batchSize ||
      rows.length <
        QUEUE_PAGE_SIZE
    ) {
      break;
    }

    offset +=
      QUEUE_PAGE_SIZE;
  }

  return {
    stocks,
    rowsScanned,
    unsupportedSkipped,
  };
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
        : requestedSymbols.length > 0
          ? DEFAULT_BATCH_SIZE
          : MAX_BATCH_SIZE;

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

    const backfillAll =
      requestedSymbols.length ===
        0 &&
      body?.backfillAll === true;

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

    const startedAtMs =
      Date.now();

    let syncRunId:
      number | null = null;

    try {
      const supportedTickers =
        requestedSymbols.length === 0
          ? await fetchSupportedFinancialMetricsTickers(
              financialDatasetsApiKey,
            )
          : null;

      const attemptedThisRun =
        new Set<string>();

      const allResults:
        ProcessResult[] = [];

      let totalRowsScanned =
        0;

      let totalUnsupportedSkipped =
        0;

      let batchesProcessed =
        0;

      let stoppedForRuntime =
        false;

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
              requestedSymbols.length,
            started_at:
              startedAt,
            metadata: {
              manualSymbols:
                requestedSymbols.length >
                0,
              backfillAll,
              batchSize,
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

      while (true) {
        let stocks:
          StockQueueRow[] = [];

        if (
          requestedSymbols.length >
          0
        ) {
          if (
            batchesProcessed >
            0
          ) {
            break;
          }

          stocks =
            requestedSymbols.map(
              (symbol) => ({
                symbol,
              }),
            );
        } else {
          const queue =
            await loadSupportedFundamentalsQueue(
              supabase,
              supportedTickers!,
              staleBefore,
              batchSize,
              attemptedThisRun,
            );

          stocks =
            queue.stocks;

          totalRowsScanned +=
            queue.rowsScanned;

          totalUnsupportedSkipped +=
            queue.unsupportedSkipped;

          console.log(
            `Fundamentals queue batch ${batchesProcessed + 1}: ${queue.rowsScanned} stale rows scanned, ${queue.unsupportedSkipped} unsupported symbols skipped, ${stocks.length} supported symbols selected.`,
          );
        }

        if (
          stocks.length === 0
        ) {
          break;
        }

        for (
          const stock of stocks
        ) {
          attemptedThisRun.add(
            stock.symbol,
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

        allResults.push(
          ...results,
        );

        batchesProcessed +=
          1;

        if (
          requestedSymbols.length >
          0 ||
          !backfillAll
        ) {
          break;
        }

        if (
          Date.now() -
            startedAtMs >=
          AUTO_BACKFILL_MAX_RUNTIME_MS
        ) {
          stoppedForRuntime =
            true;
          break;
        }
      }

      const succeeded =
        allResults.filter(
          (result) =>
            result.ok,
        );

      const failed =
        allResults.filter(
          (result) =>
            !result.ok,
        );

      let remainingSupportedStale =
        false;

      if (
        requestedSymbols.length ===
          0 &&
        supportedTickers
      ) {
        const remainingQueue =
          await loadSupportedFundamentalsQueue(
            supabase,
            supportedTickers,
            staleBefore,
            1,
            attemptedThisRun,
          );

        remainingSupportedStale =
          remainingQueue
            .stocks
            .length >
          0;

        totalRowsScanned +=
          remainingQueue.rowsScanned;

        totalUnsupportedSkipped +=
          remainingQueue.unsupportedSkipped;
      }

      let status:
        "idle" |
        "completed" |
        "partial" |
        "failed" |
        "continue";

      if (
        allResults.length ===
        0
      ) {
        status =
          "idle";
      } else if (
        stoppedForRuntime &&
        remainingSupportedStale
      ) {
        status =
          "continue";
      } else if (
        failed.length ===
        0
      ) {
        status =
          "completed";
      } else if (
        succeeded.length >
        0
      ) {
        status =
          "partial";
      } else {
        status =
          "failed";
      }

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
              symbols_requested:
                allResults.length,
              symbols_processed:
                allResults.length,
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
              metadata: {
                manualSymbols:
                  requestedSymbols.length >
                  0,
                backfillAll,
                batchSize,
                staleHours,
                staleBefore,
                batchesProcessed,
                rowsScanned:
                  totalRowsScanned,
                unsupportedSkipped:
                  totalUnsupportedSkipped,
                stoppedForRuntime,
                remainingSupportedStale,
              },
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

      const message =
        status === "idle"
          ? "No Financial Datasets-supported stocks have missing or stale fundamentals."
          : status === "continue"
            ? "Automatic backfill stopped before the Edge Function runtime limit. Invoke the same request again to continue."
            : backfillAll &&
                !remainingSupportedStale
              ? "Automatic fundamentals backfill finished."
              : undefined;

      return jsonResponse({
        ok:
          status !==
          "failed",
        status,
        message,
        backfillAll,
        staleHours,
        staleBefore,
        batchSize,
        batchesProcessed,
        symbolsRequested:
          allResults.length,
        symbolsSucceeded:
          succeeded.length,
        symbolsFailed:
          failed.length,
        rowsScanned:
          totalRowsScanned,
        unsupportedSkipped:
          totalUnsupportedSkipped,
        remainingSupportedStale,
        stoppedForRuntime,
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
