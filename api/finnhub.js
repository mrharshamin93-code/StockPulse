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
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

async function withCache(key, ttlMs, fetcher) {
  const cached = cacheGet(key);

  if (cached !== null) {
    return cached;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

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

function requireFinnhubApiKey() {
  if (!FINNHUB_API_KEY) {
    const error = new Error("Missing FINNHUB_API_KEY");

    error.statusCode = 500;

    throw error;
  }
}

async function finnhubGet(path, params = {}, retries = 2) {
  requireFinnhubApiKey();

  const url = new URL(`${BASE_URL}${path}`);

  url.searchParams.set("token", FINNHUB_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());

  if (response.status === 429 && retries > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });

    return finnhubGet(path, params, retries - 1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `Finnhub error: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json();
}

function normalizeTickers(value) {
  if (Array.isArray(value)) {
    return value
      .map((ticker) =>
        String(ticker).trim().toUpperCase()
      )
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return normalizeTickers(parsed);
      }
    } catch {
      return value
        .split(",")
        .map((ticker) =>
          ticker.trim().toUpperCase()
        )
        .filter(Boolean);
    }
  }

  return [];
}

function getBody(req) {
  if (req.method === "GET") {
    const {
      action,
      ticker,
      query,
      q,
      resolution,
      from,
      to,
      tickers,
    } = req.query;

    return {
      action,
      ticker: ticker
        ? String(ticker).trim().toUpperCase()
        : undefined,
      query: query || q,
      resolution,
      from: Number.isFinite(Number(from))
        ? Number(from)
        : undefined,
      to: Number.isFinite(Number(to))
        ? Number(to)
        : undefined,
      tickers: normalizeTickers(tickers),
    };
  }

  const body = req.body || {};

  return {
    ...body,
    action: body.action,
    ticker: body.ticker
      ? String(body.ticker).trim().toUpperCase()
      : undefined,
    query: body.query || body.q,
    resolution: body.resolution,
    from: Number.isFinite(Number(body.from))
      ? Number(body.from)
      : undefined,
    to: Number.isFinite(Number(body.to))
      ? Number(body.to)
      : undefined,
    tickers: normalizeTickers(body.tickers),
  };
}

function mapQuoteData(ticker, data) {
  return {
    ticker,
    c:
      typeof data?.c === "number"
        ? data.c
        : null,
    dp:
      typeof data?.dp === "number"
        ? data.dp
        : null,
    d:
      typeof data?.d === "number"
        ? data.d
        : null,
    pc:
      typeof data?.pc === "number"
        ? data.pc
        : null,
    h:
      typeof data?.h === "number"
        ? data.h
        : null,
    l:
      typeof data?.l === "number"
        ? data.l
        : null,
    o:
      typeof data?.o === "number"
        ? data.o
        : null,
    t: data?.t ?? null,
  };
}

function emptyQuote(ticker, error = null) {
  return {
    ticker,
    c: null,
    dp: null,
    d: null,
    pc: null,
    h: null,
    l: null,
    o: null,
    t: null,
    ...(error ? { error } : {}),
  };
}

function getYahooInterval(
  resolution,
  fromTs,
  toTs
) {
  const normalized = String(
    resolution || ""
  ).toUpperCase();

  const rangeDays =
    Math.max(0, toTs - fromTs) / 86400;

  const directMap = {
    "1": "1m",
    "2": "2m",
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "60m",
    "90": "90m",
    D: "1d",
    W: "1wk",
    M: "1mo",
  };

  if (directMap[normalized]) {
    const requested = directMap[normalized];

    // Yahoo only allows one-minute data
    // for a limited historical range.
    if (
      requested === "1m" &&
      rangeDays > 7
    ) {
      return "5m";
    }

    // Yahoo limits intraday data to
    // approximately the last 60 days.
    if (
      [
        "2m",
        "5m",
        "15m",
        "30m",
        "60m",
        "90m",
      ].includes(requested) &&
      rangeDays > 60
    ) {
      return "1d";
    }

    return requested;
  }

  if (rangeDays <= 1) {
    return "5m";
  }

  if (rangeDays <= 7) {
    return "60m";
  }

  if (rangeDays <= 730) {
    return "1d";
  }

  if (rangeDays <= 3650) {
    return "1wk";
  }

  return "1mo";
}

async function fetchYahooCandles(
  ticker,
  fromTs,
  toTs,
  resolution
) {
  const symbol = encodeURIComponent(
    ticker.toUpperCase()
  );

  const interval = getYahooInterval(
    resolution,
    fromTs,
    toTs
  );

  const params = new URLSearchParams({
    period1: String(Math.floor(fromTs)),
    period2: String(Math.floor(toTs)),
    interval,
    events: "history",
    includeAdjustedClose: "true",
  });

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${symbol}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response
      .text()
      .catch(() => "");

    throw new Error(
      `Yahoo chart request failed: ${response.status} ${text}`.trim()
    );
  }

  const json = await response.json();
  const chartError = json?.chart?.error;

  if (chartError) {
    throw new Error(
      chartError.description ||
        chartError.code ||
        "Yahoo chart error"
    );
  }

  const result =
    json?.chart?.result?.[0];

  if (!result) {
    return {
      candles: [],
      interval,
    };
  }

  const timestamps =
    result.timestamp || [];

  const quote =
    result.indicators?.quote?.[0] || {};

  const adjustedClose =
    result.indicators?.adjclose?.[0]
      ?.adjclose || [];

  const candles = timestamps
    .map((timestamp, index) => {
      const close =
        adjustedClose[index] ??
        quote.close?.[index] ??
        null;

      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(close)
      ) {
        return null;
      }

      return {
        t: timestamp,
        v: close,
        o: Number.isFinite(
          quote.open?.[index]
        )
          ? quote.open[index]
          : null,
        h: Number.isFinite(
          quote.high?.[index]
        )
          ? quote.high[index]
          : null,
        l: Number.isFinite(
          quote.low?.[index]
        )
          ? quote.low[index]
          : null,
        c: Number.isFinite(
          quote.close?.[index]
        )
          ? quote.close[index]
          : close,
        volume: Number.isFinite(
          quote.volume?.[index]
        )
          ? quote.volume[index]
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);

  return {
    candles,
    interval,
  };
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const body = getBody(req);

    const {
      action,
      ticker,
      tickers,
    } = body;

    if (action === "quote") {
      if (!ticker) {
        return res.status(400).json({
          error: "Missing ticker",
        });
      }

      const result = await withCache(
        `quote:${ticker}`,
        15_000,
        async () => {
          const data = await finnhubGet(
            "/quote",
            {
              symbol: ticker,
            }
          );

          return mapQuoteData(
            ticker,
            data
          );
        }
      );

      return res.status(200).json(result);
    }

    if (action === "quotes") {
      if (!tickers.length) {
        return res.status(400).json({
          error: "Missing tickers",
        });
      }

      const results = await Promise.all(
        tickers.map(
          async (normalizedTicker) => {
            try {
              return await withCache(
                `quote:${normalizedTicker}`,
                15_000,
                async () => {
                  const data =
                    await finnhubGet(
                      "/quote",
                      {
                        symbol:
                          normalizedTicker,
                      }
                    );

                  return mapQuoteData(
                    normalizedTicker,
                    data
                  );
                }
              );
            } catch (error) {
              return emptyQuote(
                normalizedTicker,
                error?.message ||
                  "Failed to fetch quote"
              );
            }
          }
        )
      );

      return res.status(200).json({
        quotes: results,
      });
    }

    if (action === "candles") {
      if (!ticker) {
        return res.status(400).json({
          error: "Missing ticker",
        });
      }

      const toTs = Math.floor(
        Date.now() / 1000
      );

      const fromTs =
        toTs - 365 * 86400;

      const resolution =
        body.resolution || "D";

      const interval =
        getYahooInterval(
          resolution,
          fromTs,
          toTs
        );

      const result = await withCache(
        [
          "candles",
          ticker,
          interval,
          fromTs,
          toTs,
        ].join(":"),
        5 * 60_000,
        () =>
          fetchYahooCandles(
            ticker,
            fromTs,
            toTs,
            resolution
          )
      );

      return res.status(200).json(result);
    }

    if (action === "candles_range") {
      if (!ticker) {
        return res.status(400).json({
          error: "Missing ticker",
        });
      }

      const now = Math.floor(
        Date.now() / 1000
      );

      const toTs = body.to ?? now;

      const fromTs =
        body.from ??
        toTs - 30 * 86400;

      const resolution =
        body.resolution || "D";

      if (
        !Number.isFinite(fromTs) ||
        !Number.isFinite(toTs)
      ) {
        return res.status(400).json({
          error:
            "`from` and `to` must be Unix timestamps",
        });
      }

      if (fromTs >= toTs) {
        return res.status(400).json({
          error:
            "`from` must be earlier than `to`",
        });
      }

      const interval =
        getYahooInterval(
          resolution,
          fromTs,
          toTs
        );

      const cacheKey = [
        "candles_range",
        ticker,
        interval,
        Math.floor(fromTs),
        Math.floor(toTs),
      ].join(":");

      const result = await withCache(
        cacheKey,
        5 * 60_000,
        () =>
          fetchYahooCandles(
            ticker,
            fromTs,
            toTs,
            resolution
          )
      );

      return res.status(200).json(result);
    }

    if (action === "news") {
      if (!ticker) {
        return res.status(400).json({
          error: "Missing ticker",
        });
      }

      const result = await withCache(
        `news:${ticker}`,
        10 * 60_000,
        async () => {
          const toDate = new Date()
            .toISOString()
            .split("T")[0];

          const fromDate = new Date(
            Date.now() -
              90 * 86400 * 1000
          )
            .toISOString()
            .split("T")[0];

          const [data, profileData] =
            await Promise.all([
              finnhubGet(
                "/company-news",
                {
                  symbol: ticker,
                  from: fromDate,
                  to: toDate,
                }
              ),
              finnhubGet(
                "/stock/profile2",
                {
                  symbol: ticker,
                }
              ),
            ]);

          const companyName = String(
            profileData?.name || ""
          ).toLowerCase();

          const tickerLower =
            ticker.toLowerCase();

          const all = (
            Array.isArray(data)
              ? data
              : []
          ).sort(
            (a, b) =>
              Number(
                b.datetime || 0
              ) -
              Number(
                a.datetime || 0
              )
          );

          const relevant = all.filter(
            (article) => {
              const text =
                `${
                  article.headline || ""
                } ${
                  article.summary || ""
                }`.toLowerCase();

              return (
                text.includes(
                  tickerLower
                ) ||
                (
                  companyName &&
                  text.includes(
                    companyName
                  )
                )
              );
            }
          );

          const sourceCounts = {};
          const articles = [];

          const pool =
            relevant.length >= 3
              ? relevant
              : all;

          for (const article of pool) {
            const source = String(
              article.source || ""
            ).toLowerCase();

            sourceCounts[source] =
              (sourceCounts[source] ||
                0) + 1;

            if (
              sourceCounts[source] <= 2
            ) {
              articles.push({
                title:
                  article.headline,
                summary:
                  article.summary,
                url: article.url,
                source:
                  article.source,
                date:
                  article.datetime
                    ? new Date(
                        article.datetime *
                          1000
                      ).toLocaleDateString()
                    : null,
              });
            }

            if (
              articles.length >= 10
            ) {
              break;
            }
          }

          return {
            articles,
          };
        }
      );

      return res.status(200).json(result);
    }

    if (action === "profile") {
      if (!ticker) {
        return res.status(400).json({
          error: "Missing ticker",
        });
      }

      const result = await withCache(
        `profile:${ticker}`,
        24 * 60 * 60_000,
        async () => {
          const data =
            await finnhubGet(
              "/stock/profile2",
              {
                symbol: ticker,
              }
            );

          return {
            exchange:
              data.exchange || null,
            name:
              data.name || null,
            ticker:
              data.ticker ||
              ticker,
            finnhubIndustry:
              data.finnhubIndustry ||
              null,
            logo:
              data.logo || null,
            weburl:
              data.weburl || null,
            marketCapitalization:
              data.marketCapitalization ||
              null,
            currency:
              data.currency || null,
            country:
              data.country || null,
          };
        }
      );

      return res.status(200).json(result);
    }

    if (action === "search") {
      const query =
        body.query || ticker;

      if (!query) {
        return res.status(400).json({
          error: "Missing query",
        });
      }

      const normalizedQuery =
        String(query).trim();

      const result = await withCache(
        `search:${normalizedQuery.toUpperCase()}`,
        5 * 60_000,
        async () => {
          const data =
            await finnhubGet(
              "/search",
              {
                q: normalizedQuery,
              }
            );

          const results = (
            data.result || []
          )
            .filter((item) => {
              const symbol = String(
                item?.symbol || ""
              ).trim();

              const type = String(
                item?.type || ""
              ).toLowerCase();

              return (
                symbol &&
                !symbol.includes(".") &&
                (
                  type.includes(
                    "stock"
                  ) ||
                  type.includes(
                    "equity"
                  ) ||
                  type === "" ||
                  type.includes(
                    "common"
                  )
                )
              );
            })
            .slice(0, 8)
            .map((item) => ({
              ticker: String(
                item.symbol || ""
              )
                .trim()
                .toUpperCase(),
              name: String(
                item.description ||
                  item.displaySymbol ||
                  item.symbol ||
                  ""
              ).trim(),
              exchange: String(
                item.primaryExchange ||
                  item.exchange ||
                  ""
              ).trim(),
              symbol: String(
                item.symbol || ""
              )
                .trim()
                .toUpperCase(),
              description: String(
                item.description ||
                  item.displaySymbol ||
                  item.symbol ||
                  ""
              ).trim(),
              primaryExchange:
                String(
                  item.primaryExchange ||
                    item.exchange ||
                    ""
                ).trim(),
            }))
            .filter(
              (item) =>
                item.ticker
            );

          return {
            results,
            result: results,
          };
        }
      );

      return res.status(200).json(result);
    }

    return res.status(400).json({
      error: "Unknown action",
    });
  } catch (error) {
    console.error(
      "Finnhub proxy error:",
      error
    );

    return res
      .status(
        error?.statusCode || 500
      )
      .json({
        error:
          error?.message ||
          "Internal server error",
        stack:
          process.env.NODE_ENV ===
          "development"
            ? error?.stack
            : undefined,
      });
  }
}
