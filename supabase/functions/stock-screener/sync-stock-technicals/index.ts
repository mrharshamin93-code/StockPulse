import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const DEFAULT_STALE_HOURS = 20;
const MAX_STALE_HOURS = 168;
const REQUEST_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const CANDLE_LOOKBACK_DAYS = 220;

const SMA_FAST_PERIOD = 20;
const SMA_SLOW_PERIOD = 50;
const RSI_PERIOD = 14;
const AVERAGE_VOLUME_PERIOD = 30;

type UnknownRecord = Record<string, unknown>;

type StockQueueRow = {
  symbol: string;
};

type Candle = {
  timestamp: number;
  close: number;
  volume: number | null;
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
) {
  if (value === null) {
    return null;
  }

  const multiplier =
    10 ** digits;

  return Math.round(
    value * multiplier,
  ) / multiplier;
}

function average(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce(
    (total, value) =>
      total + value,
    0,
  ) / values.length;
}

function smaAt(
  closes: number[],
  period: number,
  index: number,
): number | null {
  const start =
    index - period + 1;

  if (start < 0) {
    return null;
  }

  return average(
    closes.slice(
      start,
      index + 1,
    ),
  );
}

function percentageReturn(
  closes: number[],
  sessions: number,
): number | null {
  if (
    closes.length <=
    sessions
  ) {
    return null;
  }

  const current =
    closes[
      closes.length - 1
    ];

  const previous =
    closes[
      closes.length -
        1 -
        sessions
    ];

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return null;
  }

  return (
    (current / previous - 1) *
    100
  );
}

function calculateRsi(
  closes: number[],
  period = RSI_PERIOD,
): number | null {
  if (
    closes.length <
    period + 1
  ) {
    return null;
  }

  let averageGain = 0;
  let averageLoss = 0;

  for (
    let index = 1;
    index <= period;
    index += 1
  ) {
    const change =
      closes[index] -
      closes[index - 1];

    if (change >= 0) {
      averageGain +=
        change;
    } else {
      averageLoss +=
        Math.abs(change);
    }
  }

  averageGain /= period;
  averageLoss /= period;

  for (
    let index =
      period + 1;
    index < closes.length;
    index += 1
  ) {
    const change =
      closes[index] -
      closes[index - 1];

    const gain =
      Math.max(change, 0);

    const loss =
      Math.max(-change, 0);

    averageGain =
      (
        averageGain *
          (period - 1) +
        gain
      ) /
      period;

    averageLoss =
      (
        averageLoss *
          (period - 1) +
        loss
      ) /
      period;
  }

  if (averageLoss === 0) {
    return averageGain === 0
      ? 50
      : 100;
  }

  const relativeStrength =
    averageGain /
    averageLoss;

  return 100 -
    100 /
      (1 +
        relativeStrength);
}

function parseCandles(
  payload: UnknownRecord,
): Candle[] {
  if (
    normalizeText(
      payload.s,
    ).toLowerCase() !==
    "ok"
  ) {
    return [];
  }

  const timestamps =
    Array.isArray(payload.t)
      ? payload.t
      : [];

  const closes =
    Array.isArray(payload.c)
      ? payload.c
      : [];

  const volumes =
    Array.isArray(payload.v)
      ? payload.v
      : [];

  const length =
    Math.min(
      timestamps.length,
      closes.length,
    );

  const candles:
    Candle[] = [];

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const timestamp =
      finiteNumber(
        timestamps[index],
      );

    const close =
      finiteNumber(
        closes[index],
      );

    const volume =
      finiteNumber(
        volumes[index],
      );

    if (
      timestamp === null ||
      timestamp <= 0 ||
      close === null ||
      close <= 0
    ) {
      continue;
    }

    candles.push({
      timestamp,
      close,
      volume:
        volume !== null &&
        volume >= 0
          ? volume
          : null,
    });
  }

  return candles.sort(
    (left, right) =>
      left.timestamp -
      right.timestamp,
  );
}

function buildTechnicalUpdate(
  candles: Candle[],
  checkedAt: string,
) {
  if (
    candles.length <
    64
  ) {
    throw new Error(
      "Finnhub returned fewer than 64 usable daily candles.",
    );
  }

  const closes =
    candles.map(
      (candle) =>
        candle.close,
    );

  const lastIndex =
    closes.length - 1;

  const latestClose =
    closes[lastIndex];

  const sma20 =
    smaAt(
      closes,
      SMA_FAST_PERIOD,
      lastIndex,
    );

  const sma50 =
    smaAt(
      closes,
      SMA_SLOW_PERIOD,
      lastIndex,
    );

  if (
    sma20 === null ||
    sma50 === null
  ) {
    throw new Error(
      "Not enough candle history to calculate moving averages.",
    );
  }

  let crossoverIndex:
    number | null = null;

  for (
    let index =
      SMA_SLOW_PERIOD;
    index <= lastIndex;
    index += 1
  ) {
    const fastCurrent =
      smaAt(
        closes,
        SMA_FAST_PERIOD,
        index,
      );

    const slowCurrent =
      smaAt(
        closes,
        SMA_SLOW_PERIOD,
        index,
      );

    const fastPrevious =
      smaAt(
        closes,
        SMA_FAST_PERIOD,
        index - 1,
      );

    const slowPrevious =
      smaAt(
        closes,
        SMA_SLOW_PERIOD,
        index - 1,
      );

    if (
      fastCurrent !== null &&
      slowCurrent !== null &&
      fastPrevious !== null &&
      slowPrevious !== null &&
      fastCurrent > slowCurrent &&
      fastPrevious <= slowPrevious
    ) {
      crossoverIndex =
        index;
    }
  }

  const crossoverAt =
    crossoverIndex === null
      ? null
      : new Date(
          candles[
            crossoverIndex
          ].timestamp *
            1000,
        ).toISOString();

  const crossoverDaysAgo =
    crossoverIndex === null
      ? null
      : lastIndex -
        crossoverIndex;

  const previousVolumes =
    candles
      .slice(
        Math.max(
          0,
          candles.length -
            AVERAGE_VOLUME_PERIOD -
            1,
        ),
        candles.length - 1,
      )
      .map(
        (candle) =>
          candle.volume,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value,
          ),
      );

  const averageVolume =
    average(
      previousVolumes,
    );

  const latestVolume =
    candles[lastIndex]
      .volume;

  const relativeVolume =
    latestVolume !== null &&
    averageVolume !== null &&
    averageVolume > 0
      ? latestVolume /
        averageVolume
      : null;

  const update:
    UnknownRecord = {
      technicals_checked_at:
        checkedAt,
      technicals_updated_at:
        checkedAt,
      technicals_error:
        null,
      sma_20:
        roundNumber(
          sma20,
        ),
      sma_50:
        roundNumber(
          sma50,
        ),
      price_above_sma_20:
        latestClose > sma20,
      sma_20_above_sma_50:
        sma20 > sma50,
      bullish_ma_crossover_at:
        crossoverAt,
      bullish_ma_crossover_days_ago:
        crossoverDaysAgo,
      rsi_14:
        roundNumber(
          calculateRsi(
            closes,
          ),
        ),
      return_1_week:
        roundNumber(
          percentageReturn(
            closes,
            5,
          ),
        ),
      return_1_month:
        roundNumber(
          percentageReturn(
            closes,
            21,
          ),
        ),
      return_3_month:
        roundNumber(
          percentageReturn(
            closes,
            63,
          ),
        ),
      average_volume_30d:
        averageVolume === null
          ? null
          : Math.round(
              averageVolume,
            ),
      relative_volume:
        roundNumber(
          relativeVolume,
        ),
    };

  return update;
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

async function fetchFinnhubCandles(
  symbol: string,
  apiKey: string,
) {
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
      const nowSeconds =
        Math.floor(
          Date.now() /
            1000,
        );

      const fromSeconds =
        nowSeconds -
        CANDLE_LOOKBACK_DAYS *
          24 *
          60 *
          60;

      const url =
        new URL(
          "https://finnhub.io/api/v1/stock/candle",
        );

      url.searchParams.set(
        "symbol",
        symbol,
      );

      url.searchParams.set(
        "resolution",
        "D",
      );

      url.searchParams.set(
        "from",
        String(
          fromSeconds,
        ),
      );

      url.searchParams.set(
        "to",
        String(
          nowSeconds,
        ),
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
        response.status ===
          429 &&
        attempt < MAX_RETRIES
      ) {
        await delay(
          1_500 *
            (attempt + 1),
        );

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Finnhub candle request failed with status ${response.status}.`,
        );
      }

      if (
        !payload ||
        typeof payload !==
          "object"
      ) {
        throw new Error(
          "Finnhub returned an invalid candle payload.",
        );
      }

      const candles =
        parseCandles(
          payload as UnknownRecord,
        );

      if (
        candles.length === 0
      ) {
        throw new Error(
          "Finnhub returned no usable daily candles.",
        );
      }

      return candles;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              "Unknown Finnhub candle error.",
            );

      if (
        attempt < MAX_RETRIES
      ) {
        await delay(
          900 *
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
      "Finnhub candle request failed.",
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
            "Unauthorized stock technical sync request.",
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
              `technicals_checked_at.is.null,technicals_checked_at.lt.${staleBefore}`,
            )
            .order(
              "technicals_checked_at",
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
            `Could not load the technical queue: ${error.message}`,
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
            "No stocks have missing or stale technicals.",
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
              "sync-stock-technicals",
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
              lookbackDays:
                CANDLE_LOOKBACK_DAYS,
            },
          })
          .select("id")
          .maybeSingle();

      if (syncRunError) {
        console.warn(
          "Could not create technical-sync log:",
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

            const checkedAt =
              new Date()
                .toISOString();

            try {
              const candles =
                await fetchFinnhubCandles(
                  symbol,
                  finnhubApiKey,
                );

              const update =
                buildTechnicalUpdate(
                  candles,
                  checkedAt,
                );

              const {
                error:
                  updateError,
              } =
                await supabase
                  .from(
                    "stock_screener_stocks",
                  )
                  .update(update)
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
                    update,
                  ).length,
                error:
                  null,
              };
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unknown technical-sync error.";

              const {
                error:
                  failureUpdateError,
              } =
                await supabase
                  .from(
                    "stock_screener_stocks",
                  )
                  .update({
                    technicals_checked_at:
                      checkedAt,
                    technicals_error:
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
                  `Could not record technical failure for ${symbol}:`,
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
                staleHours,
                staleBefore,
                lookbackDays:
                  CANDLE_LOOKBACK_DAYS,
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

        if (finishLogError) {
          console.warn(
            "Technical sync completed, but the sync log could not be finalized:",
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
        staleHours,
        staleBefore,
        results,
        startedAt,
        finishedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown technical-sync error.";

      console.error(
        "sync-stock-technicals:",
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
