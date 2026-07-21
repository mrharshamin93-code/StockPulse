const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart";

const cache = new Map();
const inFlight = new Map();

function getCached(key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

async function withCache(
  key,
  ttlMs,
  fetcher,
) {
  const cached = getCached(key);

  if (cached !== null) {
    return cached;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    try {
      const value = await fetcher();

      setCached(
        key,
        value,
        ttlMs,
      );

      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(
    key,
    promise,
  );

  return promise;
}

function requireFinnhubApiKey() {
  if (!FINNHUB_API_KEY) {
    const error = new Error(
      "Missing FINNHUB_API_KEY",
    );

    error.statusCode = 500;

    throw error;
  }
}

async function finnhubGet(
  path,
  params = {},
  retries = 2,
) {
  requireFinnhubApiKey();

  const url = new URL(
    `${FINNHUB_BASE_URL}${path}`,
  );

  url.searchParams.set(
    "token",
    FINNHUB_API_KEY,
  );

  for (
    const [key, value] of
    Object.entries(params)
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value),
      );
    }
  }

  const response = await fetch(
    url.toString(),
  );

  if (
    response.status === 429 &&
    retries > 0
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1500,
        ),
    );

    return finnhubGet(
      path,
      params,
      retries - 1,
    );
  }

  if (!response.ok) {
    const text = await response
      .text()
      .catch(() => "");

    throw new Error(
      `Finnhub error: ${response.status} ` +
        `${response.statusText} - ${text}`,
    );
  }

  return response.json();
}

function normalizeTickers(value) {
  if (Array.isArray(value)) {
    return value
      .map((ticker) =>
        String(ticker)
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed =
        JSON.parse(value);

      if (
        Array.isArray(parsed)
      ) {
        return normalizeTickers(
          parsed,
        );
      }
    } catch {
      return value
        .split(",")
        .map((ticker) =>
          ticker
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean);
    }
  }

  return [];
}

function getBody(req) {
  const source =
    req.method === "GET"
      ? req.query
      : req.body || {};

  return {
    ...source,

    action:
      source.action,

    ticker:
      source.ticker
        ? String(
            source.ticker,
          )
            .trim()
            .toUpperCase()
        : undefined,

    query:
      source.query ||
      source.q,

    resolution:
      source.resolution,

    period:
      source.period,

    from:
      Number.isFinite(
        Number(
          source.from,
        ),
      )
        ? Number(
            source.from,
          )
        : undefined,

    to:
      Number.isFinite(
        Number(
          source.to,
        ),
      )
        ? Number(
            source.to,
          )
        : undefined,

    tickers:
      normalizeTickers(
        source.tickers,
      ),
  };
}

function mapQuoteData(
  ticker,
  data,
) {
  const numberOrNull =
    (value) =>
      typeof value ===
        "number" &&
      Number.isFinite(value)
        ? value
        : null;

  return {
    ticker,

    c:
      numberOrNull(
        data?.c,
      ),

    dp:
      numberOrNull(
        data?.dp,
      ),

    d:
      numberOrNull(
        data?.d,
      ),

    pc:
      numberOrNull(
        data?.pc,
      ),

    h:
      numberOrNull(
        data?.h,
      ),

    l:
      numberOrNull(
        data?.l,
      ),

    o:
      numberOrNull(
        data?.o,
      ),

    t:
      numberOrNull(
        data?.t,
      ),
  };
}

function emptyQuote(
  ticker,
  error = null,
) {
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

    ...(error
      ? {
          error,
        }
      : {}),
  };
}

async function getQuote(
  ticker,
) {
  return withCache(
    `quote:${ticker}`,
    15_000,
    async () => {
      const data =
        await finnhubGet(
          "/quote",
          {
            symbol:
              ticker,
          },
        );

      return mapQuoteData(
        ticker,
        data,
      );
    },
  );
}

function normalizePeriod(value) {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  const periods = {
    "1D": "1D",
    "1W": "1W",
    "1M": "1M",
    "3M": "3M",
    "6M": "6M",
    YTD: "YTD",
    "1Y": "1Y",
    "2Y": "2Y",
    "5Y": "5Y",
    "10Y": "10Y",
    ALL: "All",
  };

  return (
    periods[
      normalized
    ] || ""
  );
}

function inferPeriod(
  resolution,
  fromTs,
  toTs,
  requestedPeriod,
) {
  const explicit =
    normalizePeriod(
      requestedPeriod,
    );

  if (explicit) {
    return explicit;
  }

  const normalizedResolution =
    String(
      resolution || "",
    ).toUpperCase();

  const rangeDays =
    Math.max(
      0,
      toTs - fromTs,
    ) / 86400;

  const now =
    new Date(
      toTs * 1000,
    );

  const yearStart =
    Date.UTC(
      now.getUTCFullYear(),
      0,
      1,
      0,
      0,
      0,
      0,
    ) / 1000;

  if (
    normalizedResolution ===
      "5" &&
    rangeDays <= 2
  ) {
    return "1D";
  }

  if (
    normalizedResolution ===
      "60" &&
    rangeDays <= 10
  ) {
    return "1W";
  }

  if (
    normalizedResolution ===
    "D"
  ) {
    if (
      Math.abs(
        fromTs -
          yearStart,
      ) <=
      3 * 86400
    ) {
      return "YTD";
    }

    if (
      rangeDays >= 24 &&
      rangeDays <= 40
    ) {
      return "1M";
    }

    if (
      rangeDays >= 75 &&
      rangeDays <= 115
    ) {
      return "3M";
    }

    if (
      rangeDays >= 150 &&
      rangeDays <= 220
    ) {
      return "6M";
    }

    if (
      rangeDays >= 320 &&
      rangeDays <= 420
    ) {
      return "1Y";
    }
  }

  if (
    normalizedResolution ===
    "W"
  ) {
    return rangeDays <=
      1100
      ? "2Y"
      : "5Y";
  }

  if (
    normalizedResolution ===
    "M"
  ) {
    return rangeDays <=
      5000
      ? "10Y"
      : "All";
  }

  return "Custom";
}

function daysInUtcMonth(
  year,
  month,
) {
  return new Date(
    Date.UTC(
      year,
      month + 1,
      0,
    ),
  ).getUTCDate();
}

function shiftUtcMonths(
  timestamp,
  months,
) {
  const source =
    new Date(
      timestamp * 1000,
    );

  const rawMonth =
    source.getUTCMonth() +
    months;

  const targetYear =
    source.getUTCFullYear() +
    Math.floor(
      rawMonth / 12,
    );

  const targetMonth =
    ((rawMonth % 12) +
      12) %
    12;

  const targetDay =
    Math.min(
      source.getUTCDate(),
      daysInUtcMonth(
        targetYear,
        targetMonth,
      ),
    );

  return Math.floor(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ) / 1000,
  );
}

function shiftUtcYears(
  timestamp,
  years,
) {
  const source =
    new Date(
      timestamp * 1000,
    );

  const targetYear =
    source.getUTCFullYear() +
    years;

  const targetMonth =
    source.getUTCMonth();

  const targetDay =
    Math.min(
      source.getUTCDate(),
      daysInUtcMonth(
        targetYear,
        targetMonth,
      ),
    );

  return Math.floor(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ) / 1000,
  );
}

function getPeriodStart(
  period,
  fromTs,
  toTs,
) {
  switch (period) {
    case "1D":
      return (
        toTs -
        86400
      );

    case "1W":
      return (
        toTs -
        7 * 86400
      );

    case "1M":
      return shiftUtcMonths(
        toTs,
        -1,
      );

    case "3M":
      return shiftUtcMonths(
        toTs,
        -3,
      );

    case "6M":
      return shiftUtcMonths(
        toTs,
        -6,
      );

    case "YTD": {
      const date =
        new Date(
          toTs * 1000,
        );

      return Math.floor(
        Date.UTC(
          date.getUTCFullYear(),
          0,
          1,
          0,
          0,
          0,
          0,
        ) / 1000,
      );
    }

    case "1Y":
      return shiftUtcYears(
        toTs,
        -1,
      );

    case "2Y":
      return shiftUtcYears(
        toTs,
        -2,
      );

    case "5Y":
      return shiftUtcYears(
        toTs,
        -5,
      );

    case "10Y":
      return shiftUtcYears(
        toTs,
        -10,
      );

    case "All":
      return 0;

    default:
      return fromTs;
  }
}

function getHistoryBufferSeconds(
  period,
) {
  if (period === "1D") {
    return (
      8 * 86400
    );
  }

  if (
    [
      "1W",
      "1M",
      "3M",
      "6M",
      "YTD",
      "1Y",
    ].includes(period)
  ) {
    return (
      14 * 86400
    );
  }

  if (
    [
      "2Y",
      "5Y",
    ].includes(period)
  ) {
    return (
      45 * 86400
    );
  }

  if (
    period ===
    "10Y"
  ) {
    return (
      100 * 86400
    );
  }

  return 0;
}

function getSourceInterval(
  period,
) {
  return period ===
    "1D"
    ? "5m"
    : "1d";
}

function getResponseInterval(
  period,
  resolution,
) {
  if (
    period ===
    "1D"
  ) {
    return "5m";
  }

  if (
    period ===
    "1W"
  ) {
    return "1d";
  }

  const normalized =
    String(
      resolution || "",
    ).toUpperCase();

  if (
    normalized ===
    "W"
  ) {
    return "1wk";
  }

  if (
    normalized ===
    "M"
  ) {
    return "1mo";
  }

  return "1d";
}

function parseSplitRatio(split) {
  const numerator =
    Number(
      split?.numerator,
    );

  const denominator =
    Number(
      split?.denominator,
    );

  if (
    Number.isFinite(
      numerator,
    ) &&
    numerator > 0 &&
    Number.isFinite(
      denominator,
    ) &&
    denominator > 0
  ) {
    return (
      numerator /
      denominator
    );
  }

  const raw =
    String(
      split?.splitRatio ||
        split?.split_ratio ||
        "",
    ).trim();

  const match =
    raw.match(
      /^([\d.]+)\s*[:/]\s*([\d.]+)$/,
    );

  if (!match) {
    return null;
  }

  const left =
    Number(match[1]);

  const right =
    Number(match[2]);

  return (
    Number.isFinite(left) &&
    left > 0 &&
    Number.isFinite(right) &&
    right > 0
  )
    ? left / right
    : null;
}

function normalizeSplitEvents(
  result,
) {
  return Object.values(
    result?.events
      ?.splits || {},
  )
    .map((split) => {
      const timestamp =
        Number(
          split?.date,
        );

      const ratio =
        parseSplitRatio(
          split,
        );

      if (
        !Number.isFinite(
          timestamp,
        ) ||
        !Number.isFinite(
          ratio,
        ) ||
        ratio <= 0
      ) {
        return null;
      }

      return {
        timestamp,
        ratio,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.timestamp -
        b.timestamp,
    );
}

function splitFactorAfter(
  timestamp,
  splits,
) {
  return splits.reduce(
    (
      factor,
      split,
    ) =>
      split.timestamp >
      timestamp
        ? factor *
          split.ratio
        : factor,
    1,
  );
}

function splitAdjustedValue(
  value,
  factor,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return null;
  }

  return (
    Number.isFinite(
      factor,
    ) &&
    factor > 0
  )
    ? number / factor
    : number;
}

async function fetchYahooHistory(
  ticker,
  fromTs,
  toTs,
  interval,
) {
  const symbol =
    encodeURIComponent(
      ticker.toUpperCase(),
    );

  const params =
    new URLSearchParams({
      period1:
        String(
          Math.max(
            1,
            Math.floor(
              fromTs,
            ),
          ),
        ),

      period2:
        String(
          Math.floor(
            toTs + 120,
          ),
        ),

      interval,

      events:
        "splits",

      includeAdjustedClose:
        "false",
    });

  const response =
    await fetch(
      `${YAHOO_CHART_URL}/${symbol}?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 Chrome/120 Safari/537.36",

          Accept:
            "application/json",
        },
      },
    );

  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `Yahoo chart request failed: ` +
        `${response.status} ${text}`,
    );
  }

  const json =
    await response.json();

  const chartError =
    json?.chart?.error;

  if (chartError) {
    throw new Error(
      chartError.description ||
        chartError.code ||
        "Yahoo chart error",
    );
  }

  const result =
    json?.chart
      ?.result?.[0];

  if (!result) {
    return {
      candles: [],
      utcOffsetSeconds: 0,
      interval,
    };
  }

  const timestamps =
    result.timestamp || [];

  const quote =
    result.indicators
      ?.quote?.[0] || {};

  const splits =
    normalizeSplitEvents(
      result,
    );

  const candles =
    timestamps
      .map(
        (
          timestamp,
          index,
        ) => {
          const rawClose =
            Number(
              quote.close?.[
                index
              ],
            );

          if (
            !Number.isFinite(
              timestamp,
            ) ||
            !Number.isFinite(
              rawClose,
            )
          ) {
            return null;
          }

          const factor =
            splitFactorAfter(
              timestamp,
              splits,
            );

          const close =
            splitAdjustedValue(
              rawClose,
              factor,
            );

          if (
            !Number.isFinite(
              close,
            )
          ) {
            return null;
          }

          return {
            t:
              timestamp,

            v:
              close,

            o:
              splitAdjustedValue(
                quote.open?.[
                  index
                ],
                factor,
              ),

            h:
              splitAdjustedValue(
                quote.high?.[
                  index
                ],
                factor,
              ),

            l:
              splitAdjustedValue(
                quote.low?.[
                  index
                ],
                factor,
              ),

            c:
              close,

            volume:
              Number.isFinite(
                Number(
                  quote.volume?.[
                    index
                  ],
                ),
              )
                ? Number(
                    quote.volume[
                      index
                    ],
                  )
                : null,
          };
        },
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.t - b.t,
      );

  return {
    candles,

    utcOffsetSeconds:
      Number(
        result?.meta
          ?.gmtoffset,
      ) || 0,

    interval,
  };
}

function localDateKey(
  timestamp,
  utcOffsetSeconds,
) {
  return new Date(
    (
      timestamp +
      utcOffsetSeconds
    ) * 1000,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

function weekKey(timestamp) {
  const date =
    new Date(
      timestamp * 1000,
    );

  const weekday =
    date.getUTCDay();

  const daysFromMonday =
    (weekday + 6) % 7;

  return String(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() -
        daysFromMonday,
    ),
  );
}

function monthKey(timestamp) {
  const date =
    new Date(
      timestamp * 1000,
    );

  return (
    `${date.getUTCFullYear()}-` +
    `${String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      "0",
    )}`
  );
}

function downsampleCandles(
  candles,
  interval,
  anchorTimestamp,
) {
  if (
    interval === "1d" ||
    interval === "5m"
  ) {
    return candles;
  }

  const anchor =
    candles.find(
      (candle) =>
        candle.t ===
        anchorTimestamp,
    );

  const grouped =
    new Map();

  for (
    const candle of
    candles
  ) {
    if (
      candle.t <=
      anchorTimestamp
    ) {
      continue;
    }

    const key =
      interval ===
      "1wk"
        ? weekKey(
            candle.t,
          )
        : monthKey(
            candle.t,
          );

    grouped.set(
      key,
      candle,
    );
  }

  return [
    ...(anchor
      ? [anchor]
      : []),

    ...grouped.values(),
  ].sort(
    (a, b) =>
      a.t - b.t,
  );
}

function quoteCandle(
  quote,
  fallbackTimestamp,
) {
  const current =
    Number(
      quote?.c,
    );

  if (
    !Number.isFinite(
      current,
    ) ||
    current <= 0
  ) {
    return null;
  }

  return {
    t:
      Number.isFinite(
        Number(
          quote?.t,
        ),
      ) &&
      Number(
        quote.t,
      ) > 0
        ? Number(
            quote.t,
          )
        : fallbackTimestamp,

    v:
      current,

    o:
      Number.isFinite(
        Number(
          quote?.o,
        ),
      )
        ? Number(
            quote.o,
          )
        : current,

    h:
      Number.isFinite(
        Number(
          quote?.h,
        ),
      )
        ? Number(
            quote.h,
          )
        : current,

    l:
      Number.isFinite(
        Number(
          quote?.l,
        ),
      )
        ? Number(
            quote.l,
          )
        : current,

    c:
      current,

    volume:
      null,
  };
}

function appendOrReplaceLatest(
  candles,
  latest,
  interval,
) {
  if (!latest) {
    return candles;
  }

  const keyFor =
    (candle) => {
      if (
        interval ===
        "5m"
      ) {
        return Math.floor(
          candle.t /
            300,
        );
      }

      if (
        interval ===
        "1wk"
      ) {
        return weekKey(
          candle.t,
        );
      }

      if (
        interval ===
        "1mo"
      ) {
        return monthKey(
          candle.t,
        );
      }

      return localDateKey(
        candle.t,
        0,
      );
    };

  const next = [
    ...candles,
  ];

  const latestKey =
    keyFor(
      latest,
    );

  const replaceIndex =
    [...next]
      .map(
        (
          candle,
          index,
        ) => ({
          candle,
          index,
        }),
      )
      .reverse()
      .find(
        ({ candle }) =>
          keyFor(
            candle,
          ) ===
          latestKey,
      )?.index;

  if (
    Number.isInteger(
      replaceIndex,
    )
  ) {
    next[
      replaceIndex
    ] = latest;
  } else {
    next.push(
      latest,
    );
  }

  return next.sort(
    (a, b) =>
      a.t - b.t,
  );
}

function findAnchorCandle(
  candles,
  targetTimestamp,
) {
  return (
    [...candles]
      .reverse()
      .find(
        (candle) =>
          candle.t <=
          targetTimestamp,
      ) ||
    candles.find(
      (candle) =>
        candle.t >=
        targetTimestamp,
    ) ||
    null
  );
}

function shapeOneDay(
  history,
  quote,
  toTs,
) {
  const candles =
    history.candles || [];

  const latest =
    candles[
      candles.length - 1
    ];

  if (!latest) {
    return [];
  }

  const latestSession =
    localDateKey(
      latest.t,
      history
        .utcOffsetSeconds ||
        0,
    );

  const session =
    candles.filter(
      (candle) =>
        localDateKey(
          candle.t,
          history
            .utcOffsetSeconds ||
            0,
        ) ===
        latestSession,
    );

  const previousClose =
    Number(
      quote?.pc,
    );

  const anchor =
    Number.isFinite(
      previousClose,
    ) &&
    previousClose > 0
      ? {
          t:
            (
              session[0]?.t ||
              toTs
            ) - 1,

          v:
            previousClose,

          o:
            previousClose,

          h:
            previousClose,

          l:
            previousClose,

          c:
            previousClose,

          volume:
            null,
        }
      : null;

  return appendOrReplaceLatest(
    [
      ...(anchor
        ? [anchor]
        : []),

      ...session,
    ],

    quoteCandle(
      quote,
      toTs,
    ),

    "5m",
  );
}

function shapeLongPeriod(
  history,
  quote,
  period,
  targetStart,
  responseInterval,
  toTs,
) {
  const candles =
    history.candles || [];

  if (
    !candles.length
  ) {
    return [];
  }

  const anchor =
    period ===
    "All"
      ? candles[0]
      : findAnchorCandle(
          candles,
          targetStart,
        );

  if (!anchor) {
    return [];
  }

  const visible =
    candles.filter(
      (candle) =>
        candle.t >=
        anchor.t,
    );

  const sampled =
    downsampleCandles(
      visible,
      responseInterval,
      anchor.t,
    );

  return appendOrReplaceLatest(
    sampled,

    quoteCandle(
      quote,
      toTs,
    ),

    responseInterval,
  );
}

async function getPeriodCandles({
  ticker,
  resolution,
  fromTs,
  toTs,
  requestedPeriod,
}) {
  const period =
    inferPeriod(
      resolution,
      fromTs,
      toTs,
      requestedPeriod,
    );

  const targetStart =
    getPeriodStart(
      period,
      fromTs,
      toTs,
    );

  const buffer =
    getHistoryBufferSeconds(
      period,
    );

  const fetchFrom =
    period === "All"
      ? 1
      : period === "1D"
        ? Math.max(
            1,
            toTs -
              buffer,
          )
        : Math.max(
            1,
            targetStart -
              buffer,
          );

  const sourceInterval =
    getSourceInterval(
      period,
    );

  const responseInterval =
    getResponseInterval(
      period,
      resolution,
    );

  const cacheKey = [
    "yahoo-split-only-v4",
    ticker,
    period,
    sourceInterval,
    Math.floor(
      fetchFrom,
    ),
    Math.floor(
      toTs / 300,
    ),
  ].join(":");

  const [
    history,
    quote,
  ] =
    await Promise.all([
      withCache(
        cacheKey,
        5 * 60_000,
        () =>
          fetchYahooHistory(
            ticker,
            fetchFrom,
            toTs,
            sourceInterval,
          ),
      ),

      getQuote(
        ticker,
      ),
    ]);

  const candles =
    period === "1D"
      ? shapeOneDay(
          history,
          quote,
          toTs,
        )
      : shapeLongPeriod(
          history,
          quote,
          period,
          targetStart,
          responseInterval,
          toTs,
        );

  return {
    candles,

    interval:
      responseInterval,

    sourceInterval,

    period,

    priceAdjustment:
      "splits-only",

    currentPrice:
      Number.isFinite(
        Number(
          quote?.c,
        ),
      )
        ? Number(
            quote.c,
          )
        : null,

    previousClose:
      Number.isFinite(
        Number(
          quote?.pc,
        ),
      )
        ? Number(
            quote.pc,
          )
        : null,
  };
}

async function handleNews(
  ticker,
) {
  return withCache(
    `news:${ticker}`,
    10 * 60_000,
    async () => {
      const toDate =
        new Date()
          .toISOString()
          .split(
            "T",
          )[0];

      const fromDate =
        new Date(
          Date.now() -
            90 *
              86400 *
              1000,
        )
          .toISOString()
          .split(
            "T",
          )[0];

      const [
        data,
        profileData,
      ] =
        await Promise.all([
          finnhubGet(
            "/company-news",
            {
              symbol:
                ticker,

              from:
                fromDate,

              to:
                toDate,
            },
          ),

          finnhubGet(
            "/stock/profile2",
            {
              symbol:
                ticker,
            },
          ),
        ]);

      const companyName =
        String(
          profileData?.name ||
            "",
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
            b.datetime ||
              0,
          ) -
          Number(
            a.datetime ||
              0,
          ),
      );

      const relevant =
        all.filter(
          (article) => {
            const text =
              `${
                article.headline ||
                ""
              } ${
                article.summary ||
                ""
              }`.toLowerCase();

            return (
              text.includes(
                tickerLower,
              ) ||
              (
                companyName &&
                text.includes(
                  companyName,
                )
              )
            );
          },
        );

      const sourceCounts =
        {};

      const articles =
        [];

      const pool =
        relevant.length >=
        3
          ? relevant
          : all;

      for (
        const article of
        pool
      ) {
        const source =
          String(
            article.source ||
              "",
          ).toLowerCase();

        sourceCounts[
          source
        ] =
          (
            sourceCounts[
              source
            ] || 0
          ) + 1;

        if (
          sourceCounts[
            source
          ] <= 2
        ) {
          articles.push({
            title:
              article.headline,

            summary:
              article.summary,

            url:
              article.url,

            source:
              article.source,

            date:
              article.datetime
                ? new Date(
                    article.datetime *
                      1000,
                  ).toLocaleDateString()
                : null,
          });
        }

        if (
          articles.length >=
          10
        ) {
          break;
        }
      }

      return {
        articles,
      };
    },
  );
}

async function handleProfile(
  ticker,
) {
  return withCache(
    `profile:${ticker}`,
    24 *
      60 *
      60_000,
    async () => {
      const data =
        await finnhubGet(
          "/stock/profile2",
          {
            symbol:
              ticker,
          },
        );

      return {
        exchange:
          data.exchange ||
          null,

        name:
          data.name ||
          null,

        ticker:
          data.ticker ||
          ticker,

        finnhubIndustry:
          data.finnhubIndustry ||
          null,

        logo:
          data.logo ||
          null,

        weburl:
          data.weburl ||
          null,

        marketCapitalization:
          data.marketCapitalization ||
          null,

        currency:
          data.currency ||
          null,

        country:
          data.country ||
          null,
      };
    },
  );
}

async function handleSearch(
  query,
) {
  const normalizedQuery =
    String(query).trim();

  return withCache(
    `search:${normalizedQuery.toUpperCase()}`,
    5 * 60_000,
    async () => {
      const data =
        await finnhubGet(
          "/search",
          {
            q:
              normalizedQuery,
          },
        );

      const results = (
        data.result ||
        []
      )
        .filter(
          (item) => {
            const symbol =
              String(
                item?.symbol ||
                  "",
              ).trim();

            const type =
              String(
                item?.type ||
                  "",
              ).toLowerCase();

            return (
              symbol &&
              !symbol.includes(
                ".",
              ) &&
              (
                type.includes(
                  "stock",
                ) ||
                type.includes(
                  "equity",
                ) ||
                type.includes(
                  "common",
                ) ||
                type === ""
              )
            );
          },
        )
        .slice(
          0,
          8,
        )
        .map(
          (item) => ({
            ticker:
              String(
                item.symbol ||
                  "",
              )
                .trim()
                .toUpperCase(),

            name:
              String(
                item.description ||
                  item.displaySymbol ||
                  item.symbol ||
                  "",
              ).trim(),

            exchange:
              String(
                item.primaryExchange ||
                  item.exchange ||
                  "",
              ).trim(),

            symbol:
              String(
                item.symbol ||
                  "",
              )
                .trim()
                .toUpperCase(),

            description:
              String(
                item.description ||
                  item.displaySymbol ||
                  item.symbol ||
                  "",
              ).trim(),

            primaryExchange:
              String(
                item.primaryExchange ||
                  item.exchange ||
                  "",
              ).trim(),
          }),
        )
        .filter(
          (item) =>
            item.ticker,
        );

      return {
        results,
        result:
          results,
      };
    },
  );
}

export default async function handler(
  req,
  res,
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    return res
      .status(405)
      .json({
        error:
          "Method not allowed",
      });
  }

  try {
    const body =
      getBody(req);

    const {
      action,
      ticker,
      tickers,
    } = body;

    if (
      action ===
      "quote"
    ) {
      if (!ticker) {
        return res
          .status(400)
          .json({
            error:
              "Missing ticker",
          });
      }

      return res
        .status(200)
        .json(
          await getQuote(
            ticker,
          ),
        );
    }

    if (
      action ===
      "quotes"
    ) {
      if (
        !tickers.length
      ) {
        return res
          .status(400)
          .json({
            error:
              "Missing tickers",
          });
      }

      const quotes =
        await Promise.all(
          tickers.map(
            async (
              normalizedTicker,
            ) => {
              try {
                return await getQuote(
                  normalizedTicker,
                );
              } catch (error) {
                return emptyQuote(
                  normalizedTicker,
                  error?.message ||
                    "Failed to fetch quote",
                );
              }
            },
          ),
        );

      return res
        .status(200)
        .json({
          quotes,
        });
    }

    if (
      action ===
      "candles"
    ) {
      if (!ticker) {
        return res
          .status(400)
          .json({
            error:
              "Missing ticker",
          });
      }

      const toTs =
        Math.floor(
          Date.now() /
            1000,
        );

      const fromTs =
        toTs -
        365 * 86400;

      const result =
        await getPeriodCandles({
          ticker,

          resolution:
            body.resolution ||
            "D",

          fromTs,

          toTs,

          requestedPeriod:
            body.period ||
            "1Y",
        });

      return res
        .status(200)
        .json(result);
    }

    if (
      action ===
      "candles_range"
    ) {
      if (!ticker) {
        return res
          .status(400)
          .json({
            error:
              "Missing ticker",
          });
      }

      const now =
        Math.floor(
          Date.now() /
            1000,
        );

      const toTs =
        body.to ??
        now;

      const fromTs =
        body.from ??
        toTs -
          30 * 86400;

      if (
        !Number.isFinite(
          fromTs,
        ) ||
        !Number.isFinite(
          toTs,
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "`from` and `to` must be Unix timestamps",
          });
      }

      if (
        fromTs >= toTs
      ) {
        return res
          .status(400)
          .json({
            error:
              "`from` must be earlier than `to`",
          });
      }

      const result =
        await getPeriodCandles({
          ticker,

          resolution:
            body.resolution ||
            "D",

          fromTs,

          toTs,

          requestedPeriod:
            body.period,
        });

      return res
        .status(200)
        .json(result);
    }

    if (
      action ===
      "news"
    ) {
      if (!ticker) {
        return res
          .status(400)
          .json({
            error:
              "Missing ticker",
          });
      }

      return res
        .status(200)
        .json(
          await handleNews(
            ticker,
          ),
        );
    }

    if (
      action ===
      "profile"
    ) {
      if (!ticker) {
        return res
          .status(400)
          .json({
            error:
              "Missing ticker",
          });
      }

      return res
        .status(200)
        .json(
          await handleProfile(
            ticker,
          ),
        );
    }

    if (
      action ===
      "search"
    ) {
      const query =
        body.query ||
        ticker;

      if (!query) {
        return res
          .status(400)
          .json({
            error:
              "Missing query",
          });
      }

      return res
        .status(200)
        .json(
          await handleSearch(
            query,
          ),
        );
    }

    return res
      .status(400)
      .json({
        error:
          "Unknown action",
      });
  } catch (error) {
    console.error(
      "Finnhub proxy error:",
      error,
    );

    return res
      .status(
        error?.statusCode ||
          500,
      )
      .json({
        error:
          error?.message ||
          "Internal server error",

        stack:
          process.env
            .NODE_ENV ===
          "development"
            ? error?.stack
            : undefined,
      });
  }
}
