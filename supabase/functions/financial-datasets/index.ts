const FINANCIAL_DATASETS_API_KEY =
  Deno.env.get("FINANCIAL_DATASETS_API_KEY") || "";

const API_BASE_URL =
  "https://api.financialdatasets.ai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUOTE_TTL_MS = 15_000;
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const NEWS_TTL_MS = 10 * 60 * 1000;
const CANDLES_TTL_MS = 5 * 60 * 1000;
const METRICS_TTL_MS = 60 * 60 * 1000;
const TICKER_DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000;
const QUOTE_REQUEST_CONCURRENCY = 5;

const cache = new Map();

class ProviderError extends Error {
  status: number;
  payload: unknown;

  constructor(
    message: string,
    status: number,
    payload: unknown = null,
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.payload = payload;
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function normalizeText(
  value: unknown,
): string {
  return String(value ?? "").trim();
}

function normalizeTicker(
  value: unknown,
): string {
  return normalizeText(value)
    .toUpperCase();
}

function normalizeTickers(
  value: unknown,
): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [
    ...new Set(
      raw
        .map(normalizeTicker)
        .filter(Boolean),
    ),
  ];
}

function finiteNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function timestampSeconds(
  value: unknown,
): number | null {
  const numeric = finiteNumber(value);

  if (numeric !== null) {
    return numeric > 10_000_000_000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric);
  }

  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);

  return Number.isFinite(parsed)
    ? Math.floor(parsed / 1000)
    : null;
}

function isoDateFromUnix(
  value: unknown,
): string | null {
  const seconds = finiteNumber(value);

  if (
    seconds === null ||
    seconds <= 0
  ) {
    return null;
  }

  const date = new Date(
    seconds * 1000,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function todayIso(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function subtractDaysIso(
  days: number,
): string {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() - days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function periodBounds(
  period: unknown,
): {
  startDate: string;
  endDate: string;
} {
  const normalized =
    normalizeText(period)
      .toUpperCase() || "1Y";

  const endDate = todayIso();
  const date = new Date();

  switch (normalized) {
    case "1D":
      date.setUTCDate(
        date.getUTCDate() - 7,
      );
      break;

    case "1W":
    case "5D":
      date.setUTCDate(
        date.getUTCDate() - 14,
      );
      break;

    case "1M":
      date.setUTCMonth(
        date.getUTCMonth() - 1,
      );
      break;

    case "3M":
      date.setUTCMonth(
        date.getUTCMonth() - 3,
      );
      break;

    case "6M":
      date.setUTCMonth(
        date.getUTCMonth() - 6,
      );
      break;

    case "YTD":
      date.setUTCMonth(0, 1);
      break;

    case "2Y":
      date.setUTCFullYear(
        date.getUTCFullYear() - 2,
      );
      break;

    case "5Y":
      date.setUTCFullYear(
        date.getUTCFullYear() - 5,
      );
      break;

    case "10Y":
      date.setUTCFullYear(
        date.getUTCFullYear() - 10,
      );
      break;

    case "ALL":
      date.setUTCFullYear(
        date.getUTCFullYear() - 30,
      );
      break;

    case "1Y":
    default:
      date.setUTCFullYear(
        date.getUTCFullYear() - 1,
      );
      break;
  }

  return {
    startDate: date
      .toISOString()
      .slice(0, 10),
    endDate,
  };
}

function intervalFromResolution(
  resolution: unknown,
): "day" | "week" | "month" | "year" {
  const normalized =
    normalizeText(resolution)
      .toUpperCase();

  if (
    normalized === "W" ||
    normalized === "1W" ||
    normalized === "WEEK"
  ) {
    return "week";
  }

  if (
    normalized === "M" ||
    normalized === "1M" ||
    normalized === "MONTH"
  ) {
    return "month";
  }

  if (
    normalized === "Y" ||
    normalized === "1Y" ||
    normalized === "YEAR"
  ) {
    return "year";
  }

  // Financial Datasets historical prices are EOD.
  // Unsupported intraday resolutions intentionally fall back
  // to daily candles.
  return "day";
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing =
    cache.get(key);

  if (
    existing &&
    Date.now() <
      existing.expiresAt
  ) {
    return existing.value as T;
  }

  const value =
    await fetcher();

  cache.set(key, {
    value,
    expiresAt:
      Date.now() + ttlMs,
  });

  return value;
}

function providerMessage(
  status: number,
  payload: unknown,
): string {
  if (
    payload &&
    typeof payload === "object"
  ) {
    const record =
      payload as Record<
        string,
        unknown
      >;

    const message =
      normalizeText(
        record.message,
      ) ||
      normalizeText(
        record.error,
      ) ||
      normalizeText(
        record.detail,
      );

    if (message) {
      return message;
    }
  }

  if (
    typeof payload === "string" &&
    payload.trim()
  ) {
    return payload.trim();
  }

  if (status === 401) {
    return "Financial Datasets rejected the API key.";
  }

  if (status === 402) {
    return "Financial Datasets requires an active paid plan or API credits.";
  }

  if (status === 404) {
    return "The requested ticker or Financial Datasets resource was not found.";
  }

  if (status === 429) {
    return "Financial Datasets rate limit reached.";
  }

  return `Financial Datasets returned status ${status}.`;
}

async function providerGet(
  path: string,
  query: Record<
    string,
    unknown
  > = {},
  retries = 2,
): Promise<unknown> {
  if (
    !FINANCIAL_DATASETS_API_KEY
  ) {
    throw new ProviderError(
      "Missing FINANCIAL_DATASETS_API_KEY.",
      500,
    );
  }

  const url = new URL(
    `${API_BASE_URL}${path}`,
  );

  for (
    const [key, value] of
      Object.entries(query)
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

  const response =
    await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json",
          "X-API-KEY":
            FINANCIAL_DATASETS_API_KEY,
        },
      },
    );

  const text =
    await response.text();

  let payload: unknown = null;

  if (text) {
    try {
      payload =
        JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (
    response.status === 429 &&
    retries > 0
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1000 *
            (3 - retries),
        ),
    );

    return providerGet(
      path,
      query,
      retries - 1,
    );
  }

  if (!response.ok) {
    throw new ProviderError(
      providerMessage(
        response.status,
        payload,
      ),
      response.status,
      payload,
    );
  }

  return payload;
}

function emptyQuote(
  ticker: string,
  error?: string,
) {
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
    ...(error
      ? { error }
      : {}),
  };
}

function normalizeQuote(
  ticker: string,
  payload: unknown,
) {
  const root =
    payload &&
    typeof payload === "object"
      ? payload as Record<
          string,
          unknown
        >
      : {};

  const snapshot =
    root.snapshot &&
    typeof root.snapshot ===
      "object"
      ? root.snapshot as Record<
          string,
          unknown
        >
      : root;

  const current =
    finiteNumber(
      snapshot.price ??
        snapshot.close ??
        snapshot.current_price,
    );

  const change =
    finiteNumber(
      snapshot.day_change ??
        snapshot.change ??
        snapshot.change_amount,
    );

  const previousCloseDirect =
    finiteNumber(
      snapshot.previous_close ??
        snapshot.previousClose,
    );

  const previousClose =
    previousCloseDirect ??
    (
      current !== null &&
      change !== null
        ? current - change
        : null
    );

  let changePercent =
    finiteNumber(
      snapshot.day_change_percent ??
        snapshot.change_percent ??
        snapshot.changePercent,
    );

  if (
    changePercent === null &&
    change !== null &&
    previousClose !== null &&
    previousClose !== 0
  ) {
    changePercent =
      change /
      previousClose *
      100;
  }

  return {
    ticker:
      normalizeTicker(
        snapshot.ticker,
      ) || ticker,

    c: current,
    d: change,
    dp: changePercent,

    h: finiteNumber(
      snapshot.high ??
        snapshot.day_high,
    ),

    l: finiteNumber(
      snapshot.low ??
        snapshot.day_low,
    ),

    o: finiteNumber(
      snapshot.open ??
        snapshot.open_price,
    ),

    pc: previousClose,

    t:
      timestampSeconds(
        snapshot.time_milliseconds,
      ) ??
      timestampSeconds(
        snapshot.time,
      ),
  };
}

async function getQuote(
  ticker: string,
) {
  return withCache(
    `quote:${ticker}`,
    QUOTE_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/prices/snapshot",
          { ticker },
        );

      return normalizeQuote(
        ticker,
        payload,
      );
    },
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (
    value: T,
  ) => Promise<R>,
): Promise<R[]> {
  const results =
    new Array<R>(
      values.length,
    );

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      results[index] =
        await worker(
          values[index],
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          concurrency,
          values.length,
        ),
      },
      () => runWorker(),
    ),
  );

  return results;
}

async function getQuotes(
  tickers: string[],
) {
  const quotes =
    await mapWithConcurrency(
      tickers,
      QUOTE_REQUEST_CONCURRENCY,
      async (ticker) => {
        try {
          return await getQuote(
            ticker,
          );
        } catch (error) {
          return emptyQuote(
            ticker,
            error instanceof Error
              ? error.message
              : "Quote request failed.",
          );
        }
      },
    );

  return { quotes };
}

async function getProfile(
  ticker: string,
) {
  return withCache(
    `profile:${ticker}`,
    PROFILE_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/company/facts",
          { ticker },
        );

      const root =
        payload &&
        typeof payload === "object"
          ? payload as Record<
              string,
              unknown
            >
          : {};

      const facts =
        root.company_facts &&
        typeof root.company_facts ===
          "object"
          ? root.company_facts as Record<
              string,
              unknown
            >
          : {};

      const marketCap =
        finiteNumber(
          facts.market_cap,
        );

      return {
        ticker:
          normalizeTicker(
            facts.ticker,
          ) || ticker,

        name:
          normalizeText(
            facts.name,
          ) || ticker,

        exchange:
          normalizeText(
            facts.exchange,
          ) || null,

        industry:
          normalizeText(
            facts.industry ??
              facts.sic_industry,
          ) || null,

        sector:
          normalizeText(
            facts.sector ??
              facts.sic_sector,
          ) || null,

        country:
          normalizeText(
            facts.location,
          ) || "US",

        currency: "USD",
        logo: null,

        weburl:
          normalizeText(
            facts.website_url,
          ) || null,

        marketCapitalization:
          marketCap === null
            ? null
            : marketCap /
              1_000_000,

        marketCap,

        cik:
          normalizeText(
            facts.cik,
          ) || null,

        isActive:
          typeof facts.is_active ===
            "boolean"
            ? facts.is_active
            : null,

        employees:
          finiteNumber(
            facts.number_of_employees,
          ),

        secFilingsUrl:
          normalizeText(
            facts.sec_filings_url,
          ) || null,
      };
    },
  );
}

function normalizeNewsArticle(
  ticker: string,
  item: unknown,
) {
  const record =
    item &&
    typeof item === "object"
      ? item as Record<
          string,
          unknown
        >
      : {};

  const date =
    normalizeText(
      record.date ??
        record.published_at ??
        record.publishedAt ??
        record.time,
    );

  return {
    ticker:
      normalizeTicker(
        record.ticker,
      ) || ticker,

    title:
      normalizeText(
        record.title ??
          record.headline,
      ),

    headline:
      normalizeText(
        record.headline ??
          record.title,
      ),

    source:
      normalizeText(
        record.source ??
          record.publisher,
      ),

    date,

    datetime:
      timestampSeconds(
        record.datetime ??
          record.time ??
          record.published_at,
      ),

    url:
      normalizeText(
        record.url ??
          record.article_url,
      ),

    summary:
      normalizeText(
        record.summary ??
          record.description,
      ),

    image:
      normalizeText(
        record.image ??
          record.image_url,
      ),
  };
}

async function getNews(
  ticker: string,
  limit: number,
) {
  return withCache(
    `news:${ticker}:${limit}`,
    NEWS_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/news",
          {
            ticker,
            limit:
              Math.min(
                Math.max(
                  limit,
                  1,
                ),
                10,
              ),
          },
        );

      const root =
        payload &&
        typeof payload === "object"
          ? payload as Record<
              string,
              unknown
            >
          : {};

      const items =
        Array.isArray(root.news)
          ? root.news
          : [];

      const articles =
        items
          .map(
            (item) =>
              normalizeNewsArticle(
                ticker,
                item,
              ),
          )
          .filter(
            (item) =>
              item.title ||
              item.url,
          );

      return {
        ticker,
        articles,
        news: articles,
      };
    },
  );
}

function normalizeCandle(
  item: unknown,
) {
  const record =
    item &&
    typeof item === "object"
      ? item as Record<
          string,
          unknown
        >
      : {};

  return {
    t: timestampSeconds(
      record.time ??
        record.date,
    ),

    o: finiteNumber(
      record.open,
    ),

    h: finiteNumber(
      record.high,
    ),

    l: finiteNumber(
      record.low,
    ),

    c: finiteNumber(
      record.close ??
        record.price,
    ),

    v: finiteNumber(
      record.volume,
    ),
  };
}

async function getCandles(
  body: Record<
    string,
    unknown
  >,
) {
  const ticker =
    normalizeTicker(
      body.ticker,
    );

  const interval =
    intervalFromResolution(
      body.resolution ??
        body.interval,
    );

  const fallback =
    periodBounds(
      body.period,
    );

  const startDate =
    (
      isoDateFromUnix(
        body.from,
      ) ??
      normalizeText(
        body.start_date ??
          body.startDate,
      )
    ) ||
    fallback.startDate;

  const endDate =
    (
      isoDateFromUnix(
        body.to,
      ) ??
      normalizeText(
        body.end_date ??
          body.endDate,
      )
    ) ||
    fallback.endDate;

  return withCache(
    `candles:${ticker}:${interval}:${startDate}:${endDate}`,
    CANDLES_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/prices",
          {
            ticker,
            interval,
            start_date:
              startDate,
            end_date:
              endDate,
          },
        );

      const root =
        payload &&
        typeof payload === "object"
          ? payload as Record<
              string,
              unknown
            >
          : {};

      const raw =
        Array.isArray(root.prices)
          ? root.prices
          : [];

      const candles =
        raw
          .map(normalizeCandle)
          .filter(
            (item) =>
              item.t !== null &&
              item.c !== null,
          )
          .sort(
            (left, right) =>
              Number(left.t) -
              Number(right.t),
          );

      return {
        ticker,
        interval,

        s:
          candles.length
            ? "ok"
            : "no_data",

        candles,
        prices: candles,

        t: candles.map(
          (item) => item.t,
        ),

        o: candles.map(
          (item) => item.o,
        ),

        h: candles.map(
          (item) => item.h,
        ),

        l: candles.map(
          (item) => item.l,
        ),

        c: candles.map(
          (item) => item.c,
        ),

        v: candles.map(
          (item) => item.v,
        ),
      };
    },
  );
}

async function getMetrics(
  ticker: string,
) {
  return withCache(
    `metrics:${ticker}`,
    METRICS_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/financial-metrics/snapshot",
          { ticker },
        );

      const root =
        payload &&
        typeof payload === "object"
          ? payload as Record<
              string,
              unknown
            >
          : {};

      const snapshot =
        root.snapshot &&
        typeof root.snapshot ===
          "object"
          ? root.snapshot
          : null;

      return {
        ticker,
        snapshot,
        metrics: snapshot,
      };
    },
  );
}

function normalizeTickerDirectory(
  payload: unknown,
) {
  const root =
    payload &&
    typeof payload === "object"
      ? payload as Record<
          string,
          unknown
        >
      : {};

  const possibleLists = [
    root.tickers,
    root.results,
    root.data,
  ];

  const list =
    possibleLists.find(
      Array.isArray,
    ) as unknown[] | undefined;

  if (!list) {
    return [];
  }

  return list
    .map((item) => {
      if (
        typeof item === "string"
      ) {
        const ticker =
          normalizeTicker(item);

        return ticker
          ? {
              ticker,
              name: ticker,
              exchange: "",
            }
          : null;
      }

      if (
        item &&
        typeof item === "object"
      ) {
        const record =
          item as Record<
            string,
            unknown
          >;

        const ticker =
          normalizeTicker(
            record.ticker ??
              record.symbol,
          );

        if (!ticker) {
          return null;
        }

        return {
          ticker,

          name:
            normalizeText(
              record.name ??
                record.company_name ??
                record.description,
            ) || ticker,

          exchange:
            normalizeText(
              record.exchange ??
                record.primary_exchange,
            ),
        };
      }

      return null;
    })
    .filter(Boolean);
}

async function getTickerDirectory() {
  return withCache(
    "ticker-directory",
    TICKER_DIRECTORY_TTL_MS,
    async () => {
      const payload =
        await providerGet(
          "/company/facts/tickers/",
        );

      return normalizeTickerDirectory(
        payload,
      );
    },
  );
}

async function searchTickers(
  queryValue: unknown,
  limitValue: unknown,
) {
  const query =
    normalizeText(
      queryValue,
    ).toUpperCase();

  const limit =
    Math.min(
      Math.max(
        Math.floor(
          finiteNumber(
            limitValue,
          ) ?? 8,
        ),
        1,
      ),
      25,
    );

  if (!query) {
    return {
      count: 0,
      results: [],
      result: [],
    };
  }

  // Exact ticker lookup gives us a company name and exchange
  // even if the ticker-directory endpoint only returns strings.
  try {
    const exact =
      await getProfile(
        query,
      );

    if (
      normalizeTicker(
        exact?.ticker,
      ) === query
    ) {
      const results = [
        {
          ticker: query,
          symbol: query,
          displaySymbol:
            query,
          name:
            exact.name ||
            query,
          description:
            exact.name ||
            query,
          exchange:
            exact.exchange ||
            "",
        },
      ];

      return {
        count:
          results.length,
        results,
        result: results,
      };
    }
  } catch {
    // Continue to partial ticker matching.
  }

  const directory =
    await getTickerDirectory();

  const startsWith =
    directory.filter(
      (item: any) =>
        item.ticker
          .toUpperCase()
          .startsWith(query),
    );

  const contains =
    directory.filter(
      (item: any) =>
        !item.ticker
          .toUpperCase()
          .startsWith(query) &&
        (
          item.ticker
            .toUpperCase()
            .includes(query) ||
          item.name
            .toUpperCase()
            .includes(query)
        ),
    );

  const results = [
    ...startsWith,
    ...contains,
  ]
    .slice(0, limit)
    .map(
      (item: any) => ({
        ticker:
          item.ticker,
        symbol:
          item.ticker,
        displaySymbol:
          item.ticker,
        name:
          item.name ||
          item.ticker,
        description:
          item.name ||
          item.ticker,
        exchange:
          item.exchange ||
          "",
      }),
    );

  return {
    count: results.length,
    results,
    result: results,
  };
}

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            CORS_HEADERS,
        },
      );
    }

    if (
      request.method !== "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const body =
        await request
          .json()
          .catch(() => ({}));

      const requestBody =
        body &&
        typeof body === "object"
          ? body as Record<
              string,
              unknown
            >
          : {};

      const action =
        normalizeText(
          requestBody.action,
        ).toLowerCase();

      const ticker =
        normalizeTicker(
          requestBody.ticker,
        );

      switch (action) {
        case "quote": {
          if (!ticker) {
            return jsonResponse(
              {
                error:
                  "Ticker is required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getQuote(
              ticker,
            ),
          );
        }

        case "quotes": {
          const tickers =
            normalizeTickers(
              requestBody.tickers,
            );

          if (!tickers.length) {
            return jsonResponse(
              {
                error:
                  "Tickers are required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getQuotes(
              tickers,
            ),
          );
        }

        case "profile": {
          if (!ticker) {
            return jsonResponse(
              {
                error:
                  "Ticker is required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getProfile(
              ticker,
            ),
          );
        }

        case "news": {
          if (!ticker) {
            return jsonResponse(
              {
                error:
                  "Ticker is required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getNews(
              ticker,
              Math.floor(
                finiteNumber(
                  requestBody.limit,
                ) ?? 10,
              ),
            ),
          );
        }

        case "candles":
        case "candles_range": {
          if (!ticker) {
            return jsonResponse(
              {
                error:
                  "Ticker is required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getCandles(
              requestBody,
            ),
          );
        }

        case "metrics":
        case "basic_financials": {
          if (!ticker) {
            return jsonResponse(
              {
                error:
                  "Ticker is required.",
              },
              400,
            );
          }

          return jsonResponse(
            await getMetrics(
              ticker,
            ),
          );
        }

        case "search": {
          return jsonResponse(
            await searchTickers(
              requestBody.query ??
                requestBody.q ??
                requestBody.ticker,
              requestBody.limit,
            ),
          );
        }

        default:
          return jsonResponse(
            {
              error:
                "Unsupported action. Use quote, quotes, profile, news, candles, candles_range, metrics, basic_financials, or search.",
            },
            400,
          );
      }
    } catch (error) {
      console.error(
        "Financial Datasets Edge Function error:",
        error,
      );

      if (
        error instanceof
          ProviderError
      ) {
        return jsonResponse(
          {
            error:
              error.message,
            provider_status:
              error.status,
          },
          error.status,
        );
      }

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
  },
);
