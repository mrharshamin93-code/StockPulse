import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
const BASE_URL = "https://finnhub.io/api/v1";

// In-memory cache: key → { data, expiresAt }
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function cacheSet(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function finnhubGet(path, params = {}, retries = 2) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", FINNHUB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, 1500));
    return finnhubGet(path, params, retries - 1);
  }
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, ticker, tickers } = body;

    // Get current quote for a single ticker
    if (action === "quote") {
      const cacheKey = `quote:${ticker}`;
      const cached = cacheGet(cacheKey);
      if (cached) return Response.json(cached);
      const data = await finnhubGet("/quote", { symbol: ticker });
      const result = { c: data.c, dp: data.dp, d: data.d, pc: data.pc };
      cacheSet(cacheKey, result, 60_000);
      return Response.json(result);
    }

    // Get quotes for multiple tickers at once
    if (action === "quotes") {
      const results = await Promise.all(
        tickers.map(async (t) => {
          const cacheKey = `quote:${t}`;
          const cached = cacheGet(cacheKey) as any;
          if (cached) return { ticker: t, ...cached };
          try {
            const data = await finnhubGet("/quote", { symbol: t });
            const result = { c: data.c, dp: data.dp, d: data.d, pc: data.pc };
            cacheSet(cacheKey, result, 60_000);
            return { ticker: t, ...result };
          } catch {
            return { ticker: t, c: 0, dp: 0, d: 0, pc: 0 };
          }
        })
      );
      return Response.json({ quotes: results });
    }

    // Get 1Y daily candles for sparkline
    if (action === "candles") {
      const cacheKey = `candles:${ticker}`;
      const cached = cacheGet(cacheKey);
      if (cached) return Response.json(cached);
      const to = Math.floor(Date.now() / 1000);
      const from = to - 365 * 24 * 60 * 60;
      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: "W",
        from: String(from),
        to: String(to),
      });
      if (data.s !== "ok") return Response.json({ candles: [] });
      const candles = data.c.map((close, i) => ({ t: data.t[i], v: close }));
      const result = { candles };
      cacheSet(cacheKey, result, 5 * 60_000); // candles cached 5 min
      return Response.json(result);
    }

    // Get candles with custom resolution and range
    if (action === "candles_range") {
      const { resolution = "D", from, to } = body;
      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;
      const cacheKey = `candles_range:${ticker}:${resolution}:${fromTs}:${toTs}`;
      const cached = cacheGet(cacheKey);
      if (cached) return Response.json(cached);
      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: String(resolution),
        from: String(fromTs),
        to: String(toTs),
      });
      if (data.s !== "ok") return Response.json({ candles: [] });
      const candles = data.c.map((close, i) => ({ t: data.t[i], v: close }));
      const result = { candles };
      cacheSet(cacheKey, result, 5 * 60_000); // candles cached 5 min
      return Response.json(result);
    }

    // Get recent company news
    if (action === "news") {
      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const [data, profileData] = await Promise.all([
        finnhubGet("/company-news", { symbol: ticker, from, to }),
        finnhubGet("/stock/profile2", { symbol: ticker }),
      ]);
      const companyName = (profileData.name || "").toLowerCase();
      const tickerLower = ticker.toLowerCase();

      // Return top 10 most recent, with only needed fields
      const all = (Array.isArray(data) ? data : [])
        .sort((a, b) => b.datetime - a.datetime);

      // Filter: headline or summary must mention the ticker or company name
      const relevant = all.filter(a => {
        const text = `${(a.headline || "")} ${(a.summary || "")}`.toLowerCase();
        return text.includes(tickerLower) || (companyName && text.includes(companyName));
      });

      // Pick at most 2 per source for diversity, up to 10 total
      const seenSources: Record<string, number> = {};
      const articles = [];
      // Use relevant first, fall back to all if too few
      const pool = relevant.length >= 3 ? relevant : all;
      for (const a of pool) {
        const src = (a.source || "").toLowerCase();
        seenSources[src] = (seenSources[src] || 0) + 1;
        if (seenSources[src] <= 2) {
          articles.push({ title: a.headline, summary: a.summary, url: a.url, source: a.source, date: new Date(a.datetime * 1000).toLocaleDateString() });
        }
        if (articles.length >= 10) break;
      }
      return Response.json({ articles });
    }

    // Get company profile (includes exchange)
    if (action === "profile") {
      const data = await finnhubGet("/stock/profile2", { symbol: ticker });
      return Response.json({ exchange: data.exchange || null, name: data.name || null, ticker: data.ticker || ticker });
    }

    // Search for tickers by query
    if (action === "search") {
      const data = await finnhubGet("/search", { q: body.query || ticker, exchange: "" });
      const results = (data.result || [])
        .filter(r => r.type === "Common Stock" && r.symbol && !r.symbol.includes("."))
        .slice(0, 8)
        .map(r => ({ ticker: r.symbol, name: r.description, exchange: r.primaryExchange || r.exchange || "" }));
      return Response.json({ results });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});