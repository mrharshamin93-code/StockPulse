import { supabase } from "@/lib/supabase";

const DAY_SECONDS = 86400;

function finiteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""import { supabase } from "@/lib/supabase";

const DAY_SECONDS = 86400;
const INTRADAY_TABLE = "stock_intraday_snapshots";

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

  if (rows.length < 2) {
    return null;
  }

  const latestSessionDate =
    rows[rows.length - 1].session.sessionDate;

  const latestSessionRows = rows.filter(
    (row) =>
      row.session.sessionDate === latestSessionDate,
  );

  if (latestSessionRows.length < 2) {
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
   * Financial Datasets' financial-metrics snapshot does not always
   * include dividend_yield directly. When payout ratio and trailing
   * P/E are both available, dividend yield can be derived exactly:
   *
   * payout ratio = dividends per share / EPS
   * P/E          = price / EPS
   * yield        = dividends per share / price
   *
   * therefore:
   * yield = payout ratio / P/E
   */
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

  /*
   * Do not manufacture Forward P/E.
   * It requires forward/consensus earnings estimates.
   * We only normalize it when the provider actually returns one.
   */
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

function normalizeCandleRequest(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !["candles", "candles_range"].includes(body.action)
  ) {
    return body;
  }

  const period = String(body.period || "").toUpperCase();

  /*
   * Financial Datasets historical price bars are EOD (daily+).
   * StockDetail previously requested 5-minute and 60-minute bars for
   * 1D/1W, which the backend downgraded to daily. A 1-day request could
   * therefore contain only one candle and StockDetail would render
   * "Chart unavailable".
   *
   * Request enough daily history to guarantee usable EOD points.
   */
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

  return body;
}

function normalizeCandlePayload(data, originalBody) {
  if (
    !data ||
    typeof data !== "object" ||
    !["candles", "candles_range"].includes(originalBody?.action)
  ) {
    return data;
  }

  const period = String(originalBody?.period || "").toUpperCase();

  if (!["1D", "1W"].includes(period)) {
    return data;
  }

  const source = Array.isArray(data.candles)
    ? data.candles
    : Array.isArray(data.prices)
      ? data.prices
      : [];

  const candles = source
    .filter((item) => {
      const timestamp = finiteNumber(item?.t);
      const close = finiteNumber(item?.c);

      return timestamp !== null && close !== null;
    })
    .sort(
      (left, right) =>
        Number(left.t) - Number(right.t),
    );

  if (!candles.length) {
    return data;
  }

  let selected = candles;

  if (period === "1D") {
    /*
     * EOD provider: use the latest two trading closes.
     * This is a genuine one-trading-day close-to-close chart rather
     * than pretending daily data is intraday data.
     */
    selected = candles.slice(-2);
  } else {
    const newestTimestamp = Number(
      candles[candles.length - 1]?.t,
    );

    const oneWeekAgo =
      newestTimestamp - 7 * DAY_SECONDS;

    selected = candles.filter(
      (item) =>
        Number(item.t) >= oneWeekAgo,
    );

    if (selected.length < 2) {
      selected = candles.slice(-5);
    }
  }

  return {
    ...data,
    candles: selected,
    prices: selected,
    t: selected.map((item) => item.t),
    o: selected.map((item) => item.o),
    h: selected.map((item) => item.h),
    l: selected.map((item) => item.l),
    c: selected.map((item) => item.c),
    v: selected.map((item) => item.v),
  };
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

  const { data, error } = await supabase.functions.invoke(
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
    throw new Error(data.error);
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
