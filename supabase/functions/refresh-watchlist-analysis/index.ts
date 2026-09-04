import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SYNC_SECRET = Deno.env.get("STOCK_SYNC_SECRET") || "";
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
});

const tickerOf = (value: unknown) => String(value ?? "").trim().toUpperCase();

async function membership(ticker: string) {
  const [watch, popular] = await Promise.all([
    db.from("watchlist_items").select("company_name").eq("ticker", ticker).limit(1),
    db.from("stock_analysis_popular_universe").select("company_name").eq("ticker", ticker).limit(1),
  ]);
  if (watch.error) throw watch.error;
  if (popular.error) throw popular.error;
  const watchRow = Array.isArray(watch.data) ? watch.data[0] : null;
  const popularRow = Array.isArray(popular.data) ? popular.data[0] : null;
  return {
    active: Boolean(watchRow || popularRow),
    companyName: String(watchRow?.company_name || popularRow?.company_name || ticker).trim() || ticker,
  };
}

async function hasFreshAnalysis(ticker: string) {
  const cutoff = new Date(Date.now() - CACHE_MS).toISOString();
  const { data, error } = await db
    .from("stock_analysis_cache")
    .select("ticker")
    .eq("ticker", ticker)
    .gt("fetched_at", cutoff)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.ticker);
}

async function removeQueue(ticker: string) {
  await db.from("stock_analysis_refresh_queue").delete().eq("ticker", ticker);
}

async function failQueue(ticker: string, message: string) {
  const { data } = await db
    .from("stock_analysis_refresh_queue")
    .select("attempts")
    .eq("ticker", ticker)
    .maybeSingle();
  const attempts = Number(data?.attempts || 0) + 1;
  const delayMinutes = attempts >= 3 ? 24 * 60 : Math.min(attempts, 10) * 60;
  await db.from("stock_analysis_refresh_queue").upsert({
    ticker,
    requested_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    reason: "retry",
    attempts,
    last_error: message.slice(0, 1000),
  }, { onConflict: "ticker" });
}

async function processTicker(ticker: string) {
  const member = await membership(ticker);
  if (!member.active) {
    await removeQueue(ticker);
    await db.from("stock_analysis_cache").delete().eq("ticker", ticker);
    return { ticker, status: "removed" };
  }

  if (await hasFreshAnalysis(ticker)) {
    await removeQueue(ticker);
    return { ticker, status: "fresh", grok_called: false };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stock-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ticker, company_name: member.companyName }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      throw new Error(String(payload?.error || `stock-analysis ${response.status}`));
    }
    await removeQueue(ticker);
    return {
      ticker,
      status: payload?.cached ? "fresh" : "cached",
      grok_called: payload?.cached !== true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis refresh error";
    await failQueue(ticker, message);
    return { ticker, status: "failed", error: message };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SYNC_SECRET || request.headers.get("x-sync-secret") !== SYNC_SECRET) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "Required service configuration is unavailable" }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const direct = tickerOf(body?.ticker);
  const results: any[] = [];

  if (direct) {
    results.push(await processTicker(direct));
  } else {
    const { data, error } = await db.rpc("next_watchlist_analysis_ticker");
    if (error) return json({ ok: false, error: error.message }, 500);
    const ticker = tickerOf(data);
    if (ticker) results.push(await processTicker(ticker));
  }

  return json({ ok: true, processed: results.length, results, finished_at: new Date().toISOString() });
});
