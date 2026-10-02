import { createClient } from "npm:@supabase/supabase-js@2";

const API_URL = "https://api.financialdatasets.ai/prices/snapshot/market";
const SNAPSHOT_TABLE = "stock_intraday_snapshots";
const STOCKS_TABLE = "stock_screener_stocks";
const UPSERT_CHUNK_SIZE = 750;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeTicker(value: unknown): string { return String(value ?? "").trim().toUpperCase(); }
function newYorkTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}
function isRegularMarketSnapshotTime(now = new Date()) {
  const { weekday, hour, minute } = newYorkTimeParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const minuteOfDay = hour * 60 + minute;
  return minuteOfDay >= 570 && minuteOfDay <= 960;
}
function thirtyMinuteBucketIso(now = new Date()) {
  const bucketMs = Math.floor(now.getTime() / (30 * 60 * 1000)) * 30 * 60 * 1000;
  return new Date(bucketMs).toISOString();
}
async function loadActiveCommonStockSymbols(supabase: ReturnType<typeof createClient>) {
  const symbols = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(STOCKS_TABLE).select("symbol").eq("is_active", true).eq("is_common_stock", true).order("symbol", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load active stock universe: ${error.message}`);
    for (const row of data ?? []) { const symbol = normalizeTicker(row?.symbol); if (symbol) symbols.add(symbol); }
    if (!data || data.length < pageSize) break;
  }
  return symbols;
}
async function upsertInChunks(supabase: ReturnType<typeof createClient>, rows: Array<{ticker:string;bucket_start:string;price:number;source_fetched_at:string;updated_at:string;}>) {
  let saved = 0;
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(SNAPSHOT_TABLE).upsert(chunk, { onConflict: "ticker,bucket_start" });
    if (error) throw new Error(`Could not store intraday snapshot chunk: ${error.message}`);
    saved += chunk.length;
  }
  return saved;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  const expectedSecret = Deno.env.get("STOCK_SYNC_SECRET");
  const receivedSecret = request.headers.get("x-sync-secret");
  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) return jsonResponse({ ok: false, error: "Unauthorized market snapshot sync request." }, 401);
  const apiKey = Deno.env.get("FINANCIAL_DATASETS_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) return jsonResponse({ ok: false, error: "FINANCIAL_DATASETS_API_KEY is not configured." }, 503);
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: "Supabase service credentials are unavailable." }, 503);
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;
  const now = new Date();
  if (!force && !isRegularMarketSnapshotTime(now)) return jsonResponse({ ok: true, status: "skipped", reason: "outside-regular-market-hours", checkedAt: now.toISOString() });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const activeSymbols = await loadActiveCommonStockSymbols(supabase);
    const response = await fetch(API_URL, { headers: { Accept: "application/json", "X-API-KEY": apiKey } });
    const text = await response.text();
    let payload: any = null;
    if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }
    if (!response.ok) {
      const providerMessage = payload && typeof payload === "object" ? String(payload?.message || payload?.error || payload?.detail || "") : String(payload || "");
      throw new Error(providerMessage || `Financial Datasets market snapshot returned status ${response.status}.`);
    }
    const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];
    const fetchedAt = now.toISOString();
    const bucketStart = thirtyMinuteBucketIso(now);
    const rows = snapshots.map((snapshot: any) => {
      const ticker = normalizeTicker(snapshot?.ticker);
      const price = finiteNumber(snapshot?.price);
      if (!ticker || price === null || price <= 0 || !activeSymbols.has(ticker)) return null;
      return { ticker, bucket_start: bucketStart, price, source_fetched_at: fetchedAt, updated_at: fetchedAt };
    }).filter(Boolean);
    if (rows.length === 0) throw new Error("Financial Datasets returned no usable active common-stock snapshots.");
    const saved = await upsertInChunks(supabase, rows);
    return jsonResponse({ ok: true, status: "completed", providerSnapshots: snapshots.length, activeCommonStocks: activeSymbols.size, snapshotsSaved: saved, bucketStart, fetchedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market snapshot sync error.";
    console.error("sync-market-intraday-snapshots:", error);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});