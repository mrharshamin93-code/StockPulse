import { supabase } from "@/lib/supabase";

const DAY_SECONDS = 86400;

function finiteNumber(value) {
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

function firstFinite(...values) {
  for (const value of values) {
    const parsed = finiteNumber(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
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

  const snapshot = {
    ...rawSnapshot,
  };

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

  /*
   * Financial Datasets does not always return dividend yield directly.
   *
   * payout ratio = dividend per share / EPS
   * P/E          = price / EPS
   *
   * Therefore:
   * dividend yield = payout ratio / P/E
   */
  if (
    dividendYield === null &&
    payoutRatio !== null &&
    payoutRatio >= 0 &&
    pe !== null &&
    pe > 0
  ) {
    dividendYield =
      payoutRatio / pe;
  }

  if (marketCap !== null) {
    snapshot.market_cap =
      marketCap;

    snapshot.marketCap =
      marketCap;
  }

  if (pe !== null) {
    snapshot.price_to_earnings_ratio =
      pe;

    snapshot.pe_ratio =
      pe;
  }

  if (priceToSales !== null) {
    snapshot.price_to_sales_ratio =
      priceToSales;

    snapshot.price_sales_ratio =
      priceToSales;
  }

  /*
   * Forward P/E is only populated when the provider
   * actually returns forward earnings data.
   */
  if (forwardPe !== null) {
    snapshot.forward_price_to_earnings_ratio =
      forwardPe;

    snapshot.forward_pe_ratio =
      forwardPe;

    snapshot.forward_pe =
      forwardPe;

    snapshot.forwardPE =
      forwardPe;
  }

  if (dividendYield !== null) {
    snapshot.dividend_yield =
      dividendYield;
  }

  return {
    ...data,
    snapshot,
    metrics: snapshot,
  };
}

function normalizeCandleRequest(body) {
  if (
    !body ||
    typeof body !== "object" ||
    ![
      "candles",
      "candles_range",
    ].includes(body.action)
  ) {
    return body;
  }

  const period = String(
    body.period || "",
  ).toUpperCase();

  /*
   * Financial Datasets historical price bars are EOD.
   *
   * StockDetail previously requested:
   *
   * 1D -> 5 minute
   * 1W -> 60 minute
   *
   * The backend converts those unsupported resolutions
   * into daily candles.
   *
   * For 1D, requesting only one calendar day can therefore
   * return just one candle, while StockDetail requires at
   * least two points.
   */

  if (period === "1D") {
    const to =
      finiteNumber(body.to) ??
      Math.floor(
        Date.now() / 1000,
      );

    return {
      ...body,

      resolution: "D",

      to,

      /*
       * Seven calendar days gives enough room for
       * weekends and market holidays.
       */
      from:
        to -
        7 * DAY_SECONDS,
    };
  }

  if (period === "1W") {
    const to =
      finiteNumber(body.to) ??
      Math.floor(
        Date.now() / 1000,
      );

    return {
      ...body,

      resolution: "D",

      to,

      /*
       * Fetch two calendar weeks so we reliably have
       * approximately one trading week of EOD candles.
       */
      from:
        to -
        14 * DAY_SECONDS,
    };
  }

  return body;
}

function normalizeCandlePayload(
  data,
  originalBody,
) {
  if (
    !data ||
    typeof data !== "object" ||
    ![
      "candles",
      "candles_range",
    ].includes(
      originalBody?.action,
    )
  ) {
    return data;
  }

  const period = String(
    originalBody?.period || "",
  ).toUpperCase();

  if (
    ![
      "1D",
      "1W",
    ].includes(period)
  ) {
    return data;
  }

  const source =
    Array.isArray(data.candles)
      ? data.candles
      : Array.isArray(data.prices)
        ? data.prices
        : [];

  const candles = source
    .filter((item) => {
      const timestamp =
        finiteNumber(item?.t);

      const close =
        finiteNumber(item?.c);

      return (
        timestamp !== null &&
        close !== null
      );
    })
    .sort(
      (left, right) =>
        Number(left.t) -
        Number(right.t),
    );

  if (!candles.length) {
    return data;
  }

  let selected = candles;

  if (period === "1D") {
    /*
     * Because the provider is EOD-only, the honest
     * representation of a 1D move is the latest two
     * trading closes.
     */
    selected =
      candles.slice(-2);
  }

  if (period === "1W") {
    const newestTimestamp =
      Number(
        candles[
          candles.length - 1
        ]?.t,
      );

    const oneWeekAgo =
      newestTimestamp -
      7 * DAY_SECONDS;

    selected =
      candles.filter(
        (item) =>
          Number(item.t) >=
          oneWeekAgo,
      );

    /*
     * Fallback for unusual holidays or sparse data.
     */
    if (selected.length < 2) {
      selected =
        candles.slice(-5);
    }
  }

  return {
    ...data,

    candles: selected,

    prices: selected,

    t: selected.map(
      (item) => item.t,
    ),

    o: selected.map(
      (item) => item.o,
    ),

    h: selected.map(
      (item) => item.h,
    ),

    l: selected.map(
      (item) => item.l,
    ),

    c: selected.map(
      (item) => item.c,
    ),

    v: selected.map(
      (item) => item.v,
    ),
  };
}

export async function financialDatasetsRequest(
  body,
) {
  const requestBody =
    normalizeCandleRequest(body);

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "financial-datasets",
      {
        body: requestBody,
      },
    );

  if (error) {
    console.error(
      "Financial Datasets Edge Function error:",
      error,
    );

    throw new Error(
      error.message ||
        "Market data request failed.",
    );
  }

  if (data?.error) {
    throw new Error(
      data.error,
    );
  }

  if (
    body?.action ===
    "metrics"
  ) {
    return normalizeMetricsPayload(
      data,
    );
  }

  if (
    body?.action ===
      "candles" ||
    body?.action ===
      "candles_range"
  ) {
    return normalizeCandlePayload(
      data,
      body,
    );
  }

  return data;
}

export async function getQuote(
  ticker,
) {
  return financialDatasetsRequest({
    action: "quote",
    ticker,
  });
}

export async function getQuotes(
  tickers,
) {
  return financialDatasetsRequest({
    action: "quotes",
    tickers,
  });
}

export async function getProfile(
  ticker,
) {
  return financialDatasetsRequest({
    action: "profile",
    ticker,
  });
}

export async function getNews(
  ticker,
) {
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

    ...(period
      ? {
          period,
        }
      : {}),
  });
}

export async function getMetrics(
  ticker,
) {
  return financialDatasetsRequest({
    action: "metrics",
    ticker,
  });
}
