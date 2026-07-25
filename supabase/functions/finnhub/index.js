const FINNHUB_API_KEY =
  Deno.env.get("FINNHUB_API_KEY");

const FINNHUB_BASE_URL =
  "https://finnhub.io/api/v1";

const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const cache =
  new Map<
    string,
    {
      value: unknown;
      expiresAt: number;
    }
  >();

const inFlight =
  new Map<
    string,
    Promise<unknown>
  >();

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

function getCached(
  key: string,
) {
  const entry =
    cache.get(key);

  if (!entry) {
    return null;
  }

  if (
    Date.now() >=
    entry.expiresAt
  ) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached(
  key: string,
  value: unknown,
  ttlMs: number,
) {
  cache.set(key, {
    value,
    expiresAt:
      Date.now() + ttlMs,
  });
}

async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached =
    getCached(key);

  if (cached !== null) {
    return cached as T;
  }

  const existing =
    inFlight.get(key);

  if (existing) {
    return existing as Promise<T>;
  }

  const promise =
    (async () => {
      try {
        const value =
          await fetcher();

        setCached(
          key,
          value,
          ttlMs,
        );

        return value;
      } finally {
        inFlight.delete(
          key,
        );
      }
    })();

  inFlight.set(
    key,
    promise,
  );

  return promise;
}

function requireFinnhubKey() {
  if (!FINNHUB_API_KEY) {
    throw new Error(
      "Missing FINNHUB_API_KEY",
    );
  }
}

async function finnhubGet(
  path: string,
  params:
    Record<
      string,
      string | number | undefined
    > = {},
  retries = 2,
) {
  requireFinnhubKey();

  const url =
    new URL(
      `${FINNHUB_BASE_URL}${path}`,
    );

  url.searchParams.set(
    "token",
    FINNHUB_API_KEY!,
  );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      params,
    )
  ) {
    if (
      value !== undefined &&
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
    );

  if (
    response.status ===
      429 &&
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
    const text =
      await response
        .text()
        .catch(
          () => "",
        );

    throw new Error(
      `Finnhub error: ${response.status} ${response.statusText} - ${text}`,
    );
  }

  return response.json();
}

function normalizeTicker(
  value: unknown,
) {
  return String(
    value || "",
  )
    .trim()
    .toUpperCase();
}

function normalizeTickers(
  value: unknown,
) {
  if (
    Array.isArray(
      value,
    )
  ) {
    return [
      ...new Set(
        value
          .map(
            normalizeTicker,
          )
          .filter(Boolean),
      ),
    ];
  }

  if (
    typeof value ===
    "string"
  ) {
    return [
      ...new Set(
        value
          .split(",")
          .map(
            normalizeTicker,
          )
          .filter(Boolean),
      ),
    ];
  }

  return [];
}

function numberOrNull(
  value: unknown,
) {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function mapQuoteData(
  ticker: string,
  data: Record<
    string,
    unknown
  >,
) {
  return {
    ticker,

    c:
      numberOrNull(
        data?.c,
      ),

    d:
      numberOrNull(
        data?.d,
      ),

    dp:
      numberOrNull(
        data?.dp,
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

    pc:
      numberOrNull(
        data?.pc,
      ),

    t:
      numberOrNull(
        data?.t,
      ),
  };
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

async function getQuote(
  ticker: string,
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

async function getQuotes(
  tickers: string[],
) {
  const quotes =
    await Promise.all(
      tickers.map(
        async (
          ticker,
        ) => {
          try {
            return await getQuote(
              ticker,
            );
          } catch (
            error
          ) {
            return emptyQuote(
              ticker,
              error instanceof Error
                ? error.message
                : "Failed to fetch quote",
            );
          }
        },
      ),
    );

  return {
    quotes,
  };
}

async function handleProfile(
  ticker: string,
) {
  return withCache(
    `profile:${ticker}`,
    24 *
      60 *
      60 *
      1000,

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
          data?.exchange ||
          null,

        name:
          data?.name ||
          null,

        ticker:
          data?.ticker ||
          ticker,

        finnhubIndustry:
          data?.finnhubIndustry ||
          null,

        logo:
          data?.logo ||
          null,

        weburl:
          data?.weburl ||
          null,

        marketCapitalization:
          data?.marketCapitalization ||
          null,

        currency:
          data?.currency ||
          null,

        country:
          data?.country ||
          null,
      };
    },
  );
}

async function handleSearch(
  query: string,
) {
  const normalized =
    query.trim();

  return withCache(
    `search:${normalized.toUpperCase()}`,
    5 * 60 * 1000,

    async () => {
      const data =
        await finnhubGet(
          "/search",
          {
            q:
              normalized,
          },
        );

      const results =
        (
          data?.result ||
          []
        )
          .filter(
            (
              item:
                Record<
                  string,
                  unknown
                >,
            ) => {
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
                Boolean(
                  symbol,
                ) &&
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
                  type ===
                    ""
                )
              );
            },
          )
          .slice(
            0,
            8,
          )
          .map(
            (
              item:
                Record<
                  string,
                  unknown
                >,
            ) => {
              const ticker =
                normalizeTicker(
                  item?.symbol,
                );

              const name =
                String(
                  item?.description ||
                    item?.displaySymbol ||
                    item?.symbol ||
                    "",
                ).trim();

              const exchange =
                String(
                  item?.primaryExchange ||
                    item?.exchange ||
                    "",
                ).trim();

              return {
                ticker,
                name,
                exchange,

                symbol:
                  ticker,

                description:
                  name,

                primaryExchange:
                  exchange,
              };
            },
          )
          .filter(
            (
              item:
                Record<
                  string,
                  unknown
                >,
            ) =>
              Boolean(
                item.ticker,
              ),
          );

      return {
        results,
        result:
          results,
      };
    },
  );
}

async function handleNews(
  ticker: string,
) {
  return withCache(
    `news:${ticker}`,
    10 * 60 * 1000,

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
        news,
        profile,
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
          profile?.name ||
            "",
        ).toLowerCase();

      const tickerLower =
        ticker.toLowerCase();

      const all =
        (
          Array.isArray(
            news,
          )
            ? news
            : []
        ).sort(
          (
            a,
            b,
          ) =>
            Number(
              b?.datetime ||
                0,
            ) -
            Number(
              a?.datetime ||
                0,
            ),
        );

      const relevant =
        all.filter(
          (article) => {
            const text =
              `${
                article?.headline ||
                ""
              } ${
                article?.summary ||
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

      const pool =
        relevant.length >= 3
          ? relevant
          : all;

      const sourceCounts:
        Record<
          string,
          number
        > = {};

      const articles:
        Array<
          Record<
            string,
            unknown
          >
        > = [];

      for (
        const article of
        pool
      ) {
        const source =
          String(
            article?.source ||
              "",
          ).toLowerCase();

        sourceCounts[
          source
        ] =
          (
            sourceCounts[
              source
            ] ||
            0
          ) + 1;

        if (
          sourceCounts[
            source
          ] <= 2
        ) {
          articles.push({
            title:
              article?.headline,

            summary:
              article?.summary,

            url:
              article?.url,

            source:
              article?.source,

            date:
              article?.datetime
                ? new Date(
                    Number(
                      article.datetime,
                    ) *
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

function normalizePeriod(
  value: unknown,
) {
  const period =
    String(
      value || "",
    )
      .trim()
      .toUpperCase();

  const periods:
    Record<
      string,
      string
    > = {
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
      period
    ] || ""
  );
}

function getPeriodStart(
  period: string,
  fromTs: number,
  toTs: number,
) {
  const date =
    new Date(
      toTs * 1000,
    );

  switch (
    period
  ) {
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
      date.setUTCMonth(
        date.getUTCMonth() -
          1,
      );
      break;

    case "3M":
      date.setUTCMonth(
        date.getUTCMonth() -
          3,
      );
      break;

    case "6M":
      date.setUTCMonth(
        date.getUTCMonth() -
          6,
      );
      break;

    case "YTD":
      return Math.floor(
        Date.UTC(
          date.getUTCFullYear(),
          0,
          1,
        ) / 1000,
      );

    case "1Y":
      date.setUTCFullYear(
        date.getUTCFullYear() -
          1,
      );
      break;

    case "2Y":
      date.setUTCFullYear(
        date.getUTCFullYear() -
          2,
      );
      break;

    case "5Y":
      date.setUTCFullYear(
        date.getUTCFullYear() -
          5,
      );
      break;

    case "10Y":
      date.setUTCFullYear(
        date.getUTCFullYear() -
          10,
      );
      break;

    case "All":
      return 1;

    default:
      return fromTs;
  }

  return Math.floor(
    date.getTime() /
      1000,
  );
}

function getSourceInterval(
  period: string,
) {
  return period ===
    "1D"
    ? "5m"
    : "1d";
}

function getResponseInterval(
  period: string,
  resolution: string,
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
      resolution ||
        "",
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

async function fetchYahooHistory(
  ticker: string,
  fromTs: number,
  toTs: number,
  interval: string,
) {
  const symbol =
    encodeURIComponent(
      ticker,
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
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0",
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `Yahoo chart request failed: ${response.status}`,
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
    return [];
  }

  const timestamps =
    result.timestamp ||
    [];

  const quote =
    result.indicators
      ?.quote?.[0] ||
    {};

  return timestamps
    .map(
      (
        timestamp:
          number,
        index:
          number,
      ) => {
        const close =
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

          c:
            close,

          o:
            numberOrNull(
              quote.open?.[
                index
              ],
            ),

          h:
            numberOrNull(
              quote.high?.[
                index
              ],
            ),

          l:
            numberOrNull(
              quote.low?.[
                index
              ],
            ),

          volume:
            numberOrNull(
              quote.volume?.[
                index
              ],
            ),
        };
      },
    )
    .filter(Boolean);
}

async function getPeriodCandles({
  ticker,
  resolution,
  fromTs,
  toTs,
  requestedPeriod,
}: {
  ticker: string;
  resolution: string;
  fromTs: number;
  toTs: number;
  requestedPeriod?: string;
}) {
  const period =
    normalizePeriod(
      requestedPeriod,
    ) ||
    "1Y";

  const targetStart =
    getPeriodStart(
      period,
      fromTs,
      toTs,
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

  const cacheKey =
    [
      "candles",
      ticker,
      period,
      sourceInterval,
      Math.floor(
        targetStart,
      ),
      Math.floor(
        toTs / 300,
      ),
    ].join(":");

  const candles =
    await withCache(
      cacheKey,
      5 * 60 * 1000,

      () =>
        fetchYahooHistory(
          ticker,
          targetStart,
          toTs,
          sourceInterval,
        ),
    );

  const quote =
    await getQuote(
      ticker,
    );

  const latestPrice =
    Number(
      quote?.c,
    );

  const nextCandles =
    Array.isArray(
      candles,
    )
      ? [...candles]
      : [];

  if (
    Number.isFinite(
      latestPrice,
    ) &&
    latestPrice > 0
  ) {
    nextCandles.push({
      t:
        numberOrNull(
          quote?.t,
        ) ||
        toTs,

      v:
        latestPrice,

      c:
        latestPrice,

      o:
        numberOrNull(
          quote?.o,
        ) ||
        latestPrice,

      h:
        numberOrNull(
          quote?.h,
        ) ||
        latestPrice,

      l:
        numberOrNull(
          quote?.l,
        ) ||
        latestPrice,

      volume:
        null,
    });
  }

  nextCandles.sort(
    (
      a,
      b,
    ) =>
      Number(
        a?.t ||
          0,
      ) -
      Number(
        b?.t ||
          0,
      ),
  );

  return {
    candles:
      nextCandles,

    interval:
      responseInterval,

    sourceInterval,

    period,

    priceAdjustment:
      "splits-only",

    currentPrice:
      numberOrNull(
        quote?.c,
      ),

    previousClose:
      numberOrNull(
        quote?.pc,
      ),
  };
}

Deno.serve(
  async (
    request,
  ) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          error:
            "Method not allowed",
        },
        405,
      );
    }

    try {
      const body =
        await request
          .json()
          .catch(
            () => ({}),
          );

      const action =
        String(
          body?.action ||
            "",
        );

      const ticker =
        normalizeTicker(
          body?.ticker,
        );

      const tickers =
        normalizeTickers(
          body?.tickers,
        );

      if (
        action ===
        "quote"
      ) {
        if (!ticker) {
          return jsonResponse(
            {
              error:
                "Missing ticker",
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

      if (
        action ===
        "quotes"
      ) {
        if (
          !tickers.length
        ) {
          return jsonResponse(
            {
              error:
                "Missing tickers",
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

      if (
        action ===
        "profile"
      ) {
        if (!ticker) {
          return jsonResponse(
            {
              error:
                "Missing ticker",
            },
            400,
          );
        }

        return jsonResponse(
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
          String(
            body?.query ||
              body?.q ||
              ticker ||
              "",
          ).trim();

        if (!query) {
          return jsonResponse(
            {
              error:
                "Missing query",
            },
            400,
          );
        }

        return jsonResponse(
          await handleSearch(
            query,
          ),
        );
      }

      if (
        action ===
        "news"
      ) {
        if (!ticker) {
          return jsonResponse(
            {
              error:
                "Missing ticker",
            },
            400,
          );
        }

        return jsonResponse(
          await handleNews(
            ticker,
          ),
        );
      }

      if (
        action ===
        "candles"
      ) {
        if (!ticker) {
          return jsonResponse(
            {
              error:
                "Missing ticker",
            },
            400,
          );
        }

        const toTs =
          Math.floor(
            Date.now() /
              1000,
          );

        const fromTs =
          toTs -
          365 * 86400;

        return jsonResponse(
          await getPeriodCandles({
            ticker,

            resolution:
              String(
                body?.resolution ||
                  "D",
              ),

            fromTs,

            toTs,

            requestedPeriod:
              String(
                body?.period ||
                  "1Y",
              ),
          }),
        );
      }

      if (
        action ===
        "candles_range"
      ) {
        if (!ticker) {
          return jsonResponse(
            {
              error:
                "Missing ticker",
            },
            400,
          );
        }

        const now =
          Math.floor(
            Date.now() /
              1000,
          );

        const toTs =
          Number.isFinite(
            Number(
              body?.to,
            ),
          )
            ? Number(
                body.to,
              )
            : now;

        const fromTs =
          Number.isFinite(
            Number(
              body?.from,
            ),
          )
            ? Number(
                body.from,
              )
            : toTs -
              30 *
                86400;

        if (
          fromTs >=
          toTs
        ) {
          return jsonResponse(
            {
              error:
                "`from` must be earlier than `to`",
            },
            400,
          );
        }

        return jsonResponse(
          await getPeriodCandles({
            ticker,

            resolution:
              String(
                body?.resolution ||
                  "D",
              ),

            fromTs,

            toTs,

            requestedPeriod:
              body?.period
                ? String(
                    body.period,
                  )
                : undefined,
          }),
        );
      }

      return jsonResponse(
        {
          error:
            "Unknown action",
        },
        400,
      );
    } catch (error) {
      console.error(
        "Finnhub Edge Function error:",
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Internal server error",
        },
        500,
      );
    }
  },
);
