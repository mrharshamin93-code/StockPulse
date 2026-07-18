const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

// In-memory cache: key -> { data, expiresAt }
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function finnhubGet(path, params = {}, retries = 2) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", FINNHUB_API_KEY);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString());

  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return finnhubGet(path, params, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Finnhub error: ${res.status}`);
  }

  return res.json();
}

function getBody(req) {
  if (req.method === "GET") {
    const {
      action,
      ticker,
      query,
      resolution,
      from,
      to,
      tickers,
    } = req.query;

    let parsedTickers = tickers;
    if (typeof tickers === "string") {
      try {
        parsedTickers = JSON.parse(tickers);
      } catch {
        parsedTickers = tickers.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    return {
      action,
      ticker,
      query,
      resolution,
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      tickers: Array.isArray(parsedTickers) ? parsedTickers : [],
    };
  }

  return req.body || {};
}

export default async function handler(req, res) {
  if (!FINNHUB_API_KEY) {
    return res.status(500).json({ error: "Missing FINNHUB_API_KEY" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = getBody(req);
    const { action, ticker, tickers } = body;

    if (action === "quote") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const cacheKey = `quote:${ticker}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.status(200).json(cached);

      const data = await finnhubGet("/quote", { symbol: ticker });
      const result = { c: data.c, dp: data.dp, d: data.d, pc: data.pc };
      cacheSet(cacheKey, result, 60_000);

      return res.status(200).json(result);
    }

    if (action === "quotes") {
      if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: "Missing tickers" });
      }

      const results = await Promise.all(
        tickers.map(async (t) => {
          const cacheKey = `quote:${t}`;
          const cached = cacheGet(cacheKey);
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

      return res.status(200).json({ quotes: results });
    }

    if (action === "candles") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const cacheKey = `candles:${ticker}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.status(200).json(cached);

      const to = Math.floor(Date.now() / 1000);
      const from = to - 365 * 24 * 60 * 60;

      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: "W",
        from: String(from),
        to: String(to),
      });

      if (data.s !== "ok") {
        return res.status(200).json({ candles: [] });
      }

      const candles = data.c.map((close, i) => ({
        t: data.t[i],
        v: close,
      }));

      const result = { candles };
      cacheSet(cacheKey, result, 5 * 60_000);

      return res.status(200).json(result);
    }

    if (action === "candles_range") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const { resolution = "D", from, to } = body;
      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;

      const cacheKey = `candles_range:${ticker}:${resolution}:${fromTs}:${toTs}`;
      const cached = cacheGet(cacheKey);
      if (cached) return res.status(200).json(cached);

      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: String(resolution),
        from: String(fromTs),
        to: String(toTs),
      });

      if (data.s !== "ok") {
        return res.status(200).json({ candles: [] });
      }

      const candles = data.c.map((close, i) => ({
        t: data.t[i],
        v: close,
      }));

      const result = { candles };
      cacheSet(cacheKey, result, 5 * 60_000);

      return res.status(200).json(result);
    }

    if (action === "news") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const [data, profileData] = await Promise.all([
        finnhubGet("/company-news", { symbol: ticker, from, to }),
        finnhubGet("/stock/profile2", { symbol: ticker }),
      ]);

      const companyName = (profileData.name || "").toLowerCase();
      const tickerLower = ticker.toLowerCase();

      const all = (Array.isArray(data) ? data : []).sort(
        (a, b) => b.datetime - a.datetime
      );

      const relevant = all.filter((a) => {
        const text = `${a.headline || ""} ${a.summary || ""}`.toLowerCase();
        return text.includes(tickerLower) || (companyName && text.includes(companyName));
      });

      const seenSources = {};
      const articles = [];
      const pool = relevant.length >= 3 ? relevant : all;

      for (const a of pool) {
        const src = (a.source || "").toLowerCase();
        seenSources[src] = (seenSources[src] || 0) + 1;

        if (seenSources[src] <= 2) {
          articles.push({
            title: a.headline,
            summary: a.summary,
            url: a.url,
            source: a.source,
            date: new Date(a.datetime * 1000).toLocaleDateString(),
          });
        }

        if (articles.length >= 10) break;
      }

      return res.status(200).json({ articles });
    }

    if (action === "profile") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const data = await finnhubGet("/stock/profile2", { symbol: ticker });

      return res.status(200).json({
        exchange: data.exchange || null,
        name: data.name || null,
        ticker: data.ticker || ticker,
      });
    }

    if (action === "search") {
      const query = body.query || ticker;

      if (!query) {
        return res.status(400).json({ error: "Missing query" });
      }

      const data = await finnhubGet("/search", {
        q: query,
        exchange: "",
      });

      const results = (data.result || [])
        .filter((r) => r.type === "Common Stock" && r.symbol && !r.symbol.includes("."))
        .slice(0, 8)
        .map((r) => ({
          ticker: r.symbol,
          name: r.description,
          exchange: r.primaryExchange || r.exchange || "",
        }));

      return res.status(200).json({ results });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
