import { requireStockPulseAccess } from "../_shared/entitlement.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://api.financialdatasets.ai";
const MARKET_TZ = "America/New_York";
const CURRENT_TTL_MS = 15 * 60 * 1000;
const HISTORICAL_TTL_MS = 3650 * 24 * 60 * 60 * 1000;
const NO_DATA_TTL_MS = 12 * 60 * 60 * 1000;
const MONTHLY_LIMIT = 100000;
const RESERVED_UNITS = 15000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTicker(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function marketIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isoFromUnix(value: unknown): string | null {
  const n = finiteNumber(value);
  if (n === null || n <= 0) return null;
  const ms = n > 10_000_000_000 ? n : n * 1000;
  return marketIsoDate(new Date(ms));
}

function unixSeconds(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n !== null) {
    return n > 10_000_000_000
      ? Math.floor(n / 1000)
      : Math.floor(n);
  }

  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed)
    ? Math.floor(parsed / 1000)
    : null;
}

function dateFromIso(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function exactPeriodStart(period: string, endDate: string): string | null {
  const d = dateFromIso(endDate);

  switch (period) {
    case "1Y":
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return iso(d);
    case "2Y":
      d.setUTCFullYear(d.getUTCFullYear() - 2);
      return iso(d);
    case "5Y":
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      return iso(d);
    case "10Y":
      d.setUTCFullYear(d.getUTCFullYear() - 10);
      return iso(d);
    case "YTD":
      d.setUTCMonth(0, 1);
      return iso(d);
    default:
      return null;
  }
}

function intervalFromResolution(value: unknown): "day" | "week" | "month" | "year" {
  const r = String(value ?? "").trim().toUpperCase();
  if (["W", "1W", "WEEK"].includes(r)) return "week";
  if (["M", "1M", "MONTH"].includes(r)) return "month";
  if (["Y", "1Y", "YEAR"].includes(r)) return "year";
  return "day";
}

function chunkDays(interval: string) {
  if (interval === "day") return 90;
  if (interval === "week") return 600;
  if (interval === "month") return 2200;
  return 20000;
}

function buildChunks(startDate: string, endDate: string, interval: string) {
  const chunks: Array<{ startDate: string; endDate: string }> = [];
  let cursor = dateFromIso(startDate);
  const end = dateFromIso(endDate);
  const step = chunkDays(interval);

  while (cursor <= end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + step - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());

    chunks.push({
      startDate: iso(chunkStart),
      endDate: iso(chunkEnd),
    });

    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}

async function reserveRequest(supabase: any) {
  const { data, error } = await supabase.rpc("reserve_provider_request", {
    p_provider: "financial-datasets",
    p_request_units: 1,
    p_monthly_limit: MONTHLY_LIMIT,
    p_reserved_units: RESERVED_UNITS,
    p_priority: true,
  });

  if (error) {
    throw new Error(`Could not reserve Financial Datasets request: ${error.message}`);
  }

  if (data !== true) {
    throw new Error("Financial Datasets request budget is unavailable.");
  }
}

async function recordRequest(
  supabase: any,
  endpoint: string,
  success: boolean,
) {
  await supabase.rpc("record_provider_request_result", {
    p_provider: "financial-datasets",
    p_endpoint: endpoint,
    p_request_units: 1,
    p_success: success,
  });
}

async function fetchChunk(
  supabase: any,
  apiKey: string,
  ticker: string,
  interval: string,
  startDate: string,
  endDate: string,
) {
  await reserveRequest(supabase);
  let success = false;

  try {
    const url = new URL(`${API_BASE}/prices`);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("interval", interval);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const text = await response.text();
    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object"
          ? String(payload.message ?? payload.error ?? payload.detail ?? `HTTP ${response.status}`)
          : `HTTP ${response.status}`;

      if (
        response.status === 404 ||
        (response.status === 400 &&
          /no prices|not found|invalid ticker|no data/i.test(message))
      ) {
        success = true;
        return [];
      }

      throw new Error(message);
    }

    success = true;
    return Array.isArray(payload?.prices) ? payload.prices : [];
  } finally {
    await recordRequest(supabase, "/prices", success);
  }
}

function normalizePrice(row: any) {
  const rawTs = row?.time ?? row?.date;
  const timestamp = unixSeconds(rawTs);
  const close = finiteNumber(row?.close ?? row?.price);

  if (
    timestamp === null ||
    timestamp <= 0 ||
    close === null ||
    close <= 0
  ) {
    return null;
  }

  return {
    timestamp,
    open: finiteNumber(row?.open),
    high: finiteNumber(row?.high),
    low: finiteNumber(row?.low),
    close,
    volume: finiteNumber(row?.volume),
  };
}

function normalizeQuotePayload(payload: any, ticker: string) {
  const root = payload && typeof payload === "object" ? payload : {};
  const snapshot =
    root.snapshot && typeof root.snapshot === "object"
      ? root.snapshot
      : root;

  const price = finiteNumber(
    snapshot.price ??
      snapshot.close ??
      snapshot.current_price,
  );

  const timestamp =
    unixSeconds(snapshot.time_milliseconds) ??
    unixSeconds(snapshot.time) ??
    unixSeconds(snapshot.date);

  if (
    price === null ||
    price <= 0 ||
    timestamp === null ||
    timestamp <= 0
  ) {
    return null;
  }

  return {
    ticker,
    price,
    timestamp,
  };
}

async function readCachedQuote(supabase: any, ticker: string) {
  const { data, error } = await supabase
    .from("market_data_cache")
    .select("payload,expires_at")
    .eq("cache_key", `quote:${ticker}`)
    .maybeSingle();

  if (error || !data?.payload) {
    return null;
  }

  const payload = data.payload;
  const price = finiteNumber(payload?.price);
  const timestamp = unixSeconds(payload?.timestamp);

  if (
    price === null ||
    price <= 0 ||
    timestamp === null ||
    timestamp <= 0
  ) {
    return null;
  }

  return {
    ticker,
    price,
    timestamp,
    cacheExpiresAt: data.expires_at ?? null,
  };
}

async function fetchLiveQuote(
  supabase: any,
  apiKey: string,
  ticker: string,
) {
  const cached = await readCachedQuote(supabase, ticker);

  if (cached) {
    return {
      ...cached,
      source: "quote-cache",
    };
  }

  await reserveRequest(supabase);
  let success = false;

  try {
    const url = new URL(`${API_BASE}/prices/snapshot`);
    url.searchParams.set("ticker", ticker);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
    });

    const text = await response.text();
    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      throw new Error(
        payload && typeof payload === "object"
          ? String(payload.message ?? payload.error ?? payload.detail ?? `HTTP ${response.status}`)
          : `HTTP ${response.status}`,
      );
    }

    const quote = normalizeQuotePayload(payload, ticker);
    if (!quote) {
      throw new Error("Financial Datasets returned no usable quote.");
    }

    success = true;

    return {
      ...quote,
      source: "provider",
    };
  } finally {
    await recordRequest(supabase, "/prices/snapshot", success);
  }
}

function appendLiveQuote(
  prices: Array<{
    timestamp: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number;
    volume: number | null;
  }>,
  liveQuote: { price: number; timestamp: number } | null,
  currentMarketDate: string,
) {
  if (!liveQuote) return prices;

  const quoteMarketDate = marketIsoDate(
    new Date(liveQuote.timestamp * 1000),
  );

  if (quoteMarketDate !== currentMarketDate) {
    return prices;
  }

  const last = prices.length ? prices[prices.length - 1] : null;

  if (last && liveQuote.timestamp <= last.timestamp) {
    return prices;
  }

  return [
    ...prices,
    {
      timestamp: liveQuote.timestamp,
      open: liveQuote.price,
      high: liveQuote.price,
      low: liveQuote.price,
      close: liveQuote.price,
      volume: null,
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const access = await requireStockPulseAccess(req);
  if (!access.ok) return json({ error: access.error }, access.status);

  const apiKey = Deno.env.get("FINANCIAL_DATASETS_API_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: "Missing required environment variables" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const ticker = normalizeTicker(body?.ticker);

    if (!ticker) {
      return json({ error: "Ticker is required" }, 400);
    }

    const period = String(body?.period ?? "").toUpperCase();
    const interval = intervalFromResolution(
      body?.resolution ?? body?.interval,
    );

    const currentMarketDate = marketIsoDate();
    const requestedEnd =
      isoFromUnix(body?.to) ||
      String(body?.endDate ?? body?.end_date ?? currentMarketDate);

    const endDate =
      requestedEnd > currentMarketDate
        ? currentMarketDate
        : requestedEnd;

    let startDate =
      exactPeriodStart(period, endDate) ||
      isoFromUnix(body?.from) ||
      String(body?.startDate ?? body?.start_date ?? "");

    if (!startDate) {
      const fallback = dateFromIso(endDate);
      fallback.setUTCMonth(fallback.getUTCMonth() - 1);
      startDate = iso(fallback);
    }

    const cacheKey =
      `chart-prices-v3:${ticker}:${interval}:${startDate}:${endDate}`;

    const now = Date.now();

    const { data: cached } = await supabase
      .from("market_data_cache")
      .select("payload,expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (
      cached?.payload &&
      Date.parse(cached.expires_at || "") > now
    ) {
      return json({
        ...cached.payload,
        cacheStatus: "hit",
      });
    }

    const chunks = buildChunks(
      startDate,
      endDate,
      interval,
    );

    const allRows: any[] = [];

    for (const chunk of chunks) {
      const rows = await fetchChunk(
        supabase,
        apiKey,
        ticker,
        interval,
        chunk.startDate,
        chunk.endDate,
      );

      allRows.push(...rows);
    }

    const byTimestamp = new Map<number, any>();

    for (const row of allRows) {
      const p = normalizePrice(row);
      if (p) byTimestamp.set(p.timestamp, p);
    }

    let prices = [...byTimestamp.values()].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    let liveQuote: any = null;

    if (endDate >= currentMarketDate) {
      try {
        liveQuote = await fetchLiveQuote(
          supabase,
          apiKey,
          ticker,
        );

        prices = appendLiveQuote(
          prices,
          liveQuote,
          currentMarketDate,
        );
      } catch (error) {
        console.warn(
          `Could not append live quote for ${ticker}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const candles = prices.map((p) => ({
      t: p.timestamp,
      o: p.open,
      h: p.high,
      l: p.low,
      c: p.close,
      v: p.volume,
    }));

    const payload = {
      ticker,
      interval,
      s: candles.length ? "ok" : "no_data",
      candles,
      prices: candles,
      t: candles.map((x) => x.t),
      o: candles.map((x) => x.o),
      h: candles.map((x) => x.h),
      l: candles.map((x) => x.l),
      c: candles.map((x) => x.c),
      v: candles.map((x) => x.v),
      startDate,
      endDate,
      chunkCount: chunks.length,
      liveQuoteAppended:
        Boolean(
          liveQuote &&
          candles.length &&
          candles[candles.length - 1]?.t === liveQuote.timestamp,
        ),
      liveQuoteSource: liveQuote?.source ?? null,
    };

    const includesCurrent = endDate >= currentMarketDate;
    const ttlMs = !candles.length
      ? NO_DATA_TTL_MS
      : includesCurrent
        ? CURRENT_TTL_MS
        : HISTORICAL_TTL_MS;

    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(now + ttlMs).toISOString();
    const staleUntil = new Date(
      now + HISTORICAL_TTL_MS,
    ).toISOString();

    const { error: cacheError } = await supabase
      .from("market_data_cache")
      .upsert(
        {
          cache_key: cacheKey,
          data_type: "chart-prices-v3",
          ticker,
          parameters: {
            interval,
            startDate,
            endDate,
            period,
          },
          payload,
          fetched_at: fetchedAt,
          expires_at: expiresAt,
          stale_until: staleUntil,
          provider_error: null,
          provider_request_units:
            chunks.length +
            (liveQuote?.source === "provider" ? 1 : 0),
          updated_at: fetchedAt,
        },
        { onConflict: "cache_key" },
      );

    if (cacheError) {
      console.warn(
        "Chart cache write failed:",
        cacheError.message,
      );
    }

    return json({
      ...payload,
      cacheStatus: "refreshed",
      cacheExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error("stock-chart-prices:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chart price request failed",
      },
      500,
    );
  }
});
