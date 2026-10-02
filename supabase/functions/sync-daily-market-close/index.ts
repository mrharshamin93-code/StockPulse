import { createClient } from "npm:@supabase/supabase-js@2";

const STOCKS_TABLE = "stock_screener_stocks";
const INTRADAY_TABLE = "stock_intraday_snapshots";
const DAILY_TABLE = "stock_daily_prices";
const PAGE_SIZE = 1000;
const UPSERT_CHUNK_SIZE = 750;
const MARKET_TZ = "America/New_York";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTicker(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function isCloseCaptureTime(now = new Date()) {
  const p = nyParts(now);
  return (
    p.weekday !== "Sat" &&
    p.weekday !== "Sun" &&
    p.hour === 16 &&
    p.minute >= 4 &&
    p.minute <= 10
  );
}

function utcBoundsForNyDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);

  return {
    from: `${date}T04:00:00.000Z`,
    to: `${next.toISOString().slice(0, 10)}T05:00:00.000Z`,
  };
}

function nyMinuteOfDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

async function loadActiveSymbols(supabase: ReturnType<typeof createClient>) {
  const symbols = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(STOCKS_TABLE)
      .select("symbol")
      .eq("is_active", true)
      .eq("is_common_stock", true)
      .order("symbol", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Could not load stock universe: ${error.message}`);
    }

    for (const row of data ?? []) {
      const symbol = normalizeTicker(row.symbol);
      if (symbol) symbols.add(symbol);
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return symbols;
}

async function loadRegularSessionSnapshots(
  supabase: ReturnType<typeof createClient>,
  tradingDate: string,
) {
  const bounds = utcBoundsForNyDate(tradingDate);
  const byTicker = new Map<
    string,
    { ticker: string; open: number; high: number; low: number; close: number }
  >();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(INTRADAY_TABLE)
      .select("ticker,bucket_start,price")
      .gte("bucket_start", bounds.from)
      .lt("bucket_start", bounds.to)
      .order("ticker", { ascending: true })
      .order("bucket_start", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Could not load intraday prices: ${error.message}`);
    }

    for (const row of data ?? []) {
      const minuteOfDay = nyMinuteOfDay(String(row.bucket_start ?? ""));
      if (minuteOfDay === null || minuteOfDay < 570 || minuteOfDay > 960) {
        continue;
      }

      const ticker = normalizeTicker(row.ticker);
      const price = finiteNumber(row.price);
      if (!ticker || price === null || price <= 0) continue;

      const current = byTicker.get(ticker);
      if (!current) {
        byTicker.set(ticker, {
          ticker,
          open: price,
          high: price,
          low: price,
          close: price,
        });
      } else {
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return byTicker;
}

async function upsertRows(supabase: ReturnType<typeof createClient>, rows: any[]) {
  let saved = 0;

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from(DAILY_TABLE)
      .upsert(chunk, { onConflict: "ticker,trading_date" });

    if (error) {
      throw new Error(`Could not upsert daily prices: ${error.message}`);
    }

    saved += chunk.length;
  }

  return saved;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("STOCK_SYNC_SECRET");
  const receivedSecret = req.headers.get("x-sync-secret");

  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing required environment variables" }, 503);
  }

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;
  const dryRun = body?.dryRun === true;
  const now = new Date();
  const market = nyParts(now);

  if (!force && !isCloseCaptureTime(now)) {
    return json({
      ok: true,
      status: "skipped",
      reason: "not-market-close-capture-window",
      marketDate: market.date,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [activeSymbols, intraday] = await Promise.all([
      loadActiveSymbols(supabase),
      loadRegularSessionSnapshots(supabase, market.date),
    ]);

    const updatedAt = now.toISOString();
    const rows: any[] = [];

    for (const [ticker, values] of intraday) {
      if (!activeSymbols.has(ticker)) continue;

      rows.push({
        ticker,
        trading_date: market.date,
        open: values.open,
        high: values.high,
        low: values.low,
        close: values.close,
        updated_at: updatedAt,
      });
    }

    if (!rows.length) {
      return json({
        ok: true,
        status: "skipped",
        reason: "no-regular-session-snapshots",
        marketDate: market.date,
      });
    }

    if (dryRun) {
      return json({
        ok: true,
        status: "dry-run",
        marketDate: market.date,
        activeCommonStocks: activeSymbols.size,
        rowsEligible: rows.length,
        sample: rows.slice(0, 5),
      });
    }

    const saved = await upsertRows(supabase, rows);

    return json({
      ok: true,
      status: "completed",
      marketDate: market.date,
      activeCommonStocks: activeSymbols.size,
      rowsSaved: saved,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown daily market-close sync error";

    console.error("sync-daily-market-close:", error);
    return json({ ok: false, error: message }, 500);
  }
});
