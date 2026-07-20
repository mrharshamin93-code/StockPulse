// api/finnhub.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

  if (!FINNHUB_API_KEY) {
    return res.status(500).json({ error: "Missing FINNHUB_API_KEY" });
  }

  try {
    // ==================== BODY PARSING (Fixed) ====================
    let body = {};
    
    if (req.method === "POST") {
      if (typeof req.body === "string") {
        try {
          body = JSON.parse(req.body);
        } catch {
          body = {};
        }
      } else if (req.body && typeof req.body === "object") {
        body = req.body;
      }
    } else if (req.method === "GET") {
      body = req.query;
    }

    const { action, ticker, query, resolution, from, to, tickers } = body;

    // ==================== ACTIONS ====================

    if (action === "candles_range") {
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      const toTs = to || Math.floor(Date.now() / 1000);
      const fromTs = from || toTs - 30 * 86400;

      const data = await finnhubGet("/stock/candle", {
        symbol: ticker,
        resolution: resolution || "D",
        from: String(fromTs),
        to: String(toTs),
      });

      if (data.s !== "ok") {
        return res.status(200).json({ candles: [] });
      }

      const candles = (data.c || []).map((close, i) => ({
        t: data.t[i],
        v: close,
      }));

      return res.status(200).json({ candles });
    }

    if (action === "profile") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });

      const data = await finnhubGet("/stock/profile2", { symbol: ticker });
      return res.status(200).json({
        exchange: data.exchange || null,
        name: data.name || null,
        ticker: data.ticker || ticker,
      });
    }

    if (action === "search") {
      const q = query || ticker;
      if (!q) return res.status(400).json({ error: "Missing query" });

      const data = await finnhubGet("/search", { q });
      const results = (data.result || [])
        .filter(r => r.symbol && !r.symbol.includes("."))
        .slice(0, 8)
        .map(r => ({
          ticker: r.symbol.toUpperCase(),
          name: r.description || r.displaySymbol || r.symbol,
          exchange: r.primaryExchange || r.exchange || "",
        }));

      return res.status(200).json({ results });
    }

    if (action === "quote") {
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });

      const data = await finnhubGet("/quote", { symbol: ticker });
      return res.status(200).json({
        c: data.c ?? null,
        dp: data.dp ?? null,
        d: data.d ?? null,
        pc: data.pc ?? null,
      });
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (error) {
    console.error("Finnhub API Error:", error);
    return res.status(500).json({ 
      error: error.message || "Internal server error" 
    });
  }
}

// ==================== Helper ====================
async function finnhubGet(path, params = {}) {
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  const url = new URL(`https://finnhub.io/api/v1${path}`);

  url.searchParams.set("token", FINNHUB_API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
  return res.json();
}
