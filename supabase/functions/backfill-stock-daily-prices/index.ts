import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://api.financialdatasets.ai";
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const LOOKBACK_DAYS = 55;
const CONCURRENCY = 5;
const TARGET_CANDLES = 30;
const MARKET_TIME_ZONE = "America/New_York";

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
function finiteNumber(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
function timestampToDate(value: unknown): string | null { const text = String(value ?? "").trim(); if (!text) return null; const ms = Date.parse(text); if (!Number.isFinite(ms)) return null; return new Date(ms).toISOString().slice(0, 10); }
function marketIsoDate(date: Date): string { const parts = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""; return `${get("year")}-${get("month")}-${get("day")}`; }
function subtractDays(isoDate: string, days: number): string { const date = new Date(`${isoDate}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); }
function cursorFromNextPageUrl(value: unknown): string | null { const text = String(value ?? "").trim(); if (!text) return null; try { const url = new URL(text, API_BASE); if (url.origin !== new URL(API_BASE).origin) return null; return url.searchParams.get("cursor")?.trim() || null; } catch { return null; } }

async function fetchPricePage(ticker: string, apiKey: string, startDate: string, endDate: string, cursor: string | null) {
  const url = new URL(`${API_BASE}/prices`); url.searchParams.set("ticker", ticker); url.searchParams.set("interval", "day"); url.searchParams.set("start_date", startDate); url.searchParams.set("end_date", endDate); if (cursor) url.searchParams.set("cursor", cursor);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
  try { const response = await fetch(url.toString(), { headers: { Accept: "application/json", "X-API-KEY": apiKey }, signal: controller.signal }); const text = await response.text(); let payload: any = null; try { payload = text ? JSON.parse(text) : null; } catch { payload = text; } if (!response.ok) { const message = payload && typeof payload === "object" ? String(payload.message ?? payload.error ?? `HTTP ${response.status}`) : `HTTP ${response.status}`; throw new Error(message); } return payload; } finally { clearTimeout(timeout); }
}

async function fetchPrices(ticker: string, apiKey: string, startDate: string, endDate: string) {
  const byDate = new Map<string, any>(); const seenCursors = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; page < 3; page += 1) {
    const payload = await fetchPricePage(ticker, apiKey, startDate, endDate, cursor); const prices = Array.isArray(payload?.prices) ? payload.prices : [];
    for (const row of prices) { const tradingDate = timestampToDate(row.date ?? row.time); const close = finiteNumber(row.close ?? row.price); if (!tradingDate || close === null || close <= 0) continue; byDate.set(tradingDate, { ticker, trading_date: tradingDate, open: finiteNumber(row.open), high: finiteNumber(row.high), low: finiteNumber(row.low), close, updated_at: new Date().toISOString() }); }
    if (byDate.size >= TARGET_CANDLES) break;
    const nextCursor = cursorFromNextPageUrl(payload?.next_page_url); if (!nextCursor || seenCursors.has(nextCursor)) break; seenCursors.add(nextCursor); cursor = nextCursor;
  }
  return [...byDate.values()].sort((a, b) => b.trading_date.localeCompare(a.trading_date)).slice(0, TARGET_CANDLES).sort((a, b) => a.trading_date.localeCompare(b.trading_date));
}

function validateRecentHistory(rows: any[], endDate: string): string | null { if (rows.length < TARGET_CANDLES) return `Only ${rows.length} usable daily candles returned; need ${TARGET_CANDLES}`; const sorted = [...rows].sort((a, b) => b.trading_date.localeCompare(a.trading_date)); const latest = sorted[0]?.trading_date; const thirtieth = sorted[TARGET_CANDLES - 1]?.trading_date; if (!latest || latest < subtractDays(endDate, 7)) return `Latest candle ${latest ?? "missing"} is stale`; if (!thirtieth || thirtieth < subtractDays(endDate, 55)) return `Recent 30-candle history is incomplete; 30th candle is ${thirtieth ?? "missing"}`; return null; }
async function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) { const results: R[] = []; for (let i = 0; i < items.length; i += concurrency) results.push(...await Promise.all(items.slice(i, i + concurrency).map(fn))); return results; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405); const expectedSecret = Deno.env.get("STOCK_SYNC_SECRET"); const receivedSecret = req.headers.get("x-sync-secret"); if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) return json({ ok: false, error: "Unauthorized" }, 401);
  const apiKey = Deno.env.get("FINANCIAL_DATASETS_API_KEY"); const supabaseUrl = Deno.env.get("SUPABASE_URL"); const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!apiKey || !supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Missing required environment variables" }, 503);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await req.json().catch(() => ({})); const requested = Math.trunc(Number(body?.batchSize)); const batchSize = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_BATCH_SIZE) : DEFAULT_BATCH_SIZE;
  const loadQueue = async (limit: number) => { const { data, error } = await supabase.rpc("get_stock_daily_price_backfill_queue", { p_limit: limit }); if (error) throw new Error(error.message); return (data ?? []).map((r: any) => String(r.symbol ?? "").trim().toUpperCase()).filter(Boolean); };
  const finishBackfill = async () => { const { data, error } = await supabase.rpc("finish_stock_daily_prices_backfill"); if (error) return { unscheduled: false, error: error.message }; return { unscheduled: data === true, error: null }; };
  let symbols: string[]; try { symbols = await loadQueue(batchSize); } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : "Could not load backfill queue" }, 500); }
  if (!symbols.length) { const completion = await finishBackfill(); return json({ ok: true, status: "complete", symbolsRequested: 0, symbolsSucceeded: 0, symbolsFailed: 0, cronUnscheduled: completion.unscheduled, cronUnscheduleError: completion.error }); }
  const endDate = marketIsoDate(new Date()); const startDate = subtractDays(endDate, LOOKBACK_DAYS);
  const results = await mapLimit(symbols, CONCURRENCY, async (symbol) => { const checkedAt = new Date().toISOString(); try { const rows = await fetchPrices(symbol, apiKey, startDate, endDate); const validationError = validateRecentHistory(rows, endDate); if (rows.length > 0) { const { error } = await supabase.from("stock_daily_prices").upsert(rows, { onConflict: "ticker,trading_date" }); if (error) throw new Error(error.message); } const success = validationError === null; const { error: statusError } = await supabase.from("stock_daily_price_backfill_status").upsert({ ticker: symbol, checked_at: checkedAt, rows_stored: rows.length, success, error: validationError }, { onConflict: "ticker" }); if (statusError) throw new Error(statusError.message); return { symbol, ok: success, rows: rows.length, error: validationError }; } catch (error) { const message = error instanceof Error ? error.message : "Unknown error"; await supabase.from("stock_daily_price_backfill_status").upsert({ ticker: symbol, checked_at: checkedAt, rows_stored: 0, success: false, error: message.slice(0, 1000) }, { onConflict: "ticker" }); return { symbol, ok: false, rows: 0, error: message }; } });
  const succeeded = results.filter((r: any) => r.ok); const failed = results.filter((r: any) => !r.ok); let cronUnscheduled = false; let cronUnscheduleError: string | null = null; try { const remaining = await loadQueue(1); if (remaining.length === 0) { const completion = await finishBackfill(); cronUnscheduled = completion.unscheduled; cronUnscheduleError = completion.error; } } catch (error) { cronUnscheduleError = error instanceof Error ? error.message : "Could not verify remaining backfill queue"; }
  return json({ ok: succeeded.length > 0, status: failed.length === 0 ? "completed" : succeeded.length ? "partial" : "failed", symbolsRequested: symbols.length, symbolsSucceeded: succeeded.length, symbolsFailed: failed.length, rowsInsertedOrUpdated: results.reduce((sum: number, r: any) => sum + r.rows, 0), failures: failed.slice(0, 20), startDate, endDate, targetCandles: TARGET_CANDLES, cronUnscheduled, cronUnscheduleError });
});