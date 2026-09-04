import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FD_BASE = "https://api.financialdatasets.ai";
const XAI_URL = "https://api.x.ai/v1/responses";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GROK_MODEL = Deno.env.get("XAI_MODEL") || "grok-4.6";
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_name: { type: "string" },
    valid: { type: "boolean" },
    pros: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    cons: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    summary: { type: "string" },
  },
  required: ["company_name", "valid", "pros", "cons", "summary"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function tickerOf(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function textOf(value: unknown) {
  return String(value ?? "").trim();
}

function finite(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function percent(value: unknown) {
  const n = finite(value);
  return n === null ? null : n * 100;
}

function unwrap(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  for (const key of ["snapshot", "financial_metrics", "financial_metric", "data"]) {
    const candidate = root[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return root;
}

async function freshCache(ticker: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const cutoff = new Date(Date.now() - CACHE_MS).toISOString();
  const { data, error } = await db
    .from("stock_analysis_cache")
    .select("analysis,fetched_at")
    .eq("ticker", ticker)
    .gt("fetched_at", cutoff)
    .maybeSingle();
  if (error) {
    console.error("Analysis cache read failed", error.message);
    return null;
  }
  return data?.analysis && typeof data.analysis === "object" ? data.analysis : null;
}

async function saveCache(ticker: string, analysis: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const now = new Date();
  const { error } = await db.from("stock_analysis_cache").upsert({
    ticker,
    company_name: textOf(analysis.company_name) || ticker,
    analysis,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_MS).toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "ticker" });
  if (error) console.error("Analysis cache write failed", error.message);
}

async function logGrokUsage(ticker: string, payload: any, httpStatus: number, ok: boolean) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const toolCalls = Number(payload?.usage?.num_server_side_tools_used || 0);
  const costTicks = Number(payload?.usage?.cost_in_usd_ticks || 0);
  const { error } = await db.from("grok_api_usage").insert({
    function_name: "stock-analysis",
    ticker,
    model: GROK_MODEL,
    purpose: "stock-analysis",
    tool_calls: Math.max(0, Math.trunc(toolCalls || 0)),
    cost_ticks: Math.max(0, Math.trunc(costTicks || 0)),
    metadata: { http_status: httpStatus, ok },
  });
  if (error) console.error("Grok usage log failed", error.message);
}

async function fetchFD(path: string, ticker: string, apiKey: string) {
  const url = new URL(`${FD_BASE}${path}`);
  url.searchParams.set("ticker", ticker);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-API-KEY": apiKey },
  });
  const raw = await response.text();
  let payload: unknown = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
  return { ok: response.ok, status: response.status, payload };
}

function verifiedMetrics(payload: unknown) {
  const m = unwrap(payload);
  if (!m) return null;
  return {
    marketCapB: finite(m.market_cap) === null ? null : finite(m.market_cap)! / 1_000_000_000,
    pe: finite(m.price_to_earnings_ratio),
    revenueGrowthYoy: percent(m.revenue_growth),
    epsGrowthYoy: percent(m.earnings_per_share_growth),
    grossMargin: percent(m.gross_margin),
    roe: percent(m.return_on_equity),
    debtToEquity: finite(m.debt_to_equity),
    fcfPerShare: finite(m.free_cash_flow_per_share),
  };
}

function groundingMetrics(payload: unknown) {
  const m = unwrap(payload);
  if (!m) return null;
  const allowed = [
    "ticker", "currency", "market_cap", "enterprise_value", "price_to_book_ratio",
    "price_to_earnings_ratio", "price_to_sales_ratio", "enterprise_value_to_ebitda_ratio",
    "enterprise_value_to_revenue_ratio", "free_cash_flow_yield", "peg_ratio", "gross_margin",
    "operating_margin", "net_margin", "return_on_equity", "return_on_assets",
    "return_on_invested_capital", "asset_turnover", "inventory_turnover", "receivables_turnover",
    "days_sales_outstanding", "current_ratio", "quick_ratio", "cash_ratio",
    "operating_cash_flow_ratio", "debt_to_equity", "debt_to_assets", "interest_coverage",
    "revenue_growth", "earnings_growth", "book_value_growth", "earnings_per_share_growth",
    "free_cash_flow_growth", "operating_income_growth", "ebitda_growth", "payout_ratio",
    "earnings_per_share", "book_value_per_share", "free_cash_flow_per_share",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (m[key] !== undefined && m[key] !== null) out[key] = m[key];
  return out;
}

function groundingQuote(payload: unknown) {
  const q = unwrap(payload);
  if (!q) return null;
  const allowed = [
    "ticker", "price", "close", "current_price", "day_change", "change", "change_amount",
    "day_change_percent", "change_percent", "previous_close", "open", "high", "low",
    "volume", "time", "time_milliseconds", "date",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (q[key] !== undefined && q[key] !== null) out[key] = q[key];
  return out;
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const xaiKey = Deno.env.get("XAI_API_KEY");
  const fdKey = Deno.env.get("FINANCIAL_DATASETS_API_KEY");
  if (!xaiKey) return json({ error: "The stock analysis model is not configured" }, 503);
  if (!fdKey) return json({ error: "Financial Datasets is not configured" }, 503);

  try {
    const body = await request.json().catch(() => ({}));
    const ticker = tickerOf(body?.ticker);
    const requestedCompany = textOf(body?.company_name) || ticker;
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return json({ error: "Invalid ticker" }, 400);

    const cached = await freshCache(ticker);
    if (cached) return json({ ...cached, cached: true });

    const [metricsResult, quoteResult] = await Promise.all([
      fetchFD("/financial-metrics/snapshot", ticker, fdKey),
      fetchFD("/prices/snapshot", ticker, fdKey),
    ]);

    const fdMetrics = metricsResult.ok ? groundingMetrics(metricsResult.payload) : null;
    const displayMetrics = metricsResult.ok ? verifiedMetrics(metricsResult.payload) : null;
    const fdQuote = quoteResult.ok ? groundingQuote(quoteResult.payload) : null;

    if (!fdMetrics && !fdQuote && metricsResult.status === 404 && quoteResult.status === 404) {
      const invalid = {
        company_name: requestedCompany,
        valid: false,
        pros: [],
        cons: [],
        summary: "",
        metrics: {},
      };
      await saveCache(ticker, invalid);
      return json({ ...invalid, cached: false });
    }

    if (!fdMetrics && !fdQuote) {
      return json({ error: "Verified financial data is temporarily unavailable" }, 502);
    }

    const response = await fetch(XAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROK_MODEL,
        reasoning: { effort: "medium" },
        store: false,
        max_output_tokens: 1800,
        max_turns: 3,
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "system",
            content: "You are a cautious equity research assistant for StockPulse. Financial Datasets is the authoritative source for numeric stock and financial figures supplied in the prompt. Do not replace those figures with numbers found on the web. Use web search for recent company developments, earnings context, catalysts and risks. Prefer primary company releases, SEC materials and reputable reporting. Do not promise returns or provide personalized financial advice.",
          },
          {
            role: "user",
            content: `Analyze ${requestedCompany} (${ticker}).\n\nVERIFIED FINANCIAL DATA FROM FINANCIAL DATASETS:\n${JSON.stringify({ ticker, company_name: requestedCompany, quote: fdQuote, financial_metrics: fdMetrics })}\n\nUse those supplied values for numeric financial claims. You may independently search the web for current qualitative news and developments. Return 4-6 concise bullish arguments, 4-6 concise bearish risks, a balanced 2-3 sentence summary, the recognized company name, and whether this is a valid publicly traded stock. Do not invent a numeric fact that is absent from the supplied Financial Datasets data.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "stock_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const rawResponse = await response.text();
    let xaiPayload: any = {};
    try { xaiPayload = rawResponse ? JSON.parse(rawResponse) : {}; } catch { xaiPayload = {}; }
    await logGrokUsage(ticker, xaiPayload, response.status, response.ok);

    if (!response.ok) {
      console.error("xAI response error", response.status, xaiPayload?.error);
      return json({ error: "Unable to generate stock analysis" }, 502);
    }

    const raw = outputText(xaiPayload);
    if (!raw) return json({ error: "The analysis model returned no result" }, 502);

    const parsed = JSON.parse(raw);
    const result = { ...parsed, metrics: displayMetrics || {} };
    await saveCache(ticker, result);
    return json({ ...result, cached: false });
  } catch (error) {
    console.error("stock-analysis error", error);
    return json({ error: "Unable to generate stock analysis" }, 500);
  }
});
