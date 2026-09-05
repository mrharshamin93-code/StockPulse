import { supabase } from "@/lib/supabase";

const DAY_SECONDS = 86400;
const INTRADAY_TABLE = "stock_intraday_snapshots";
const DAILY_CHART_CACHE_TTL_MS = 15 * 60 * 1000;
const DAILY_CHART_BACKFILL_DAYS = 380;
const DAILY_CHART_PERIODS = new Set([
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
]);

const dailyChartCache = new Map();
const dailyChartInflight = new Map();

function finiteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const parsed = finiteNumber(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function newYorkSessionParts(timestampSeconds) {
  const date = new Date(Number(timestampSeconds) * 1000);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return {
    sessionDate: `${year}-${month}-${day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function formatNewsDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return value;
  }

  let date;

  if (typeof value === "number") {
    const milliseconds =
      Math.abs(value) < 1e12
        ? value * 1000
        : value;

    date = new Date(milliseconds);
  } else {
    const raw = String(value).trim();

    if (/^\d+$/.test(raw)) {
      const numeric = Number(raw);
      const milliseconds =
        Math.abs(numeric) < 1e12
          ? numeric * 1000
          : numeric;

      date = new Date(milliseconds);
    } else {
      date = new Date(raw);
    }
  }

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeNewsPayload(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (!Array.isArray(data.articles)) {
    return data;
  }

  return {
    ...data,
    articles: data.articles.map((article) => {
      if (!article || typeof article !== "object") {
        return article;
      }

      return {
        ...article,
        date: formatNewsDate(article.date),
      };
    }),
  };
}

async function getStoredIntradayCandles(body) {
  const ticker = String(body?.ticker || "")
    .trim()
    .toUpperCase();

  if (!ticker) {
    return null;
  }

  const to =
    finiteNumber(body?.to) ??
    Math.floor(Date.now() / 1000);

  const from =
    finiteNumber(body?.from) ??
    to - 7 * DAY_SECONDS;

  const { data, error } = await supabase
    .from(INTRADAY_TABLE)
    .select("ticker,bucket_start,price,source_fetched_at")
    .eq("ticker", ticker)
    .gte("bucket_start", new Date(from * 1000).toISOString())
    .lte("bucket_start", new Date(to * 1000).toISOString())
    .order("bucket_start", { ascending: true });

  if (error) {
    console.warn(
      "Could not read stored intraday snapshots; falling back to EOD data:",
      error.message,
    );

    return null;
  }

  const rows = (data ?? [])
    .map((row) => {
      const timestamp = Math.floor(
        new Date(row?.bucket_start).getTime() / 1000,
      );

      const price = finiteNumber(row?.price);
      const session = newYorkSessionParts(timestamp);

      return {
        timestamp,
        price,
        session,
      };
    })
    .filter((row) => {
      if (
        !Number.isFinite(row.timestamp) ||
        row.price === null ||
        !row.session
      ) {
        return false;
      }

      return (
        row.session.minuteOfDay >= 570 &&
        row.session.minuteOfDay <= 960
      );
    });

  if (rows.length < 1) {
    return null;
  }

  const latestSessionDate =
    rows[rows.length - 1].session.sessionDate;

  const latestSessionRows = rows.filter(
    (row) =>
      row.session.sessionDate === latestSessionDate,
  );

  if (latestSessionRows.length < 1) {
    return null;
  }

  const candles = latestSessionRows.map((row) => ({
    t: row.timestamp,
    o: row.price,
    h: row.price,
    l: row.price,
    c: row.price,
    v: null,
  }));

  return {
    ticker,
    interval: "30min",
    s: "ok",
    candles,
    prices: candles,
    t: candles.map((item) => item.t),
    o: candles.map((item) => item.o),
    h: candles.map((item) => item.h),
    l: candles.map((item) => item.l),
    c: candles.map((item) => item.c),
    v: candles.map((item) => item.v),
    source: "stored-snapshots",
  };
}

function normalizeMetricsPayload(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const rawSnapshot =
    data.snapshot && typeof data.snapshot === "object"
      ? data.snapshot
      : data.metrics && typeof data.metrics === "object"
        ? data.metrics
        : null;

  if (!rawSnapshot) {
    return data;
  }

  const snapshot = { ...rawSnapshot };

  const marketCap = firstFinite(
    snapshot.market_cap,
    snapshot.marketCap,
  );

  const pe = firstFinite(
    snapshot.price_to_earnings_ratio,
    snapshot.pe_ratio,
    snapshot.price_to_earnings,
    snapshot.pe,
  );

  const priceToSales = firstFinite(
    snapshot.price_to_sales_ratio,
    snapshot.price_sales_ratio,
    snapshot.price_to_sales,
  );

  const forwardPe = firstFinite(
    snapshot.forward_price_to_earnings_ratio,
    snapshot.forward_pe_ratio,
    snapshot.forward_pe,
    snapshot.forwardPE,
  );

  const payoutRatio = firstFinite(
    snapshot.payout_ratio,
    snapshot.dividend_payout_ratio,
  );

  let dividendYield = firstFinite(
    snapshot.dividend_yield,
    snapshot.dividend_yield_percentage,
  );

  if (
    dividendYield === null &&
    payoutRatio !== null &&
    payoutRatio >= 0 &&
    pe !== null &&
    pe > 0
  ) {
    dividendYield = payoutRatio / pe;
  }

  if (marketCap !== null) {
    snapshot.market_cap = marketCap;
    snapshot.marketCap = marketCap;
  }

  if (pe !== null) {
    snapshot.price_to_earnings_ratio = pe;
    snapshot.pe_ratio = pe;
  }

  if (priceToSales !== null) {
    snapshot.price_to_sales_ratio = priceToSales;
    snapshot.price_sales_ratio = priceToSales;
  }

  if (forwardPe !== null) {
    snapshot.forward_price_to_earnings_ratio = forwardPe;
    snapshot.forward_pe_ratio = forwardPe;
    snapshot.forward_pe = forwardPe;
    snapshot.forwardPE = forwardPe;
  }

  if (dividendYield !== null) {
    snapshot.dividend_yield = dividendYield;
  }

  return {
    ...data,
    snapshot,
    metrics: snapshot,
  };
}

function exactCalendarYearFrom(toSeconds) {
  const end = new Date(Number(toSeconds) * 1000);

  if (Number.isNaN(end.getTime())) {
    return null;
  }

  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);

  return Math.floor(start.getTime() / 1000);
}

function normalizeCandleRequest(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !["candles", "candles_range"].includes(body.action)
  ) {
    return body;
  }

  const period = String(body.period || "").toUpperCase();

  if (period === "1D") {
    return {
      ...body,
      resolution: "30",
    };
  }

  if (period === "1W") {
    const to =
      finiteNumber(body.to) ??
      Math.floor(Date.now() / 1000);

    return {
      ...body,
      resolution: "D",
      to,
      from: to - 14 * DAY_SECONDS,
    };
  }

  if (period === "1Y") {
    const to =
      finiteNumber(body.to) ??
      Math.floor(Date.now() / 1000);

    const from = exactCalendarYearFrom(to);

    return {
      ...body,
      resolution: "D",
      to,
      ...(from !== null ? { from } : {}),
    };
  }

  return body;
}

function candleSource(data) {
  if (Array.isArray(data?.candles)) {
    return data.candles;
  }

  if (Array.isArray(data?.prices)) {
    return data.prices;
  }

  return [];
}

function normalizedCandles(data) {
  return candleSource(data)
    .filter((item) => {
      const timestamp = finiteNumber(item?.t);
      const close = finiteNumber(item?.c);

      return timestamp !== null && close !== null;
    })
    .sort(
      (left, right) =>
        Number(left.t) - Number(right.t),
    );
}

function withCandles(data, candles) {
  return {
    ...data,
    candles,
    prices: candles,
    t: candles.map((item) => item.t),
    o: candles.map((item) => item.o),
    h: candles.map((item) => item.h),
    l: candles.map((item) => item.l),
    c: candles.map((item) => item.c),
    v: candles.map((item) => item.v),
  };
}

function normalizeCandlePayload(data, originalBody) {
  if (
    !data ||
    typeof data !== "object" ||
    !["candles", "candles_range"].includes(originalBody?.action)
  ) {
    return data;
  }

  const period = String(
    originalBody?.period || "",
  ).toUpperCase();

  if (period !== "1W") {
    return data;
  }

  const candles = normalizedCandles(data);

  if (!candles.length) {
    return data;
  }

  const newestTimestamp =
    Number(candles[candles.length - 1]?.t);

  const oneWeekAgo =
    newestTimestamp - 7 * DAY_SECONDS;

  let selected = candles.filter(
    (item) =>
      Number(item.t) >= oneWeekAgo,
  );

  if (selected.length < 2) {
    selected = candles.slice(-5);
  }

  return withCandles(data, selected);
}

function dailyChartCacheKey(body) {
  return String(body?.ticker || "")
    .trim()
    .toUpperCase();
}

function sliceDailyChartPayload(data, body) {
  const candles = normalizedCandles(data);

  if (!candles.length) {
    return data;
  }

  const period = String(body?.period || "").toUpperCase();
  const requestedTo = finiteNumber(body?.to);
  const requestedFrom = finiteNumber(body?.from);

  let selected = candles;

  if (requestedTo !== null) {
    selected = selected.filter(
      (item) => Number(item.t) <= requestedTo,
    );
  }

  if (period === "1W") {
    if (!selected.length) {
      return withCandles(data, []);
    }

    const newestTimestamp = Number(
      selected[selected.length - 1]?.t,
    );
    const oneWeekAgo = newestTimestamp - 7 * DAY_SECONDS;

    selected = selected.filter(
      (item) => Number(item.t) >= oneWeekAgo,
    );

    if (selected.length < 2) {
      selected = candles.slice(-5);
    }
  } else if (requestedFrom !== null) {
    selected = selected.filter(
      (item) => Number(item.t) >= requestedFrom,
    );
  }

  return withCandles(data, selected);
}

function isFreshDailyCache(entry) {
  return Boolean(
    entry &&
    Date.now() - entry.fetchedAt < DAILY_CHART_CACHE_TTL_MS &&
    normalizedCandles(entry.data).length > 0
  );
}

async function loadDailyChartBacking(body) {
  const ticker = dailyChartCacheKey(body);

  if (!ticker) {
    return null;
  }

  const cached = dailyChartCache.get(ticker);

  if (isFreshDailyCache(cached)) {
    return cached.data;
  }

  const existingRequest = dailyChartInflight.get(ticker);

  if (existingRequest) {
    return existingRequest;
  }

  const to =
    finiteNumber(body?.to) ??
    Math.floor(Date.now() / 1000);
  const from = to - DAILY_CHART_BACKFILL_DAYS * DAY_SECONDS;

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke(
      "stock-chart-prices",
      {
        body: {
          action: "candles_range",
          ticker,
          period: "1Y",
          resolution: "D",
          from,
          to,
        },
      },
    );

    if (error) {
      console.error(
        "Daily chart preload failed:",
        error,
      );
      throw safeProviderError("candles_range");
    }

    if (data?.error) {
      console.error(
        "Daily chart preload provider error:",
        data.error,
      );
      throw safeProviderError("candles_range");
    }

    const normalized = withCandles(
      data,
      normalizedCandles(data),
    );

    dailyChartCache.set(ticker, {
      data: normalized,
      fetchedAt: Date.now(),
    });

    return normalized;
  })();

  dailyChartInflight.set(ticker, request);

  try {
    return await request;
  } finally {
    dailyChartInflight.delete(ticker);
  }
}

export async function preloadDailyChart(ticker) {
  const normalizedTicker = String(ticker || "")
    .trim()
    .toUpperCase();

  if (!normalizedTicker) {
    return null;
  }

  return loadDailyChartBacking({
    action: "candles_range",
    ticker: normalizedTicker,
    period: "1Y",
    resolution: "D",
    to: Math.floor(Date.now() / 1000),
  });
}

function safeProviderError(action) {
  if (action === "metrics") {
    return new Error(
      "Fundamentals are temporarily unavailable.",
    );
  }

  if (
    action === "candles" ||
    action === "candles_range"
  ) {
    return new Error(
      "Chart is unavailable for now.",
    );
  }

  return new Error(
    "Market data is temporarily unavailable. Please try again.",
  );
}

export async function financialDatasetsRequest(body) {
  const requestBody = normalizeCandleRequest(body);

  if (
    (body?.action === "candles" ||
      body?.action === "candles_range") &&
    String(body?.period || "").toUpperCase() === "1D"
  ) {
    const intraday =
      await getStoredIntradayCandles(requestBody);

    if (intraday) {
      return intraday;
    }
  }

  const isChartRequest =
    body?.action === "candles" ||
    body?.action === "candles_range";

  const period = String(
    body?.period || "",
  ).toUpperCase();

  if (
    isChartRequest &&
    DAILY_CHART_PERIODS.has(period)
  ) {
    const dailyBacking = await loadDailyChartBacking(body);

    if (dailyBacking) {
      return normalizeCandlePayload(
        sliceDailyChartPayload(dailyBacking, body),
        body,
      );
    }
  }

  const functionName =
    body?.action === "news"
      ? "stock-news"
      : isChartRequest && period !== "1D"
        ? "stock-chart-prices"
        : "financial-datasets";

  const { data, error } =
    await supabase.functions.invoke(
      functionName,
      {
        body: requestBody,
      },
    );

  if (body?.action === "news") {
    if (error || data?.error) {
      console.error(
        "Stock news request failed:",
        error || data?.error,
      );

      return {
        articles: [],
        news: [],
        unavailable: true,
      };
    }

    return normalizeNewsPayload(data);
  }

  if (error) {
    console.error(
      "Financial Datasets Edge Function error:",
      error,
    );

    throw safeProviderError(
      String(body?.action || "").toLowerCase(),
    );
  }

  if (data?.error) {
    console.error(
      "Financial Datasets provider error:",
      data.error,
    );

    throw safeProviderError(
      String(body?.action || "").toLowerCase(),
    );
  }

  if (body?.action === "metrics") {
    return normalizeMetricsPayload(data);
  }

  if (
    body?.action === "candles" ||
    body?.action === "candles_range"
  ) {
    return normalizeCandlePayload(
      data,
      body,
    );
  }

  return data;
}

export async function getQuote(ticker) {
  return financialDatasetsRequest({
    action: "quote",
    ticker,
  });
}

export async function getQuotes(tickers) {
  return financialDatasetsRequest({
    action: "quotes",
    tickers,
  });
}

export async function getProfile(ticker) {
  return financialDatasetsRequest({
    action: "profile",
    ticker,
  });
}

export async function getNews(ticker) {
  return financialDatasetsRequest({
    action: "news",
    ticker,
  });
}

export async function getCandles({
  ticker,
  resolution = "D",
  period = "1Y",
}) {
  return financialDatasetsRequest({
    action: "candles",
    ticker,
    resolution,
    period,
  });
}

export async function getCandlesRange({
  ticker,
  resolution = "D",
  from,
  to,
  period = undefined,
}) {
  return financialDatasetsRequest({
    action: "candles_range",
    ticker,
    resolution,
    from,
    to,
    ...(period ? { period } : {}),
  });
}

export async function getMetrics(ticker) {
  return financialDatasetsRequest({
    action: "metrics",
    ticker,
  });
}
