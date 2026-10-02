import { requireStockPulseAccess } from "../_shared/entitlement.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}
function normalizeTicker(value: unknown) { return String(value ?? "").trim().toUpperCase(); }
function stripCitationArtifacts(value: unknown) {
  if (typeof value !== "string") return value;
  return value.replace(/\s*\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]\s*$/g, "").replace(/(?<=[.!?])\s+\d{1,2}\s*$/g, "").trim();
}
function sanitizeAnalysis(analysis: any) {
  if (!analysis || typeof analysis !== "object") return analysis;
  return {
    ...analysis,
    summary: stripCitationArtifacts(analysis.summary),
    pros: Array.isArray(analysis.pros) ? analysis.pros.map((item: any) => ({ ...item, title: stripCitationArtifacts(item?.title), detail: stripCitationArtifacts(item?.detail) })) : [],
    cons: Array.isArray(analysis.cons) ? analysis.cons.map((item: any) => ({ ...item, title: stripCitationArtifacts(item?.title), detail: stripCitationArtifacts(item?.detail) })) : [],
  };
}
async function freshCache(ticker: string) {
  const { data, error } = await db.from("stock_analysis_cache").select("analysis,expires_at").eq("ticker", ticker).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data?.analysis) return null;
  return sanitizeAnalysis(data.analysis);
}
async function saveCache(ticker: string, analysis: any) {
  const now = new Date();
  const clean = sanitizeAnalysis(analysis);
  const { error } = await db.from("stock_analysis_cache").upsert({ ticker, company_name: clean?.company_name || ticker, analysis: clean, fetched_at: now.toISOString(), expires_at: new Date(now.getTime() + CACHE_MS).toISOString(), updated_at: now.toISOString() }, { onConflict: "ticker" });
  if (error) throw error;
}
async function tickerExists(ticker: string): Promise<boolean | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/financial-datasets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "quote", ticker }),
    });

    if (response.ok) return true;

    const text = await response.text().catch(() => "");
    if (
      response.status === 404 ||
      (response.status === 400 &&
        /valid ticker|invalid ticker|not found|no prices/i.test(text))
    ) {
      return false;
    }

    return null;
  } catch {
    return null;
  }
}
async function generateAndCache(ticker: string, companyName: string) {
  try {
    const exists = await tickerExists(ticker);
    if (exists === false) {
      await saveCache(ticker, { company_name: companyName || ticker, valid: false, pros: [], cons: [], summary: "", metrics: {} });
      return;
    }
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stock-analysis`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, company_name: companyName }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) { console.error("stock-analysis-job generation failed", ticker, response.status, payload?.error); return; }
    if (payload?.valid === false) {
      await saveCache(ticker, { ...payload, company_name: payload?.company_name || companyName || ticker, valid: false, pros: [], cons: [], summary: "", metrics: payload?.metrics || {} });
      return;
    }
    if (typeof payload?.summary !== "string") { console.warn("stock-analysis-job incomplete result", ticker); return; }
    await saveCache(ticker, payload);
  } catch (error) { console.error("stock-analysis-job background error", ticker, error); }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const access = await requireStockPulseAccess(request);
  if (!access.ok) return json({ error: access.error }, access.status);
  if (!request.headers.get("Authorization")?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Service unavailable" }, 503);
  const body = await request.json().catch(() => ({}));
  const ticker = normalizeTicker(body?.ticker);
  const companyName = String(body?.company_name ?? ticker).trim() || ticker;
  const mode = String(body?.mode ?? "start").trim().toLowerCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return json({ status: "ready", analysis: { company_name: ticker, valid: false, pros: [], cons: [], summary: "", metrics: {} } });
  const cached = await freshCache(ticker);
  if (cached) return json({ status: "ready", analysis: { ...cached, cached: true } });
  if (mode === "status") return json({ status: "pending" });
  if (mode !== "start") return json({ error: "Invalid mode" }, 400);
  const task = generateAndCache(ticker, companyName);
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task); else task.catch((error) => console.error("stock-analysis-job detached task failed", ticker, error));
  return json({ status: "pending" }, 202);
});