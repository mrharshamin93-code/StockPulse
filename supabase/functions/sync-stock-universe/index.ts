import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINNHUB_SYMBOLS_URL =
  "https://finnhub.io/api/v1/stock/symbol?exchange=US";

const UPSERT_BATCH_SIZE = 500;

/*
 * Primary U.S. listing MICs we want in the screener.
 *
 * Nasdaq can appear under several operating MICs.
 * ARCX and BATS are included for valid U.S. primary listings.
 * OTC MICs are intentionally excluded.
 */
const exchangeByMic: Record<string, string> = {
  XNYS: "NYSE",
  XNAS: "NASDAQ",
  XNGS: "NASDAQ",
  XNMS: "NASDAQ",
  XNCM: "NASDAQ",
  XASE: "AMEX",
  ARCX: "NYSE ARCA",
  BATS: "CBOE",
};

const micPriority: Record<string, number> = {
  XNYS: 1,
  XNAS: 2,
  XNGS: 2,
  XNMS: 3,
  XNCM: 4,
  XASE: 5,
  ARCX: 6,
  BATS: 7,
};

type FinnhubSymbol = {
  currency?: unknown;
  description?: unknown;
  displaySymbol?: unknown;
  figi?: unknown;
  mic?: unknown;
  symbol?: unknown;
  type?: unknown;
};

type UniverseRow = {
  symbol: string;
  company_name: string;
  exchange: string;
  mic: string;
  figi: string | null;
  currency: string;
  security_type: string;
  is_active: boolean;
  is_common_stock: boolean;
  data_source: string;
  universe_updated_at: string;
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

function isCommonStockType(
  value: unknown,
) {
  const type =
    normalizeText(value)
      .toLowerCase();

  return (
    type === "common stock" ||
    type === "common stocks"
  );
}

function isValidSymbol(
  symbol: string,
) {
  return (
    symbol.length > 0 &&
    symbol.length <= 15 &&
    /^[A-Z0-9][A-Z0-9.-]*$/.test(
      symbol,
    )
  );
}

function chunkArray<T>(
  values: T[],
  size: number,
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size,
      ),
    );
  }

  return chunks;
}

function buildUniverseRows(
  rawSymbols: FinnhubSymbol[],
  syncedAt: string,
) {
  /*
   * Finnhub may return the same display symbol under more than one MIC.
   * Keep one row per symbol and prefer the highest-priority primary MIC.
   */
  const bySymbol =
    new Map<
      string,
      {
        row: UniverseRow;
        priority: number;
      }
    >();

  let excludedNonCommon = 0;
  let excludedExchange = 0;
  let excludedInvalid = 0;

  for (const item of rawSymbols) {
    if (
      !isCommonStockType(
        item?.type,
      )
    ) {
      excludedNonCommon += 1;
      continue;
    }

    const mic =
      normalizeText(
        item?.mic,
      ).toUpperCase();

    const exchange =
      exchangeByMic[mic];

    if (!exchange) {
      excludedExchange += 1;
      continue;
    }

    const symbol =
      normalizeSymbol(
        item?.symbol ||
          item?.displaySymbol,
      );

    if (
      !isValidSymbol(symbol)
    ) {
      excludedInvalid += 1;
      continue;
    }

    const companyName =
      normalizeText(
        item?.description,
      ) || symbol;

    const securityType =
      normalizeText(
        item?.type,
      ) || "Common Stock";

    const candidate = {
      row: {
        symbol,
        company_name:
          companyName,
        exchange,
        mic,
        figi:
          normalizeText(
            item?.figi,
          ) || null,
        currency:
          normalizeText(
            item?.currency,
          ).toUpperCase() ||
          "USD",
        security_type:
          securityType,
        is_active: true,
        is_common_stock:
          true,
        data_source:
          "finnhub",
        universe_updated_at:
          syncedAt,
      },
      priority:
        micPriority[mic] ??
        999,
    };

    const existing =
      bySymbol.get(symbol);

    if (
      !existing ||
      candidate.priority <
        existing.priority
    ) {
      bySymbol.set(
        symbol,
        candidate,
      );
    }
  }

  return {
    rows: [
      ...bySymbol.values(),
    ]
      .map((value) =>
        value.row,
      )
      .sort((left, right) =>
        left.symbol.localeCompare(
          right.symbol,
        ),
      ),
    excludedNonCommon,
    excludedExchange,
    excludedInvalid,
  };
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
            "Unauthorized stock sync request.",
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

    const startedAt =
      new Date().toISOString();

    let syncRunId:
      number | null = null;

    try {
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
              "sync-stock-universe",
            status:
              "running",
            started_at:
              startedAt,
          })
          .select("id")
          .single();

      if (syncRunError) {
        throw new Error(
          `Could not create sync log: ${syncRunError.message}`,
        );
      }

      syncRunId =
        Number(syncRun.id);

      const finnhubResponse =
        await fetch(
          FINNHUB_SYMBOLS_URL,
          {
            headers: {
              "X-Finnhub-Token":
                finnhubApiKey,
            },
          },
        );

      const finnhubPayload =
        await finnhubResponse
          .json()
          .catch(() => null);

      if (
        !finnhubResponse.ok
      ) {
        throw new Error(
          `Finnhub stock-symbol request failed with status ${finnhubResponse.status}.`,
        );
      }

      if (
        !Array.isArray(
          finnhubPayload,
        )
      ) {
        throw new Error(
          "Finnhub returned an invalid stock-symbol response.",
        );
      }

      const {
        rows,
        excludedNonCommon,
        excludedExchange,
        excludedInvalid,
      } =
        buildUniverseRows(
          finnhubPayload,
          startedAt,
        );

      if (
        rows.length === 0
      ) {
        throw new Error(
          "No eligible U.S. common stocks were returned.",
        );
      }

      const batches =
        chunkArray(
          rows,
          UPSERT_BATCH_SIZE,
        );

      let processed = 0;

      for (
        let batchIndex = 0;
        batchIndex <
        batches.length;
        batchIndex += 1
      ) {
        const batch =
          batches[
            batchIndex
          ];

        const {
          error:
            upsertError,
        } =
          await supabase
            .from(
              "stock_screener_stocks",
            )
            .upsert(
              batch,
              {
                onConflict:
                  "symbol",
              },
            );

        if (upsertError) {
          throw new Error(
            `Universe batch ${batchIndex + 1} failed: ${upsertError.message}`,
          );
        }

        processed +=
          batch.length;

        console.log(
          `Universe sync batch ${batchIndex + 1}/${batches.length}: ${processed}/${rows.length}`,
        );
      }

      /*
       * Only deactivate stale Finnhub rows after every current row
       * has been saved successfully.
       */
      const {
        error:
          deactivateError,
      } =
        await supabase
          .from(
            "stock_screener_stocks",
          )
          .update({
            is_active:
              false,
          })
          .eq(
            "data_source",
            "finnhub",
          )
          .lt(
            "universe_updated_at",
            startedAt,
          );

      if (
        deactivateError
      ) {
        throw new Error(
          `Could not deactivate stale symbols: ${deactivateError.message}`,
        );
      }

      const finishedAt =
        new Date().toISOString();

      const {
        error:
          completeLogError,
      } =
        await supabase
          .from(
            "stock_sync_runs",
          )
          .update({
            status:
              "completed",
            symbols_requested:
              finnhubPayload.length,
            symbols_processed:
              rows.length,
            symbols_succeeded:
              rows.length,
            symbols_failed:
              0,
            finished_at:
              finishedAt,
            metadata: {
              batches:
                batches.length,
              excludedNonCommon,
              excludedExchange,
              excludedInvalid,
            },
          })
          .eq(
            "id",
            syncRunId,
          );

      if (
        completeLogError
      ) {
        console.warn(
          "Universe sync completed, but the completion log could not be updated:",
          completeLogError,
        );
      }

      return jsonResponse({
        ok: true,
        sourceSymbols:
          finnhubPayload.length,
        importedStocks:
          rows.length,
        batches:
          batches.length,
        excluded: {
          nonCommon:
            excludedNonCommon,
          unsupportedExchange:
            excludedExchange,
          invalidSymbol:
            excludedInvalid,
        },
        sample:
          rows
            .slice(0, 10)
            .map((row) => ({
              symbol:
                row.symbol,
              companyName:
                row.company_name,
              exchange:
                row.exchange,
              mic:
                row.mic,
            })),
        startedAt,
        finishedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown universe-sync error.";

      console.error(
        "sync-stock-universe:",
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