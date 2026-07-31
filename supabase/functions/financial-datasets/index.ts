const API_KEY = Deno.env.get("FINANCIAL_DATASETS_API_KEY");
const BASE_URL = "https://api.financialdatasets.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const cache = new Map();

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTickers(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [
    ...new Set(
      items.map(normalizeTicker).filter(Boolean),
    ),
  ];
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampFromValue(value) {
  if (typeof value === "number") {
    return value > 10_000_000_000
      ? Math.floor(value / 1000)
      : Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed)
      ? Math.floor(parsed / 1000)
      : null;
  }

  return null;
}

async function withCache(key, ttlMs, fetcher) {
  const hit = cache.get(key);

  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }

  const value = await fetcher();

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

async function apiGet(path, params = {}, retries = 2) {
  if (!API_KEY) {
    throw new Error(
      "Missing FINANCIAL_DATASETS_API_KEY",
    );
  }

  const url = new URL(`${BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "X-API-KEY": API_KEY,
      Accept: "application/json",
    },
  });

  if (response.status === 429 && retries > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, 1250),
    );

    return apiGet(path, params, retries - 1);
  }

  const text = await response.text();

  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? payload.message || payload.error || ""
        : String(payload || "");

    throw new Error(
      `Financial Datasets error: ${response.status}${
        message ? ` - ${message}` : ""
      }`,
    );
  }

  return payload;
}

function emptyQuote(ticker, error) {
  return {
    ticker,
    c: null,
    d: null,
    dp: null,
    h: null,
    l: null,
    o: null,
    pc: null,
    t: null,
    ...(error ? { error } : {}),
  };
}

async function getQuote(ticker) {
  return withCache(
    `quote:${ticker}`,
    15_000,
    async () => {
      const data = await apiGet(
        "/prices/snapshot",
        { ticker },
      );

      const snapshot = data?.snapshot || {};
      const current = numberOrNull(snapshot.price);
      const change = numberOrNull(
        snapshot.day_change,
      );

      return {
        ticker,
        c: current,
        d: change,
        dp: numberOrNull(
          snapshot.day_change_percent,
        ),
        h: numberOrNull(snapshot.high),
        l: numberOrNull(snapshot.low),
        o: numberOrNull(snapshot.open),
        pc:
          current !== null && change !== null
            ? current - change
            : null,
        t:
          numberOrNull(
            snapshot.time_milliseconds,
          ) !== null
            ? Math.floor(
                Number(
                  snapshot.time_milliseconds,
                ) / 1000,
              )
            : timestampFromValue(snapshot.time),
      };
    },
  );
}

async function getQuotes(tickers) {
  const quotes = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        return await getQuote(ticker);
      } catch (error) {
        return emptyQuote(
          ticker,
          error instanceof Error
            ? error.message
            : "Failed to fetch quote",
        );
      }
    }),
  );

  return { quotes };
}

async function getProfile(ticker) {
  return withCache(
    `profile:${ticker}`,
    24 * 60 * 60 * 1000,
    async () => {
      const data = await apiGet(
        "/company/facts",
        { ticker },
      );

      const facts = data?.company_facts || {};
      const marketCap = numberOrNull(
        facts.market_cap,
      );

      return {
        exchange: facts.exchange || null,
        name: facts.name || null,
        ticker: facts.ticker || ticker,
        finnhubIndustry:
          facts.industry ||
          facts.sic_industry ||
          null,
        industry:
          facts.industry ||
          facts.sic_industry ||
          null,
        sector:
          facts.sector ||
          facts.sic_sector ||
          null,
        logo: null,
        weburl: facts.website_url || null,
        marketCapitalization:
          marketCap !== null
            ? marketCap / 1_000_000
            : null,
        marketCap,
        currency: "USD",
        country: facts.location || "US",
        cik: facts.cik || null,
        isActive: facts.is_active ?? null,
        employees: numberOrNull(
          facts.number_of_employees,
        ),
        secFilingsUrl:
          facts.sec_filings_url || null,
      };
    },
  );
}

async function getNews(ticker) {
  return withCache(
    `news:${ticker}`,
    10 * 60 * 1000,
    async () => {
      const data = await apiGet("/news", {
        ticker,
        limit: 10,
      });

      const articles = Array.isArray(data?.news)
        ? data.news.map((item) => ({
            ticker: item.ticker || ticker,
            title: String(
              item.title || "",
            ).trim(),
            source: String(
              item.source || "",
            ).trim(),
            date: String(
              item.date || "",
            ).trim(),
            url: String(
              item.url || "",
            ).trim(),
            summary: String(
              item.summary || "",
            ).trim(),
          }))
        : [];

      return {
        articles,
        news: articles,
      };
    },
  );
}

function dateFromUnixSeconds(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed * 1000)
    .toISOString()
    .slice(0, 10);
}

function periodDates(period = "1Y") {
  const end = new Date();
  const start = new Date();
  const normalized = String(period)
    .trim()
    .toUpperCase();

  switch (normalized) {
    case "1D":
      start.setDate(start.getDate() - 7);
      break;
    case "5D":
      start.setDate(start.getDate() - 10);
      break;
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "YTD":
      start.setMonth(0, 1);
      break;
    case "5Y":
      start.setFullYear(
        start.getFullYear() - 5,
      );
      break;
    case "MAX":
      start.setFullYear(
        start.getFullYear() - 30,
      );
      break;
    case "1Y":
    default:
      start.setFullYear(
        start.getFullYear() - 1,
      );
      break;
  }

  return {
    startDate: start
      .toISOString()
      .slice(0, 10),
    endDate: end
      .toISOString()
      .slice(0, 10),
  };
}

function intervalFromResolution(resolution) {
  const normalized = String(
    resolution || "D",
  ).toUpperCase();

  if (
    normalized === "W" ||
    normalized === "1W"
  ) {
    return "week";
  }

  if (
    normalized === "M" ||
    normalized === "1M"
  ) {
    return "month";
  }

  return "day";
}

async function getCandles({
  ticker,
  resolution = "D",
  period = "1Y",
  from,
  to,
}) {
  const fallback = periodDates(period);

  const startDate =
    dateFromUnixSeconds(from) ||
    fallback.startDate;

  const endDate =
    dateFromUnixSeconds(to) ||
    fallback.endDate;

  const interval =
    intervalFromResolution(resolution);

  return withCache(
    `candles:${ticker}:${interval}:${startDate}:${endDate}`,
    5 * 60 * 1000,
    async () => {
      const data = await apiGet("/prices", {
        ticker,
        interval,
        start_date: startDate,
        end_date: endDate,
      });

      const prices = Array.isArray(data?.prices)
        ? data.prices
        : [];

      const rows = prices
        .map((item) => ({
          t: timestampFromValue(item.time),
          o: numberOrNull(item.open),
          h: numberOrNull(item.high),
          l: numberOrNull(item.low),
          c: numberOrNull(item.close),
          v: numberOrNull(item.volume),
        }))
        .filter(
          (item) =>
            item.t !== null &&
            item.c !== null,
        )
        .sort((a, b) => a.t - b.t);

      return {
        s: rows.length > 0
          ? "ok"
          : "no_data",
        t: rows.map((item) => item.t),
        o: rows.map((item) => item.o),
        h: rows.map((item) => item.h),
        l: rows.map((item) => item.l),
        c: rows.map((item) => item.c),
        v: rows.map((item) => item.v),
        prices: rows,
      };
    },
  );
}

async function getMetrics(ticker) {
  return withCache(
    `metrics:${ticker}`,
    60 * 60 * 1000,
    async () => {
      const data = await apiGet(
        "/financial-metrics/snapshot",
        { ticker },
      );

      return {
        ticker,
        snapshot: data?.snapshot || null,
        metrics: data?.snapshot || null,
      };
    },
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
    );
  }

  try {
    const body = await request.json();

    const action = String(
      body?.action || "",
    )
      .trim()
      .toLowerCase();

    const ticker = normalizeTicker(
      body?.ticker,
    );

    if (action !== "quotes" && !ticker) {
      return jsonResponse(
        { error: "Ticker is required" },
        400,
      );
    }

    switch (action) {
      case "quote":
        return jsonResponse(
          await getQuote(ticker),
        );

      case "quotes": {
        const tickers = normalizeTickers(
          body?.tickers,
        );

        if (tickers.length === 0) {
          return jsonResponse(
            {
              error:
                "Tickers are required",
            },
            400,
          );
        }

        return jsonResponse(
          await getQuotes(tickers),
        );
      }

      case "profile":
        return jsonResponse(
          await getProfile(ticker),
        );

      case "news":
        return jsonResponse(
          await getNews(ticker),
        );

      case "candles":
      case "candles_range":
        return jsonResponse(
          await getCandles({
            ticker,
            resolution:
              body?.resolution || "D",
            period:
              body?.period || "1Y",
            from: body?.from,
            to: body?.to,
          }),
        );

      case "metrics":
        return jsonResponse(
          await getMetrics(ticker),
        );

      default:
        return jsonResponse(
          {
            error:
              "Unsupported action. Use quote, quotes, profile, news, candles, candles_range, or metrics.",
          },
          400,
        );
    }
  } catch (error) {
    console.error(
      "Financial Datasets Edge Function error:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Financial data request failed.",
      },
      500,
    );
  }
});
