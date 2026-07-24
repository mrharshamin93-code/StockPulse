import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const DEFAULT_QUOTE_STALE_MINUTES = 5;
const MAX_QUOTE_STALE_MINUTES = 60;
const QUOTE_CONCURRENCY = 4;
const QUOTE_TIMEOUT_MS = 10_000;

type UnknownRecord = Record<string, unknown>;

type ScreenerRow = {
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;

  price: number | null;
  change_amount: number | null;
  change_percent: number | null;
  open_price: number | null;
  day_high: number | null;
  day_low: number | null;
  previous_close: number | null;
  market_timestamp: string | null;
  quote_updated_at: string | null;

  market_cap_b: number | null;
  enterprise_value_b: number | null;
  pe: number | null;
  forward_pe: number | null;
  peg: number | null;
  pb: number | null;
  ps: number | null;
  ev_ebitda: number | null;
  pcf: number | null;
  pfcf: number | null;

  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;

  revenue_growth_yoy: number | null;
  eps_growth_yoy: number | null;
  ebitda_growth_yoy: number | null;
  fcf_growth_yoy: number | null;

  debt_to_equity: number | null;
  current_ratio: number | null;
  quick_ratio: number | null;
  interest_coverage: number | null;
  debt_to_ebitda: number | null;

  asset_turnover: number | null;
  inventory_turnover: number | null;
  receivables_turnover: number | null;
  days_sales_outstanding: number | null;

  dividend_yield: number | null;
  payout_ratio: number | null;
  dividend_growth_5y: number | null;

  eps_ttm: number | null;
  book_value_per_share: number | null;
  fcf_per_share: number | null;

  rsi_14: number | null;
  high_52_week: number | null;
  low_52_week: number | null;
  week_52_change: number | null;
  average_volume_30d: number | null;
  return_1_week: number | null;
  return_1_month: number | null;
  return_3_month: number | null;
  volatility_30d: number | null;
  sma_20: number | null;
  sma_50: number | null;
  price_above_sma_20: boolean | null;
  sma_20_above_sma_50: boolean | null;
  bullish_ma_crossover_at: string | null;
  bullish_ma_crossover_days_ago: number | null;
  relative_volume: number | null;

  fundamentals_updated_at: string | null;
  technicals_updated_at: string | null;
};

type QuoteUpdate = {
  symbol: string;
  ok: boolean;
  error: string | null;
  values: Partial<ScreenerRow>;
};

const selectColumns = [
  "symbol",
  "company_name",
  "exchange",
  "sector",
  "industry",
  "price",
  "change_amount",
  "change_percent",
  "open_price",
  "day_high",
  "day_low",
  "previous_close",
  "market_timestamp",
  "quote_updated_at",
  "market_cap_b",
  "enterprise_value_b",
  "pe",
  "forward_pe",
  "peg",
  "pb",
  "ps",
  "ev_ebitda",
  "pcf",
  "pfcf",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "roe",
  "roa",
  "roic",
  "revenue_growth_yoy",
  "eps_growth_yoy",
  "ebitda_growth_yoy",
  "fcf_growth_yoy",
  "debt_to_equity",
  "current_ratio",
  "quick_ratio",
  "interest_coverage",
  "debt_to_ebitda",
  "asset_turnover",
  "inventory_turnover",
  "receivables_turnover",
  "days_sales_outstanding",
  "dividend_yield",
  "payout_ratio",
  "dividend_growth_5y",
  "eps_ttm",
  "book_value_per_share",
  "fcf_per_share",
  "rsi_14",
  "high_52_week",
  "low_52_week",
  "week_52_change",
  "average_volume_30d",
  "return_1_week",
  "return_1_month",
  "return_3_month",
  "volatility_30d",
  "sma_20",
  "sma_50",
  "price_above_sma_20",
  "sma_20_above_sma_50",
  "bullish_ma_crossover_at",
  "bullish_ma_crossover_days_ago",
  "relative_volume",
  "fundamentals_updated_at",
  "technicals_updated_at",
].join(",");

const filterMap: Record<
  string,
  {
    column: string;
    operator: "gte" | "lte";
  }
> = {
  minPrice: {
    column: "price",
    operator: "gte",
  },
  maxPrice: {
    column: "price",
    operator: "lte",
  },
  minChangePercent: {
    column: "change_percent",
    operator: "gte",
  },
  maxChangePercent: {
    column: "change_percent",
    operator: "lte",
  },
  minRsi: {
    column: "rsi_14",
    operator: "gte",
  },
  maxRsi: {
    column: "rsi_14",
    operator: "lte",
  },
  minReturn1Week: {
    column: "return_1_week",
    operator: "gte",
  },
  maxReturn1Week: {
    column: "return_1_week",
    operator: "lte",
  },
  minReturn1Month: {
    column: "return_1_month",
    operator: "gte",
  },
  maxReturn1Month: {
    column: "return_1_month",
    operator: "lte",
  },
  minReturn3Month: {
    column: "return_3_month",
    operator: "gte",
  },
  maxReturn3Month: {
    column: "return_3_month",
    operator: "lte",
  },
  minRelativeVolume: {
    column: "relative_volume",
    operator: "gte",
  },
  maxRelativeVolume: {
    column: "relative_volume",
    operator: "lte",
  },
  minBullishMaCrossoverDays: {
    column: "bullish_ma_crossover_days_ago",
    operator: "gte",
  },
  maxBullishMaCrossoverDays: {
    column: "bullish_ma_crossover_days_ago",
    operator: "lte",
  },

  minPe: {
    column: "pe",
    operator: "gte",
  },
  maxPe: {
    column: "pe",
    operator: "lte",
  },
  minForwardPe: {
    column: "forward_pe",
    operator: "gte",
  },
  maxForwardPe: {
    column: "forward_pe",
    operator: "lte",
  },
  minPeg: {
    column: "peg",
    operator: "gte",
  },
  maxPeg: {
    column: "peg",
    operator: "lte",
  },
  minPb: {
    column: "pb",
    operator: "gte",
  },
  maxPb: {
    column: "pb",
    operator: "lte",
  },
  minPs: {
    column: "ps",
    operator: "gte",
  },
  maxPs: {
    column: "ps",
    operator: "lte",
  },
  minEvEbitda: {
    column: "ev_ebitda",
    operator: "gte",
  },
  maxEvEbitda: {
    column: "ev_ebitda",
    operator: "lte",
  },
  minPcf: {
    column: "pcf",
    operator: "gte",
  },
  maxPcf: {
    column: "pcf",
    operator: "lte",
  },
  minPfcf: {
    column: "pfcf",
    operator: "gte",
  },
  maxPfcf: {
    column: "pfcf",
    operator: "lte",
  },

  minGrossMargin: {
    column: "gross_margin",
    operator: "gte",
  },
  maxGrossMargin: {
    column: "gross_margin",
    operator: "lte",
  },
  minOperatingMargin: {
    column: "operating_margin",
    operator: "gte",
  },
  maxOperatingMargin: {
    column: "operating_margin",
    operator: "lte",
  },
  minNetMargin: {
    column: "net_margin",
    operator: "gte",
  },
  maxNetMargin: {
    column: "net_margin",
    operator: "lte",
  },
  minRoe: {
    column: "roe",
    operator: "gte",
  },
  maxRoe: {
    column: "roe",
    operator: "lte",
  },
  minRoa: {
    column: "roa",
    operator: "gte",
  },
  maxRoa: {
    column: "roa",
    operator: "lte",
  },
  minRoic: {
    column: "roic",
    operator: "gte",
  },
  maxRoic: {
    column: "roic",
    operator: "lte",
  },

  minRevenueGrowth: {
    column: "revenue_growth_yoy",
    operator: "gte",
  },
  maxRevenueGrowth: {
    column: "revenue_growth_yoy",
    operator: "lte",
  },
  minEpsGrowth: {
    column: "eps_growth_yoy",
    operator: "gte",
  },
  maxEpsGrowth: {
    column: "eps_growth_yoy",
    operator: "lte",
  },
  minEbitdaGrowth: {
    column: "ebitda_growth_yoy",
    operator: "gte",
  },
  maxEbitdaGrowth: {
    column: "ebitda_growth_yoy",
    operator: "lte",
  },
  minFcfGrowth: {
    column: "fcf_growth_yoy",
    operator: "gte",
  },
  maxFcfGrowth: {
    column: "fcf_growth_yoy",
    operator: "lte",
  },
  minWeek52Change: {
    column: "week_52_change",
    operator: "gte",
  },
  maxWeek52Change: {
    column: "week_52_change",
    operator: "lte",
  },

  minDe: {
    column: "debt_to_equity",
    operator: "gte",
  },
  maxDe: {
    column: "debt_to_equity",
    operator: "lte",
  },
  minCurrentRatio: {
    column: "current_ratio",
    operator: "gte",
  },
  maxCurrentRatio: {
    column: "current_ratio",
    operator: "lte",
  },
  minQuickRatio: {
    column: "quick_ratio",
    operator: "gte",
  },
  maxQuickRatio: {
    column: "quick_ratio",
    operator: "lte",
  },
  minInterestCoverage: {
    column: "interest_coverage",
    operator: "gte",
  },
  maxInterestCoverage: {
    column: "interest_coverage",
    operator: "lte",
  },
  minDebtEbitda: {
    column: "debt_to_ebitda",
    operator: "gte",
  },
  maxDebtEbitda: {
    column: "debt_to_ebitda",
    operator: "lte",
  },

  minAssetTurnover: {
    column: "asset_turnover",
    operator: "gte",
  },
  maxAssetTurnover: {
    column: "asset_turnover",
    operator: "lte",
  },
  minInventoryTurnover: {
    column: "inventory_turnover",
    operator: "gte",
  },
  maxInventoryTurnover: {
    column: "inventory_turnover",
    operator: "lte",
  },
  minReceivablesTurnover: {
    column: "receivables_turnover",
    operator: "gte",
  },
  maxReceivablesTurnover: {
    column: "receivables_turnover",
    operator: "lte",
  },
  minDso: {
    column: "days_sales_outstanding",
    operator: "gte",
  },
  maxDso: {
    column: "days_sales_outstanding",
    operator: "lte",
  },

  minDividendYield: {
    column: "dividend_yield",
    operator: "gte",
  },
  maxDividendYield: {
    column: "dividend_yield",
    operator: "lte",
  },
  minPayoutRatio: {
    column: "payout_ratio",
    operator: "gte",
  },
  maxPayoutRatio: {
    column: "payout_ratio",
    operator: "lte",
  },
  minDividendGrowth: {
    column: "dividend_growth_5y",
    operator: "gte",
  },
  maxDividendGrowth: {
    column: "dividend_growth_5y",
    operator: "lte",
  },

  minMarketCapB: {
    column: "market_cap_b",
    operator: "gte",
  },
  maxMarketCapB: {
    column: "market_cap_b",
    operator: "lte",
  },
  minMarketCap: {
    column: "market_cap_b",
    operator: "gte",
  },
  maxMarketCap: {
    column: "market_cap_b",
    operator: "lte",
  },
  minEps: {
    column: "eps_ttm",
    operator: "gte",
  },
  maxEps: {
    column: "eps_ttm",
    operator: "lte",
  },
  minBookValue: {
    column: "book_value_per_share",
    operator: "gte",
  },
  maxBookValue: {
    column: "book_value_per_share",
    operator: "lte",
  },
  minFcfPerShare: {
    column: "fcf_per_share",
    operator: "gte",
  },
  maxFcfPerShare: {
    column: "fcf_per_share",
    operator: "lte",
  },
};

const sortMap: Record<string, string> = {
  ticker: "symbol",
  symbol: "symbol",
  name: "company_name",
  companyName: "company_name",
  marketCapB: "market_cap_b",
  market_cap_b: "market_cap_b",
  price: "price",
  changePercent: "change_percent",
  change_percent: "change_percent",
  week52Change: "week_52_change",
  week_52_change: "week_52_change",
  pe: "pe",
  forwardPe: "forward_pe",
  peg: "peg",
  pb: "pb",
  ps: "ps",
  dividendYield: "dividend_yield",
  dividend_yield: "dividend_yield",
  roe: "roe",
  revenueGrowth: "revenue_growth_yoy",
  revenue_growth_yoy: "revenue_growth_yoy",
  epsGrowth: "eps_growth_yoy",
  eps_growth_yoy: "eps_growth_yoy",
  rsi: "rsi_14",
  rsi_14: "rsi_14",
  return1Week: "return_1_week",
  return_1_week: "return_1_week",
  return1Month: "return_1_month",
  return_1_month: "return_1_month",
  return3Month: "return_3_month",
  return_3_month: "return_3_month",
  relativeVolume: "relative_volume",
  relative_volume: "relative_volume",
  bullishMaCrossoverDays: "bullish_ma_crossover_days_ago",
  bullish_ma_crossover_days_ago:
    "bullish_ma_crossover_days_ago",
};

const ascendingByDefault =
  new Set([
    "symbol",
    "company_name",
    "pe",
    "forward_pe",
    "peg",
    "pb",
    "ps",
    "debt_to_equity",
    "debt_to_ebitda",
    "days_sales_outstanding",
  ]);

const quoteFilterKeys =
  new Set([
    "minPrice",
    "maxPrice",
    "minChangePercent",
    "maxChangePercent",
  ]);

const technicalFilterKeys =
  new Set([
    "minRsi",
    "maxRsi",
    "minReturn1Week",
    "maxReturn1Week",
    "minReturn1Month",
    "maxReturn1Month",
    "minReturn3Month",
    "maxReturn3Month",
    "minRelativeVolume",
    "maxRelativeVolume",
    "minBullishMaCrossoverDays",
    "maxBullishMaCrossoverDays",
  ]);

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
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

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeText(
  value: unknown,
) {
  return String(value ?? "")
    .trim();
}

function normalizeFilters(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as UnknownRecord;
}

function normalizeSectors(
  filters: UnknownRecord,
) {
  const raw =
    Array.isArray(
      filters.sectors,
    )
      ? filters.sectors
      : typeof filters.sector ===
          "string"
        ? [filters.sector]
        : [];

  return [
    ...new Set(
      raw
        .map(
          normalizeText,
        )
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

function isQuoteStale(
  quoteUpdatedAt: string | null,
  staleBeforeMs: number,
) {
  if (!quoteUpdatedAt) {
    return true;
  }

  const timestamp =
    Date.parse(
      quoteUpdatedAt,
    );

  return (
    !Number.isFinite(timestamp) ||
    timestamp < staleBeforeMs
  );
}

function unixTimestampToIso(
  value: unknown,
): string | null {
  const timestamp =
    finiteNumber(value);

  if (
    timestamp === null ||
    timestamp <= 0
  ) {
    return null;
  }

  const date =
    new Date(timestamp * 1000);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
}

async function fetchQuote(
  symbol: string,
  apiKey: string,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      QUOTE_TIMEOUT_MS,
    );

  try {
    const url =
      new URL(
        "https://finnhub.io/api/v1/quote",
      );

    url.searchParams.set(
      "symbol",
      symbol,
    );

    const response =
      await fetch(
        url,
        {
          headers: {
            "X-Finnhub-Token":
              apiKey,
          },
          signal:
            controller.signal,
        },
      );

    const payload =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Finnhub quote request failed with status ${response.status}.`,
      );
    }

    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      throw new Error(
        "Finnhub returned an invalid quote payload.",
      );
    }

    const quote =
      payload as UnknownRecord;

    const price =
      finiteNumber(
        quote.c,
      );

    const previousClose =
      finiteNumber(
        quote.pc,
      );

    if (
      (price === null ||
        price <= 0) &&
      (previousClose ===
        null ||
        previousClose <= 0)
    ) {
      throw new Error(
        "Finnhub returned no usable quote.",
      );
    }

    const now =
      new Date().toISOString();

    const values:
      Partial<ScreenerRow> = {
        quote_updated_at:
          now,
      };

    const changeAmount =
      finiteNumber(
        quote.d,
      );

    const changePercent =
      finiteNumber(
        quote.dp,
      );

    const openPrice =
      finiteNumber(
        quote.o,
      );

    const dayHigh =
      finiteNumber(
        quote.h,
      );

    const dayLow =
      finiteNumber(
        quote.l,
      );

    const marketTimestamp =
      unixTimestampToIso(
        quote.t,
      );

    if (price !== null) {
      values.price =
        price;
    }

    if (
      changeAmount !== null
    ) {
      values.change_amount =
        changeAmount;
    }

    if (
      changePercent !== null
    ) {
      values.change_percent =
        changePercent;
    }

    if (
      openPrice !== null
    ) {
      values.open_price =
        openPrice;
    }

    if (
      dayHigh !== null
    ) {
      values.day_high =
        dayHigh;
    }

    if (
      dayLow !== null
    ) {
      values.day_low =
        dayLow;
    }

    if (
      previousClose !== null
    ) {
      values.previous_close =
        previousClose;
    }

    if (marketTimestamp) {
      values.market_timestamp =
        marketTimestamp;
    }

    return values;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function processInBatches<T, R>(
  values: T[],
  concurrency: number,
  worker: (
    value: T,
  ) => Promise<R>,
) {
  const results: R[] = [];

  for (
    let index = 0;
    index < values.length;
    index += concurrency
  ) {
    const batch =
      values.slice(
        index,
        index + concurrency,
      );

    const batchResults =
      await Promise.all(
        batch.map(worker),
      );

    results.push(
      ...batchResults,
    );
  }

  return results;
}

function toClientStock(
  row: ScreenerRow,
) {
  return {
    ticker:
      row.symbol,
    symbol:
      row.symbol,
    name:
      row.company_name ||
      row.symbol,
    companyName:
      row.company_name ||
      row.symbol,
    exchange:
      row.exchange || "",
    sector:
      row.sector,
    industry:
      row.industry,

    price:
      row.price,
    changeAmount:
      row.change_amount,
    changePercent:
      row.change_percent,
    openPrice:
      row.open_price,
    dayHigh:
      row.day_high,
    dayLow:
      row.day_low,
    previousClose:
      row.previous_close,
    marketTimestamp:
      row.market_timestamp,

    marketCapB:
      row.market_cap_b,
    enterpriseValueB:
      row.enterprise_value_b,
    pe:
      row.pe,
    forwardPe:
      row.forward_pe,
    peg:
      row.peg,
    pb:
      row.pb,
    ps:
      row.ps,
    evEbitda:
      row.ev_ebitda,
    pcf:
      row.pcf,
    pfcf:
      row.pfcf,

    grossMargin:
      row.gross_margin,
    operatingMargin:
      row.operating_margin,
    netMargin:
      row.net_margin,
    roe:
      row.roe,
    roa:
      row.roa,
    roic:
      row.roic,

    revenueGrowth:
      row.revenue_growth_yoy,
    epsGrowth:
      row.eps_growth_yoy,
    ebitdaGrowth:
      row.ebitda_growth_yoy,
    fcfGrowth:
      row.fcf_growth_yoy,

    deRatio:
      row.debt_to_equity,
    currentRatio:
      row.current_ratio,
    quickRatio:
      row.quick_ratio,
    interestCoverage:
      row.interest_coverage,
    debtEbitda:
      row.debt_to_ebitda,

    assetTurnover:
      row.asset_turnover,
    inventoryTurnover:
      row.inventory_turnover,
    receivablesTurnover:
      row.receivables_turnover,
    dso:
      row.days_sales_outstanding,

    dividendYield:
      row.dividend_yield,
    payoutRatio:
      row.payout_ratio,
    dividendGrowth:
      row.dividend_growth_5y,

    eps:
      row.eps_ttm,
    bookValuePerShare:
      row.book_value_per_share,
    fcfPerShare:
      row.fcf_per_share,

    rsi:
      row.rsi_14,
    high52Week:
      row.high_52_week,
    low52Week:
      row.low_52_week,
    week52Change:
      row.week_52_change,
    averageVolume30d:
      row.average_volume_30d,
    return1Week:
      row.return_1_week,
    return1Month:
      row.return_1_month,
    return3Month:
      row.return_3_month,
    volatility30d:
      row.volatility_30d,
    sma20:
      row.sma_20,
    sma50:
      row.sma_50,
    priceAboveSma20:
      row.price_above_sma_20,
    sma20AboveSma50:
      row.sma_20_above_sma_50,
    bullishMaCrossoverAt:
      row.bullish_ma_crossover_at,
    bullishMaCrossoverDaysAgo:
      row.bullish_ma_crossover_days_ago,
    relativeVolume:
      row.relative_volume,

    quoteUpdatedAt:
      row.quote_updated_at,
    fundamentalsUpdatedAt:
      row.fundamentals_updated_at,
    technicalsUpdatedAt:
      row.technicals_updated_at,
  };
}

Deno.serve(
  async (request) => {
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
          ok: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    const authorization =
      request.headers.get(
        "Authorization",
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer ",
        )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Authentication required.",
        },
        401,
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Supabase service credentials are unavailable.",
        },
        503,
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        },
      );

    const jwt =
      authorization.slice(
        "Bearer ".length,
      );

    const {
      data: userData,
      error: userError,
    } =
      await admin.auth
        .getUser(jwt);

    if (
      userError ||
      !userData.user
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid or expired session.",
        },
        401,
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const filters =
      normalizeFilters(
        body?.filters,
      );

    const requestedPage =
      Math.trunc(
        Number(
          body?.page,
        ),
      );

    const page =
      Number.isFinite(
        requestedPage,
      )
        ? Math.max(
            requestedPage,
            1,
          )
        : 1;

    const requestedPageSize =
      Math.trunc(
        Number(
          body?.pageSize,
        ),
      );

    const pageSize =
      Number.isFinite(
        requestedPageSize,
      )
        ? Math.min(
            Math.max(
              requestedPageSize,
              1,
            ),
            MAX_PAGE_SIZE,
          )
        : DEFAULT_PAGE_SIZE;

    const requestedSortKey =
      normalizeText(
        body?.sortBy,
      );

    const hasChangeFilter =
      finiteNumber(
        filters
          .minChangePercent,
      ) !== null ||
      finiteNumber(
        filters
          .maxChangePercent,
      ) !== null;

    const hasPriceFilter =
      finiteNumber(
        filters.minPrice,
      ) !== null ||
      finiteNumber(
        filters.maxPrice,
      ) !== null;

    const hasMomentumFilter =
      finiteNumber(
        filters.minReturn1Month,
      ) !== null ||
      finiteNumber(
        filters.minReturn3Month,
      ) !== null ||
      finiteNumber(
        filters.minRelativeVolume,
      ) !== null ||
      finiteNumber(
        filters.maxBullishMaCrossoverDays,
      ) !== null ||
      filters.requirePriceAboveSma20 === true ||
      filters.requireSma20AboveSma50 === true;

    const defaultSortColumn =
      hasChangeFilter
        ? "change_percent"
        : hasMomentumFilter
          ? "return_1_month"
          : hasPriceFilter
            ? "price"
            : "market_cap_b";

    const sortColumn =
      sortMap[
        requestedSortKey
      ] ||
      defaultSortColumn;

    const requestedDirection =
      normalizeText(
        body?.sortDirection,
      ).toLowerCase();

    const ascending =
      requestedDirection ===
        "asc"
        ? true
        : requestedDirection ===
            "desc"
          ? false
          : ascendingByDefault.has(
              sortColumn,
            );

    const requestedQuoteStaleMinutes =
      Number(
        body
          ?.quoteStaleMinutes,
      );

    const quoteStaleMinutes =
      Number.isFinite(
        requestedQuoteStaleMinutes,
      )
        ? Math.min(
            Math.max(
              requestedQuoteStaleMinutes,
              1,
            ),
            MAX_QUOTE_STALE_MINUTES,
          )
        : DEFAULT_QUOTE_STALE_MINUTES;

    const start =
      (page - 1) *
      pageSize;

    const end =
      start +
      pageSize -
      1;

    try {
      const sectors =
        normalizeSectors(
          filters,
        );

      const activeFilterKeys =
        Object.keys(
          filterMap,
        ).filter(
          (filterKey) =>
            finiteNumber(
              filters[
                filterKey
              ],
            ) !== null,
        );

      /*
       * Price and daily-change screens must not wait for the
       * multi-day fundamentals backfill. They only require the
       * quote cache populated by sync-stock-quotes.
       */
      const requiresPriceAboveSma20 =
        filters.requirePriceAboveSma20 ===
        true;

      const requiresSma20AboveSma50 =
        filters.requireSma20AboveSma50 ===
        true;

      const requiresTechnicals =
        requiresPriceAboveSma20 ||
        requiresSma20AboveSma50 ||
        activeFilterKeys.some(
          (filterKey) =>
            technicalFilterKeys.has(
              filterKey,
            ),
        );

      const requiresFundamentals =
        sectors.length > 0 ||
        activeFilterKeys.some(
          (filterKey) =>
            !quoteFilterKeys.has(
              filterKey,
            ) &&
            !technicalFilterKeys.has(
              filterKey,
            ),
        );

      let query =
        admin
          .from(
            "stock_screener_stocks",
          )
          .select(
            selectColumns,
            {
              count:
                "exact",
            },
          )
          .eq(
            "is_active",
            true,
          )
          .eq(
            "is_common_stock",
            true,
          );

      if (
        requiresFundamentals
      ) {
        query =
          query.not(
            "fundamentals_updated_at",
            "is",
            null,
          );
      }

      if (
        requiresTechnicals
      ) {
        query =
          query.not(
            "technicals_updated_at",
            "is",
            null,
          );
      }

      if (
        requiresPriceAboveSma20
      ) {
        query =
          query.eq(
            "price_above_sma_20",
            true,
          );
      }

      if (
        requiresSma20AboveSma50
      ) {
        query =
          query.eq(
            "sma_20_above_sma_50",
            true,
          );
      }

      if (
        sectors.length > 0
      ) {
        query =
          query.in(
            "sector",
            sectors,
          );
      }

      for (
        const [
          filterKey,
          config,
        ] of Object.entries(
          filterMap,
        )
      ) {
        const value =
          finiteNumber(
            filters[
              filterKey
            ],
          );

        if (
          value === null
        ) {
          continue;
        }

        query =
          config.operator ===
            "gte"
            ? query.gte(
                config.column,
                value,
              )
            : query.lte(
                config.column,
                value,
              );
      }

      query =
        query
          .order(
            sortColumn,
            {
              ascending,
              nullsFirst:
                false,
            },
          )
          .order(
            "symbol",
            {
              ascending:
                true,
            },
          )
          .range(
            start,
            end,
          );

      const {
        data,
        error,
        count,
      } =
        await query;

      if (error) {
        throw new Error(
          error.message,
        );
      }

      let rows =
        (
          data ??
          []
        ) as unknown as ScreenerRow[];

      const finnhubApiKey =
        Deno.env.get(
          "FINNHUB_API_KEY",
        );

      const staleBeforeMs =
        Date.now() -
        quoteStaleMinutes *
          60 *
          1000;

      const staleRows =
        finnhubApiKey
          ? rows.filter(
              (row) =>
                isQuoteStale(
                  row.quote_updated_at,
                  staleBeforeMs,
                ),
            )
          : [];

      let quoteResults:
        QuoteUpdate[] = [];

      if (
        finnhubApiKey &&
        staleRows.length >
          0
      ) {
        quoteResults =
          await processInBatches(
            staleRows,
            QUOTE_CONCURRENCY,
            async (
              row,
            ): Promise<QuoteUpdate> => {
              try {
                const values =
                  await fetchQuote(
                    row.symbol,
                    finnhubApiKey,
                  );

                const {
                  error:
                    updateError,
                } =
                  await admin
                    .from(
                      "stock_screener_stocks",
                    )
                    .update({
                      ...values,
                      quote_checked_at:
                        values
                          .quote_updated_at,
                      quote_error:
                        null,
                    })
                    .eq(
                      "symbol",
                      row.symbol,
                    );

                if (
                  updateError
                ) {
                  throw new Error(
                    updateError.message,
                  );
                }

                return {
                  symbol:
                    row.symbol,
                  ok: true,
                  error: null,
                  values,
                };
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Unknown quote refresh error.";

                await admin
                  .from(
                    "stock_screener_stocks",
                  )
                  .update({
                    quote_checked_at:
                      new Date()
                        .toISOString(),
                    quote_error:
                      message.slice(
                        0,
                        1000,
                      ),
                  })
                  .eq(
                    "symbol",
                    row.symbol,
                  );

                return {
                  symbol:
                    row.symbol,
                  ok: false,
                  error:
                    message,
                  values: {},
                };
              }
            },
          );

        const quoteMap =
          new Map(
            quoteResults
              .filter(
                (result) =>
                  result.ok,
              )
              .map(
                (result) => [
                  result.symbol,
                  result.values,
                ],
              ),
          );

        rows =
          rows.map(
            (row) => ({
              ...row,
              ...(
                quoteMap.get(
                  row.symbol,
                ) || {}
              ),
            }),
          );
      }

      const totalResults =
        count ?? 0;

      const totalPages =
        totalResults > 0
          ? Math.ceil(
              totalResults /
                pageSize,
            )
          : 0;

      const quoteSucceeded =
        quoteResults.filter(
          (result) =>
            result.ok,
        ).length;

      const quoteFailed =
        quoteResults.filter(
          (result) =>
            !result.ok,
        ).length;

      return jsonResponse({
        ok: true,
        stocks:
          rows.map(
            toClientStock,
          ),

        /*
         * Legacy fields kept temporarily so the existing
         * Screener.jsx does not break before Step 5B.
         */
        total:
          totalResults,
        pageSize,
        hasMore:
          page <
          totalPages,

        pagination: {
          page,
          pageSize,
          totalResults,
          totalPages,
          hasNextPage:
            page <
            totalPages,
          hasPreviousPage:
            page > 1,
        },

        sorting: {
          sortBy:
            sortColumn,
          sortDirection:
            ascending
              ? "asc"
              : "desc",
        },

        quoteRefresh: {
          staleAfterMinutes:
            quoteStaleMinutes,
          requested:
            staleRows.length,
          succeeded:
            quoteSucceeded,
          failed:
            quoteFailed,
        },

        coverage: {
          fundamentalsRequired:
            requiresFundamentals,
          technicalsRequired:
            requiresTechnicals,
          quoteCacheRequired:
            activeFilterKeys.some(
              (filterKey) =>
                quoteFilterKeys.has(
                  filterKey,
                ),
            ),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown database screener error.";

      console.error(
        "stock-screener:",
        error,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            message,
        },
        500,
      );
    }
  },
);
