import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const DEFAULT_STALE_MINUTES = 20;
const MAX_STALE_MINUTES = 1_440;
const REQUEST_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

type UnknownRecord = Record<string, unknown>;

type StockQueueRow = {
  symbol: string;
};

type QuoteValues = {
  price?: number;
  change_amount?: number;
  change_percent?: number;
  open_price?: number;
  day_high?: number;
  day_low?: number;
  previous_close?: number;
  market_timestamp?: string;
  quote_checked_at: string;
  quote_updated_at: string;
  quote_error: null;
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

function unixTimestampToIso(
  value: unknown,
): string | null {
  const timestamp =
    finiteNumber(value);

  if (
    timestamp === null ||
    timestamp <= 0
  ) {
    return null;
  }

  const date =
    new Date(
      timestamp * 1000,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
}

async function delay(
  milliseconds: number,
) {
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function fetchFinnhubQuote(
  symbol: string,
  apiKey: string,
): Promise<QuoteValues> {
  let lastError:
    Error | null = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

    try {
      const url =
        new URL(
          "https://finnhub.io/api/v1/quote",
        );

      url.searchParams.set(
        "symbol",
        symbol,
      );

      const response =
        await fetch(
          url,
          {
            headers: {
              "X-Finnhub-Token":
                apiKey,
            },
            signal:
              controller.signal,
          },
        );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (
        response.status === 429 &&
        attempt < MAX_RETRIES
      ) {
        await delay(
          1_200 *
            (attempt + 1),
        );

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Finnhub quote request failed with status ${response.status}.`,
        );
      }

      if (
        !payload ||
        typeof payload !==
          "object"
      ) {
        throw new Error(
          "Finnhub returned an invalid quote payload.",
        );
      }

      const quote =
        payload as UnknownRecord;

      const price =
        finiteNumber(
          quote.c,
        );

      const previousClose =
        finiteNumber(
          quote.pc,
        );

      if (
        (
          price === null ||
          price <= 0
        ) &&
        (
          previousClose === null ||
          previousClose <= 0
        )
      ) {
        throw new Error(
          "Finnhub returned no usable quote.",
        );
      }

      const checkedAt =
        new Date()
          .toISOString();

      const values:
        QuoteValues = {
          quote_checked_at:
            checkedAt,
          quote_updated_at:
            checkedAt,
          quote_error:
            null,
        };

      const changeAmount =
        finiteNumber(
          quote.d,
        );

      const changePercent =
        finiteNumber(
          quote.dp,
        );

      const openPrice =
        finiteNumber(
          quote.o,
        );

      const dayHigh =
        finiteNumber(
          quote.h,
        );

      const dayLow =
        finiteNumber(
          quote.l,
        );

      const marketTimestamp =
        unixTimestampToIso(
          quote.t,
        );

      if (price !== null) {
        values.price =
          price;
      }

      if (
        changeAmount !== null
      ) {
        values.change_amount =
          changeAmount;
      }

      if (
        changePercent !== null
      ) {
        values.change_percent =
          changePercent;
      }

      if (
        openPrice !== null
      ) {
        values.open_price =
          openPrice;
      }

      if (
        dayHigh !== null
      ) {
        values.day_high =
          dayHigh;
      }

      if (
        dayLow !== null
      ) {
        values.day_low =
          dayLow;
      }

      if (
        previousClose !== null
      ) {
        values.previous_close =
          previousClose;
      }

      if (marketTimestamp) {
        values.market_timestamp =
          marketTimestamp;
      }

      return values;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              "Unknown Finnhub quote error.",
            );

      if (
        attempt < MAX_RETRIES
      ) {
        await delay(
          800 *
            (attempt + 1),
        );
      }
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "Finnhub quote request failed.",
    )
  );
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
            "Unauthorized stock quote sync request.",
        },
        401,
      );
    }

    const finnhubApiKey =
      Deno.env.get(
        "FINNHUB_API_KEY",
      );

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (!finnhubApiKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            "FINNHUB_API_KEY is not configured.",
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

    const requestedSymbols =
      Array.isArray(
        body?.symbols,
      )
        ? [
            ...new Set(
              body.symbols
                .map(
                  normalizeSymbol,
                )
                .filter(Boolean),
            ),
          ].slice(
            0,
            MAX_BATCH_SIZE,
          )
        : [];

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

    const requestedStaleMinutes =
      Number(
        body?.staleMinutes,
      );

    const staleMinutes =
      Number.isFinite(
        requestedStaleMinutes,
      )
        ? Math.min(
            Math.max(
              requestedStaleMinutes,
              1,
            ),
            MAX_STALE_MINUTES,
          )
        : DEFAULT_STALE_MINUTES;

    const staleBefore =
      new Date(
        Date.now() -
          staleMinutes *
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
              `quote_checked_at.is.null,quote_checked_at.lt.${staleBefore}`,
            )
            .order(
              "quote_checked_at",
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
            `Could not load the quote queue: ${error.message}`,
          );
        }

        stocks =
          data ?? [];
      }

      if (
        stocks.length === 0
      ) {
        return jsonResponse({
          ok: true,
          status:
            "idle",
          message:
            "No stocks have missing or stale quotes.",
          staleMinutes,
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
              "sync-stock-quotes",
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
              staleMinutes,
              staleBefore,
            },
          })
          .select("id")
          .maybeSingle();

      if (
        syncRunError
      ) {
        console.warn(
          "Could not create quote-sync log:",
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
              const values =
                await fetchFinnhubQuote(
                  symbol,
                  finnhubApiKey,
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

              if (
                updateError
              ) {
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
                  : "Unknown quote-sync error.";

              const checkedAt =
                new Date()
                  .toISOString();

              const {
                error:
                  failureUpdateError,
              } =
                await supabase
                  .from(
                    "stock_screener_stocks",
                  )
                  .update({
                    quote_checked_at:
                      checkedAt,
                    quote_error:
                      message.slice(
                        0,
                        1000,
                      ),
                  })
                  .eq(
                    "symbol",
                    symbol,
                  );

              if (
                failureUpdateError
              ) {
                console.error(
                  `Could not record quote failure for ${symbol}:`,
                  failureUpdateError,
                );
              }

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
                      .slice(
                        0,
                        10,
                      )
                      .map(
                        (result) =>
                          `${result.symbol}: ${result.error}`,
                      )
                      .join(" | ")
                      .slice(
                        0,
                        4000,
                      )
                  : null,
              metadata: {
                manualSymbols:
                  requestedSymbols.length >
                  0,
                requestedBatchSize:
                  batchSize,
                staleMinutes,
                staleBefore,
                failures:
                  failed
                    .slice(
                      0,
                      20,
                    )
                    .map(
                      (result) => ({
                        symbol:
                          result.symbol,
                        error:
                          result.error,
                      }),
                    ),
              },
            })
            .eq(
              "id",
              syncRunId,
            );

        if (
          finishLogError
        ) {
          console.warn(
            "Quote sync completed, but the sync log could not be finalized:",
            finishLogError,
          );
        }
      }

      return jsonResponse({
        ok:
          succeeded.length > 0,
        status,
        symbolsRequested:
          stocks.length,
        symbolsSucceeded:
          succeeded.length,
        symbolsFailed:
          failed.length,
        staleMinutes,
        staleBefore,
        results,
        startedAt,
        finishedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown quote-sync error.";

      console.error(
        "sync-stock-quotes:",
        error,
      );

      if (
        syncRunId !== null
      ) {
        await supabase
          .from(
            "stock_sync_runs",
          )
          .update({
            status:
              "failed",
            error_message:
              message,
            finished_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            syncRunId,
          );
      }

      return jsonResponse(
        {
          ok: false,
          error:
            message,
        },
        500,
      );
    }
  },
);
