const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

const cache = new Map();
const inFlight = new Map();
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

const cache = new Map();
const inFlight = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function withCache(key, ttlMs, fetcher) {
  const cached = cacheGet(key);
  if (cached) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const data = await fetcher();
      cacheSet(key, data, ttlMs);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

async function finnhubGet(path, params = {}, retries = 2) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", FINNHUB_API_KEY);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString());

  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return finnhubGet(path, params, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Finnhub error: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

function getBody(req) {
  if (req.method === "GET") {
    const {
      action, ticker, query, q, resolution, from, to, tickers,
    } = req.query;

    let parsedTickers = tickers;
    if (typeof tickers === "string") {
      try {
        parsedTickers = JSON.parse(tickers);
      } catch {
        parsedTickers = tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
      }
    }

    return {
      action,
      ticker: ticker ? String(ticker).trim().toUpperCase() : undefined,
      query: query || q,
      resolution,
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      tickers: Array.isArray(parsedTickers)
        ? parsedTickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
        : [],
    };
  }

  const body = req.body || {};
  return {
    ...body,
    ticker: body.ticker ? String(body.ticker).trim().toUpperCase() : undefined,
    query: body.query || body.q,
    tickers: Array.isArray(body.tickers)
      ? body.tickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
      : [],
  };
}

function mapQuoteData(ticker, data) {
  return {
    ticker,
    c: typeof data?.c === "number" ? data.c : null,
    dp: typeof data?.dp === "number" ? data.dp : null,
    d: typeof data?.d === "number" ? data.d : null,
    pc: typeof data?.pc === "number" ? data.pc : null,
    h: typeof data?.h === "number" ? data.h : null,
    l: typeof data?.l === "number" ? data.l : null,
    o: typeof data?.o === "number" ? data.o : null,
    t: data?.t ?? null,
  };
}

function emptyQuote(ticker, error = null) {
  return {
    ticker,
    c: null, dp: null, d: null, pc: null, h: null, l: null, o: null, t: null,
    ...(error ? { error } : {}),
  };
}

// ---------- YAHOO FINANCE CANDLE FETCH (UPDATED) ----------
async function fetchYahooCandles(ticker, fromTs, toTs, resolution) {
  // Map resolution to Yahoo interval
  const intervalMap = {
    "5": "5m",   // 1D (5‑minute)
    "60": "60m", // 1W (60‑minute)
    "D": "1d",
    "W": "1wk",
    "M": "1mo",
  };
  const yahooInterval = intervalMap[resolution] || "1d";

  // Yahoo v8 chart endpoint
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?period1=${fromTs}&period2=${toTs}&interval=${yahooInterval}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`Yahoo chart fetch failed for ${ticker}: ${res.status}`);
    return { candles: [] };
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    console.error(`No chart data for ${ticker}`);
    return { candles: [] };
  }

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  const closes = quotes?.close || [];

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      candles.push({ t: timestamps[i], v: closes[i] });
    }
  }

  // Ensure chronological order (oldest first)
  candles.sort((a, b) => a.t - b.t);

  return { candles };
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

    // ---------- QUOTE (single) ----------
    if (action === "quote") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`quote:${ticker}`, 15_000, async () => {
        const data = await finnhubGet("/quote", { symbol: ticker });
        return mapQuoteData(ticker, data);
      });
      return res.status(200).json(result);
    }

    // ---------- QUOTES (batch) ----------
    if (action === "quotes") {
      if (!Array.isArray(tickers) || tickers.length === 0)
        return res.status(400).json({ error: "Missing tickers" });

      const results = await Promise.all(
        tickers.map(async (t) => {
          const nt = String(t).trim().toUpperCase();
          try {
            return await withCache(`quote:${nt}`, 15_000, async () => {
              const data = await finnhubGet("/quote", { symbol: nt });
              return mapQuoteData(nt, data);
            });
          } catch (error) {
            return emptyQuote(nt, error?.message || "Failed to fetch quote");
          }
        })
      );
      return res.status(200).json({ quotes: results });
    }

    // ---------- CANDLES (yearly/weekly) ----------
    if (action === "candles") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const toTs = Math.floor(Date.now() / 1000);
      const fromTs = toTs - 365 * 24 * 60 * 60;
      const result = await withCache(`candles:${ticker}:W`, 5 * 60_000, async () =>
        fetchYahooCandles(ticker, fromTs, toTs, "W")
      );
      return res.status(200).json(result);
    }

    // ---------- CANDLES_RANGE (custom period & resolution) ----------
    if (action === "candles_range") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const { resolution = "D", from, to } = body;
      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;
      const cacheKey = `candles_range:${ticker}:${resolution}:${fromTs}:${toTs}`;
      const result = await withCache(cacheKey, 5 * 60_000, async () =>
        fetchYahooCandles(ticker, fromTs, toTs, resolution)
      );
      return res.status(200).json(result);
    }

    // ---------- NEWS ----------
    if (action === "news") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`news:${ticker}`, 10 * 60_000, async () => {
        const toDate = new Date().toISOString().split("T")[0];
        const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const [data, profileData] = await Promise.all([
          finnhubGet("/company-news", { symbol: ticker, from: fromDate, to: toDate }),
          finnhubGet("/stock/profile2", { symbol: ticker }),
        ]);
        const companyName = (profileData.name || "").toLowerCase();
        const tickerLower = ticker.toLowerCase();
        const all = (Array.isArray(data) ? data : []).sort(
          (a, b) => b.datetime - a.datetime
        );
        const relevant = all.filter((a) => {
          const text = `${a.headline || ""} ${a.summary || ""}`.toLowerCase();
          return (
            text.includes(tickerLower) ||
            (companyName && text.includes(companyName))
          );
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
        return { articles };
      });
      return res.status(200).json(result);
    }

    // ---------- PROFILE ----------
    if (action === "profile") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`profile:${ticker}`, 24 * 60 * 60_000, async () => {
        const data = await finnhubGet("/stock/profile2", { symbol: ticker });
        return {
          exchange: data.exchange || null,
          name: data.name || null,
          ticker: data.ticker || ticker,
        };
      });
      return res.status(200).json(result);
    }

    // ---------- SEARCH ----------
    if (action === "search") {
      const query = body.query || ticker;
      if (!query) return res.status(400).json({ error: "Missing query" });
      const normalizedQuery = String(query).trim();
      const result = await withCache(
        `search:${normalizedQuery.toUpperCase()}`,
        5 * 60_000,
        async () => {
          const data = await finnhubGet("/search", { q: normalizedQuery });
          const results = (data.result || [])
            .filter((r) => {
              const symbol = String(r?.symbol || "").trim();
              const type = String(r?.type || "").toLowerCase();
              return (
                symbol &&
                !symbol.includes(".") &&
                (type.includes("stock") ||
                  type.includes("equity") ||
                  type === "" ||
                  type.includes("common"))
              );
            })
            .slice(0, 8)
            .map((r) => ({
              ticker: String(r.symbol || "").trim().toUpperCase(),
              name: String(
                r.description || r.displaySymbol || r.symbol || ""
              ).trim(),
              exchange: String(
                r.primaryExchange || r.exchange || ""
              ).trim(),
              symbol: String(r.symbol || "").trim().toUpperCase(),
              description: String(
                r.description || r.displaySymbol || r.symbol || ""
              ).trim(),
              primaryExchange: String(
                r.primaryExchange || r.exchange || ""
              ).trim(),
            }))
            .filter((r) => r.ticker);
          return { results, result: results };
        }
      );
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error("Finnhub proxy error:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function withCache(key, ttlMs, fetcher) {
  const cached = cacheGet(key);
  if (cached) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const data = await fetcher();
      cacheSet(key, data, ttlMs);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

async function finnhubGet(path, params = {}, retries = 2) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", FINNHUB_API_KEY);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString());

  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 1500));
    return finnhubGet(path, params, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Finnhub error: ${res.status} ${res.statusText} - ${text}`);
  }

  return res.json();
}

function getBody(req) {
  if (req.method === "GET") {
    const {
      action, ticker, query, q, resolution, from, to, tickers,
    } = req.query;

    let parsedTickers = tickers;
    if (typeof tickers === "string") {
      try {
        parsedTickers = JSON.parse(tickers);
      } catch {
        parsedTickers = tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
      }
    }

    return {
      action,
      ticker: ticker ? String(ticker).trim().toUpperCase() : undefined,
      query: query || q,
      resolution,
      from: from ? Number(from) : undefined,
      to: to ? Number(to) : undefined,
      tickers: Array.isArray(parsedTickers)
        ? parsedTickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
        : [],
    };
  }

  const body = req.body || {};
  return {
    ...body,
    ticker: body.ticker ? String(body.ticker).trim().toUpperCase() : undefined,
    query: body.query || body.q,
    tickers: Array.isArray(body.tickers)
      ? body.tickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
      : [],
  };
}

function mapQuoteData(ticker, data) {
  return {
    ticker,
    c: typeof data?.c === "number" ? data.c : null,
    dp: typeof data?.dp === "number" ? data.dp : null,
    d: typeof data?.d === "number" ? data.d : null,
    pc: typeof data?.pc === "number" ? data.pc : null,
    h: typeof data?.h === "number" ? data.h : null,
    l: typeof data?.l === "number" ? data.l : null,
    o: typeof data?.o === "number" ? data.o : null,
    t: data?.t ?? null,
  };
}

function emptyQuote(ticker, error = null) {
  return {
    ticker,
    c: null, dp: null, d: null, pc: null, h: null, l: null, o: null, t: null,
    ...(error ? { error } : {}),
  };
}

// ==================== YAHOO FINANCE CANDLE FETCH ====================
async function fetchYahooCandles(ticker, fromTs, toTs) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?period1=${fromTs}&period2=${toTs}&interval=1d&range=30d`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`Yahoo chart fetch failed for ${ticker}: ${res.status}`);
    return { candles: [] };
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    console.error(`No chart data for ${ticker}`);
    return { candles: [] };
  }

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  const closes = quotes?.close || [];

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      candles.push({ t: timestamps[i], v: closes[i] });
    }
  }

  return { candles };
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

    // ---------- QUOTE (single) ----------
    if (action === "quote") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`quote:${ticker}`, 15_000, async () => {
        const data = await finnhubGet("/quote", { symbol: ticker });
        return mapQuoteData(ticker, data);
      });
      return res.status(200).json(result);
    }

    // ---------- QUOTES (batch) ----------
    if (action === "quotes") {
      if (!Array.isArray(tickers) || tickers.length === 0)
        return res.status(400).json({ error: "Missing tickers" });

      const results = await Promise.all(
        tickers.map(async (t) => {
          const nt = String(t).trim().toUpperCase();
          try {
            return await withCache(`quote:${nt}`, 15_000, async () => {
              const data = await finnhubGet("/quote", { symbol: nt });
              return mapQuoteData(nt, data);
            });
          } catch (error) {
            return emptyQuote(nt, error?.message || "Failed to fetch quote");
          }
        })
      );
      return res.status(200).json({ quotes: results });
    }

    // ---------- CANDLES (yearly, weekly) ----------
    if (action === "candles") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const toTs = Math.floor(Date.now() / 1000);
      const fromTs = toTs - 365 * 24 * 60 * 60;
      const result = await withCache(`candles:${ticker}`, 5 * 60_000, async () =>
        fetchYahooCandles(ticker, fromTs, toTs)
      );
      return res.status(200).json(result);
    }

    // ---------- CANDLES_RANGE (30 day) ----------
    if (action === "candles_range") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const { from, to } = body;
      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;
      const cacheKey = `candles_range:${ticker}:${fromTs}:${toTs}`;
      const result = await withCache(cacheKey, 5 * 60_000, async () =>
        fetchYahooCandles(ticker, fromTs, toTs)
      );
      return res.status(200).json(result);
    }

    // ---------- NEWS ----------
    if (action === "news") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`news:${ticker}`, 10 * 60_000, async () => {
        const toDate = new Date().toISOString().split("T")[0];
        const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const [data, profileData] = await Promise.all([
          finnhubGet("/company-news", { symbol: ticker, from: fromDate, to: toDate }),
          finnhubGet("/stock/profile2", { symbol: ticker }),
        ]);
        const companyName = (profileData.name || "").toLowerCase();
        const tickerLower = ticker.toLowerCase();
        const all = (Array.isArray(data) ? data : []).sort(
          (a, b) => b.datetime - a.datetime
        );
        const relevant = all.filter((a) => {
          const text = `${a.headline || ""} ${a.summary || ""}`.toLowerCase();
          return (
            text.includes(tickerLower) ||
            (companyName && text.includes(companyName))
          );
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
        return { articles };
      });
      return res.status(200).json(result);
    }

    // ---------- PROFILE ----------
    if (action === "profile") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const result = await withCache(`profile:${ticker}`, 24 * 60 * 60_000, async () => {
        const data = await finnhubGet("/stock/profile2", { symbol: ticker });
        return {
          exchange: data.exchange || null,
          name: data.name || null,
          ticker: data.ticker || ticker,
        };
      });
      return res.status(200).json(result);
    }

    // ---------- SEARCH ----------
    if (action === "search") {
      const query = body.query || ticker;
      if (!query) return res.status(400).json({ error: "Missing query" });
      const normalizedQuery = String(query).trim();
      const result = await withCache(`search:${normalizedQuery.toUpperCase()}`, 5 * 60_000, async () => {
        const data = await finnhubGet("/search", { q: normalizedQuery });
        const results = (data.result || [])
          .filter((r) => {
            const symbol = String(r?.symbol || "").trim();
            const type = String(r?.type || "").toLowerCase();
            return (
              symbol &&
              !symbol.includes(".") &&
              (type.includes("stock") ||
                type.includes("equity") ||
                type === "" ||
                type.includes("common"))
            );
          })
          .slice(0, 8)
          .map((r) => ({
            ticker: String(r.symbol || "").trim().toUpperCase(),
            name: String(r.description || r.displaySymbol || r.symbol || "").trim(),
            exchange: String(r.primaryExchange || r.exchange || "").trim(),
            symbol: String(r.symbol || "").trim().toUpperCase(),
            description: String(r.description || r.displaySymbol || r.symbol || "").trim(),
            primaryExchange: String(r.primaryExchange || r.exchange || "").trim(),
          }))
          .filter((r) => r.ticker);
        return { results, result: results };
      });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error("Finnhub proxy error:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
