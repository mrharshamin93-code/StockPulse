import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 250;
const MIN_HISTORY = 64;
const SMA_FAST = 20;
const SMA_SLOW = 50;
const RSI_PERIOD = 14;

type Candle = { trading_date: string; close: number };
type StockRow = { symbol: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeSymbol(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function finite(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v: number | null, d = 6) {
  if (v === null) return null;
  const m = 10 ** d;
  return Math.round(v * m) / m;
}

function avg(a: number[]) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

function smaAt(c: number[], p: number, i: number) {
  const s = i - p + 1;
  return s < 0 ? null : avg(c.slice(s, i + 1));
}

function pctReturn(c: number[], sessions: number) {
  if (c.length <= sessions) return null;

  const a = c[c.length - 1];
  const b = c[c.length - 1 - sessions];

  return b > 0 ? (a / b - 1) * 100 : null;
}

function rsi(c: number[], period = RSI_PERIOD) {
  if (c.length < period + 1) return null;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const ch = c[i] - c[i - 1];

    if (ch >= 0) {
      gain += ch;
    } else {
      loss += -ch;
    }
  }

  gain /= period;
  loss /= period;

  for (let i = period + 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1];

    gain =
      (gain * (period - 1) + Math.max(ch, 0)) /
      period;

    loss =
      (loss * (period - 1) + Math.max(-ch, 0)) /
      period;
  }

  if (loss === 0) {
    return gain === 0 ? 50 : 100;
  }

  return 100 - 100 / (1 + gain / loss);
}

function buildUpdate(candles: Candle[], checkedAt: string) {
  if (candles.length < MIN_HISTORY) {
    throw new Error(
      `Only ${candles.length} daily closes available; ${MIN_HISTORY} required.`,
    );
  }

  const closes = candles.map((x) => x.close);
  const last = closes.length - 1;

  const s20 = smaAt(closes, SMA_FAST, last);
  const s50 = smaAt(closes, SMA_SLOW, last);

  if (s20 === null || s50 === null) {
    throw new Error("Not enough history for moving averages.");
  }

  let cross: number | null = null;

  for (let i = SMA_SLOW; i <= last; i++) {
    const fc = smaAt(closes, SMA_FAST, i);
    const sc = smaAt(closes, SMA_SLOW, i);
    const fp = smaAt(closes, SMA_FAST, i - 1);
    const sp = smaAt(closes, SMA_SLOW, i - 1);

    if (
      fc !== null &&
      sc !== null &&
      fp !== null &&
      sp !== null &&
      fc > sc &&
      fp <= sp
    ) {
      cross = i;
    }
  }

  return {
    technicals_checked_at: checkedAt,
    technicals_updated_at: checkedAt,
    technicals_error: null,

    sma_20: round(s20),
    sma_50: round(s50),

    price_above_sma_20: closes[last] > s20,
    sma_20_above_sma_50: s20 > s50,

    bullish_ma_crossover_at:
      cross === null
        ? null
        : `${candles[cross].trading_date}T00:00:00.000Z`,

    bullish_ma_crossover_days_ago:
      cross === null ? null : last - cross,

    rsi_14: round(rsi(closes)),

    return_1_week: round(pctReturn(closes, 5)),
    return_1_month: round(pctReturn(closes, 21)),
    return_3_month: round(pctReturn(closes, 63)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return response(
      {
        ok: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  const expected = Deno.env.get("STOCK_SYNC_SECRET");
  const received = req.headers.get("x-sync-secret");

  if (!expected || !received || expected !== received) {
    return response(
      {
        ok: false,
        error: "Unauthorized stock technical sync request.",
      },
      401,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    return response(
      {
        ok: false,
        error: "Supabase service credentials are unavailable.",
      },
      503,
    );
  }

  const db = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const body = await req.json().catch(() => ({}));

  const explicit = Array.isArray(body?.symbols)
    ? [...new Set(
        body.symbols
          .map(normalizeSymbol)
          .filter(Boolean),
      )].slice(0, MAX_BATCH_SIZE)
    : [];

  const requested = Math.trunc(Number(body?.batchSize));

  const batchSize = Number.isFinite(requested)
    ? Math.min(
        Math.max(requested, 1),
        MAX_BATCH_SIZE,
      )
    : DEFAULT_BATCH_SIZE;

  const checkedAt = new Date().toISOString();

  try {
    let stocks: StockRow[];

    if (explicit.length) {
      stocks = explicit.map((symbol) => ({ symbol }));
    } else {
      const { data, error } = await db
        .from("stock_screener_stocks")
        .select("symbol")
        .eq("is_active", true)
        .eq("is_common_stock", true)
        .order("technicals_checked_at", {
          ascending: true,
          nullsFirst: true,
        })
        .order("symbol", {
          ascending: true,
        })
        .limit(batchSize);

      if (error) {
        throw new Error(
          `Could not load technical queue: ${error.message}`,
        );
      }

      stocks = (data ?? []) as StockRow[];
    }

    if (!stocks.length) {
      return response({
        ok: true,
        status: "idle",
        symbolsRequested: 0,
      });
    }

    const results = [];

    for (const stock of stocks) {
      const symbol = normalizeSymbol(stock.symbol);

      try {
        const { data, error } = await db
          .from("stock_daily_prices")
          .select("trading_date,close")
          .eq("ticker", symbol)
          .order("trading_date", {
            ascending: true,
          })
          .limit(400);

        if (error) {
          throw new Error(error.message);
        }

        const candles: Candle[] = (data ?? [])
          .map((r: any) => ({
            trading_date: String(r.trading_date),
            close: finite(r.close) ?? 0,
          }))
          .filter((x) => x.close > 0);

        const update = buildUpdate(
          candles,
          checkedAt,
        );

        const { error: updateError } = await db
          .from("stock_screener_stocks")
          .update(update)
          .eq("symbol", symbol);

        if (updateError) {
          throw new Error(updateError.message);
        }

        results.push({
          symbol,
          ok: true,
          candles: candles.length,
        });
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Unknown technical calculation error.";

        await db
          .from("stock_screener_stocks")
          .update({
            technicals_checked_at: checkedAt,
            technicals_error: message.slice(0, 1000),
          })
          .eq("symbol", symbol);

        results.push({
          symbol,
          ok: false,
          error: message,
        });
      }
    }

    const succeeded = results.filter(
      (x: any) => x.ok,
    ).length;

    return response({
      ok: succeeded > 0,

      status:
        succeeded === results.length
          ? "completed"
          : succeeded
            ? "partial"
            : "failed",

      source: "stock_daily_prices",
      providerRequests: 0,

      symbolsRequested: results.length,
      symbolsSucceeded: succeeded,
      symbolsFailed: results.length - succeeded,

      results,
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Unknown technical sync error.";

    console.error(
      "sync-stock-technicals:",
      e,
    );

    return response(
      {
        ok: false,
        error: message,
      },
      500,
    );
  }
});
