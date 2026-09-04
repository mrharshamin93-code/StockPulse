import { financialDatasetsRequest } from "@/lib/financialDatasets";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CONCURRENCY = 3;
const memoryCache = new Map();
const inflight = new Map();

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function cacheKey(ticker) {
  return `stockpulse:stock-detail-prefetch:${normalizeTicker(ticker)}`;
}

function normalizeQuote(value) {
  if (!value || typeof value !== "object") return null;

  const c = Number(value.c ?? value.currentPrice ?? value.current_price ?? value.price);
  const pc = Number(value.pc ?? value.previousClose ?? value.previous_close);
  const dp = Number(value.dp ?? value.dailyGain ?? value.dailyPercent ?? value.changePercent ?? value.change_percent);
  const d = Number(value.d ?? value.dailyChange ?? value.change);

  const quote = {
    c: Number.isFinite(c) ? c : null,
    pc: Number.isFinite(pc) ? pc : null,
    dp: Number.isFinite(dp) ? dp : null,
    d: Number.isFinite(d) ? d : null,
  };

  return Object.values(quote).some(Number.isFinite) ? quote : null;
}

function serialize(entry) {
  try {
    window.sessionStorage.setItem(cacheKey(entry.ticker), JSON.stringify(entry));
  } catch {
    // Memory cache is enough when storage is unavailable.
  }
}

function deserialize(ticker) {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(ticker));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isFresh(entry) {
  return Boolean(
    entry &&
      Number.isFinite(Number(entry.timestamp)) &&
      Date.now() - Number(entry.timestamp) < CACHE_TTL_MS &&
      Array.isArray(entry.points) &&
      entry.points.length > 0
  );
}

export function readStockDetailPrefetch(ticker) {
  const key = normalizeTicker(ticker);
  if (!key) return null;

  const memory = memoryCache.get(key);
  if (isFresh(memory)) return memory;

  const stored = deserialize(key);
  if (isFresh(stored)) {
    memoryCache.set(key, stored);
    return stored;
  }

  memoryCache.delete(key);
  return null;
}

function getOneWeekBounds() {
  const to = Math.floor(Date.now() / 1000);
  return {
    from: to - 14 * 86400,
    to,
  };
}

async function fetchOneWeekPoints(ticker) {
  const { from, to } = getOneWeekBounds();
  const result = await financialDatasetsRequest({
    action: "candles_range",
    ticker,
    period: "1W",
    resolution: "D",
    from,
    to,
  });

  const candles = Array.isArray(result?.candles) ? result.candles : [];

  return candles
    .map((candle) => ({
      timestamp: Number(candle?.t),
      value: Number(candle?.c),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.value)
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => ({
      ...point,
      key: Date.UTC(
        new Date(point.timestamp * 1000).getUTCFullYear(),
        new Date(point.timestamp * 1000).getUTCMonth(),
        new Date(point.timestamp * 1000).getUTCDate()
      ),
      label: new Date(point.timestamp * 1000).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
      }),
    }));
}

export async function prefetchStockDetail(ticker, options = {}) {
  const key = normalizeTicker(ticker);
  if (!key) return null;

  const existing = readStockDetailPrefetch(key);
  if (existing && !options.force) return existing;

  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    const providedQuote = normalizeQuote(options.quote);

    const [pointsResult, profileResult, quoteResult] = await Promise.allSettled([
      fetchOneWeekPoints(key),
      financialDatasetsRequest({ action: "profile", ticker: key }),
      providedQuote
        ? Promise.resolve(providedQuote)
        : financialDatasetsRequest({ action: "quote", ticker: key }),
    ]);

    const points =
      pointsResult.status === "fulfilled" && Array.isArray(pointsResult.value)
        ? pointsResult.value
        : [];

    if (!points.length) return null;

    const profile =
      profileResult.status === "fulfilled" && profileResult.value
        ? profileResult.value
        : null;

    const quote =
      quoteResult.status === "fulfilled"
        ? normalizeQuote(quoteResult.value) || providedQuote
        : providedQuote;

    const entry = {
      ticker: key,
      timestamp: Date.now(),
      points,
      quote,
      profile: profile
        ? {
            name: profile.name || options.companyName || key,
            sector: profile.industry || profile.sector || "",
            logo: profile.logo || "",
          }
        : {
            name: options.companyName || key,
            sector: "",
            logo: "",
          },
    };

    memoryCache.set(key, entry);
    serialize(entry);
    return entry;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

export async function prefetchStockDetails(stocks, options = {}) {
  const list = Array.from(
    new Map(
      (stocks || [])
        .map((stock) => {
          const ticker = normalizeTicker(stock?.ticker ?? stock);
          if (!ticker) return null;
          return [ticker, typeof stock === "object" ? stock : { ticker }];
        })
        .filter(Boolean)
    ).values()
  );

  if (!list.length) return;

  let cursor = 0;
  const workerCount = Math.min(MAX_CONCURRENCY, list.length);

  async function worker() {
    while (cursor < list.length) {
      const index = cursor++;
      const stock = list[index];
      const ticker = normalizeTicker(stock?.ticker);

      try {
        await prefetchStockDetail(ticker, {
          quote: options.quotes?.[ticker],
          companyName: stock?.company_name || stock?.companyName || "",
        });
      } catch (error) {
        console.warn(`Stock detail prefetch failed for ${ticker}:`, error);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
}
