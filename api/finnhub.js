// api/finnhub.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  if (!FINNHUB_API_KEY) {
    return res.status(500).json({ error: "Missing FINNHUB_API_KEY" });
  }

  try {
    // Parse body properly
    let body = {};
    if (req.method === "POST") {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    } else {
      body = req.query;
    }

    const { action, ticker, query, resolution, from, to, tickers } = body;

    // ==================== QUOTE (single) ====================
    if (action === "quote") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const data = await finnhubGet("/quote", { symbol: ticker });
      return res.status(200).json({
        c: data.c ?? null, dp: data.dp ?? null, d: data.d ?? null, pc: data.pc ?? null
      });
    }

    // ==================== QUOTES (batch) - This was missing ====================
    if (action === "quotes") {
      if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: "Missing tickers" });
      }

      const results = await Promise.all(
        tickers.map(async (t) => {
          try {
            const data = await finnhubGet("/quote", { symbol: t });
            return {
              ticker: t,
              c: data.c ?? null,
              dp: data.dp ?? null,
              d: data.d ?? null,
              pc: data.pc ?? null,
            };
          } catch {
            return { ticker: t, c: null, dp: null, d: null, pc: null };
          }
        })
      );
      return res.status(200).json({ quotes: results });
    }

    // ==================== PROFILE ====================
    if (action === "profile") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const data = await finnhubGet("/stock/profile2", { symbol: ticker });
      return res.status(200).json({
        exchange: data.exchange || null,
        name: data.name || null,
        ticker: data.ticker || ticker,
      });
    }

    // ==================== SEARCH ====================
    if (action === "search") {
      const q = query || ticker;
      if (!q) return res.status(400).json({ error: "Missing query" });
      const data = await finnhubGet("/search", { q });
      const results = (data.result || [])
        .filter(r => r.symbol && !r.symbol.includes("."))
        .slice(0, 10)
        .map(r => ({
          ticker: r.symbol.toUpperCase(),
          name: r.description || r.displaySymbol || r.symbol,
          exchange: r.primaryExchange || "",
        }));
      return res.status(200).json({ results });
    }

    // ==================== CANDLES_RANGE (for sparkline) ====================
    if (action === "candles_range") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;

      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: resolution || "D",
        from: String(fromTs),
        to: String(toTs),
      });

      if (data.s !== "ok") return res.status(200).json({ candles: [] });

      const candles = (data.c || []).map((close, i) => ({
        t: data.t?.[i],
        v: close,
      }));

      return res.status(200).json({ candles });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error) {
    console.error("Finnhub error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}

async function finnhubGet(path, params = {}) {
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  url.searchParams.set("token", FINNHUB_API_KEY);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json();
}
