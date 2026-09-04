import type {
  SupabaseClient,
} from "npm:@supabase/supabase-js@2";

import {
  fetchFinancialDatasetsPrices,
  fetchFinancialDatasetsQuote,
  type FinancialDatasetsPrice,
  type FinancialDatasetsQuote,
} from "./financial-datasets.ts";

const PROVIDER = "financial-datasets";
const MARKET_TIME_ZONE = "America/New_York";
const DEFAULT_MONTHLY_LIMIT = 100_000;
const DEFAULT_RESERVED_UNITS = 15_000;
const DEFAULT_LEASE_SECONDS = 30;
const DEFAULT_RETRY_SECONDS = 60;
const QUOTE_MARKET_TTL_MS = 5 * 60 * 1000;
const QUOTE_OFF_HOURS_TTL_MS = 60 * 60 * 1000;
const QUOTE_STALE_MS = 24 * 60 * 60 * 1000;
const PRICE_CURRENT_TTL_MS = 15 * 60 * 1000;
const PRICE_HISTORICAL_TTL_MS = 3650 * 24 * 60 * 60 * 1000;
const PRICE_STALE_MS = PRICE_HISTORICAL_TTL_MS;

type JsonRecord = Record<string, unknown>;

type CacheRow = {
  cache_key: string;
  payload: unknown;
  fetched_at: string | null;
  expires_at: string | null;
  stale_until: string | null;
  retry_after: string | null;
  provider_error: string | null;
};

export type MarketDataCacheStatus =
  | "hit"
  | "miss"
  | "refreshed"
  | "stale"
  | "stale-error"
  | "stale-quota";

export type MarketDataCacheResult<T> = {
  data: T;
  cache: {
    key: string;
    status: MarketDataCacheStatus;
    fetchedAt: string | null;
    expiresAt: string | null;
  };
};

export type MarketDataCacheOptions<T> = {
  client: SupabaseClient;
  key: string;
  dataType: string;
  ticker?: string | null;
  parameters?: JsonRecord;
  freshMs: number;
  staleMs: number;
  endpoint: string;
  requestUnits?: number;
  getRequestUnits?: () => number;
  usageManagedByFetcher?: boolean;
  priority?: boolean;
  fetcher: () => Promise<T>;
};

class ProviderBudgetError extends Error {
  constructor() {
    super(
      "Financial Datasets monthly request budget is reserved for priority traffic.",
    );
    this.name = "ProviderBudgetError";
  }
}

function retrySecondsForError(
  error: unknown,
): number {
  if (error instanceof ProviderBudgetError) return 5;

  const status =
    error &&
      typeof error === "object" &&
      "status" in error
      ? Number(
          (error as { status?: unknown }).status,
        )
      : null;

  if (status === 404) return 30 * 60;
  if (status === 402) return 60 * 60;
  if (status === 429) return 5 * 60;
  return DEFAULT_RETRY_SECONDS;
}

function finiteInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : fallback;
}

function monthlyLimit(): number {
  return finiteInteger(
    Deno.env.get("FINANCIAL_DATASETS_MONTHLY_LIMIT"),
    DEFAULT_MONTHLY_LIMIT,
  );
}

function reservedUnits(): number {
  return finiteInteger(
    Deno.env.get("FINANCIAL_DATASETS_RESERVED_UNITS"),
    DEFAULT_RESERVED_UNITS,
  );
}

function normalizedTicker(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function dateMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasPayload(row: CacheRow | null): boolean {
  return row?.payload !== null && row?.payload !== undefined;
}

function requestUnitsFor(
  options: MarketDataCacheOptions<unknown>,
): number {
  const dynamic =
    options.getRequestUnits?.();

  const value =
    typeof dynamic === "number" &&
    Number.isFinite(dynamic) &&
    dynamic >= 0
      ? dynamic
      : options.requestUnits ?? 1;

  return Math.max(
    0,
    Math.floor(value),
  );
}

function marketIsoDate(
  now = new Date(),
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          MARKET_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(now);

  const value = (type: string) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  const year = value("year");
  const month = value("month");
  const day = value("day");

  if (
    year &&
    month &&
    day
  ) {
    return `${year}-${month}-${day}`;
  }

  return now
    .toISOString()
    .slice(0, 10);
}

function resultFromRow<T>(
  row: CacheRow,
  status: MarketDataCacheStatus,
): MarketDataCacheResult<T> {
  return {
    data: row.payload as T,
    cache: {
      key: row.cache_key,
      status,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
    },
  };
}

async function loadRow(
  client: SupabaseClient,
  key: string,
): Promise<CacheRow | null> {
  const { data, error } = await client
    .from("market_data_cache")
    .select(
      "cache_key,payload,fetched_at,expires_at,stale_until,retry_after,provider_error",
    )
    .eq("cache_key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the market-data cache: ${error.message}`);
  }

  return data as CacheRow | null;
}

async function claimRefresh(
  client: SupabaseClient,
  options: MarketDataCacheOptions<unknown>,
): Promise<boolean> {
  const { data, error } = await client.rpc(
    "claim_market_data_refresh",
    {
      p_cache_key: options.key,
      p_data_type: options.dataType,
      p_ticker: normalizedTicker(options.ticker),
      p_parameters: options.parameters ?? {},
      p_lease_seconds: DEFAULT_LEASE_SECONDS,
    },
  );

  if (error) {
    throw new Error(`Could not claim a market-data refresh: ${error.message}`);
  }

  return data === true;
}

async function reserveProviderUnits(
  client: SupabaseClient,
  requestUnits: number,
  priority: boolean,
): Promise<boolean> {
  const { data, error } = await client.rpc(
    "reserve_provider_request",
    {
      p_provider: PROVIDER,
      p_request_units: Math.max(1, requestUnits),
      p_monthly_limit: monthlyLimit(),
      p_reserved_units: reservedUnits(),
      p_priority: priority,
    },
  );

  if (error) {
    throw new Error(`Could not reserve provider capacity: ${error.message}`);
  }

  return data === true;
}

async function reserveRequest(
  client: SupabaseClient,
  options: MarketDataCacheOptions<unknown>,
): Promise<boolean> {
  return reserveProviderUnits(
    client,
    Math.max(
      1,
      requestUnitsFor(options),
    ),
    options.priority === true,
  );
}

async function recordProviderResult(
  client: SupabaseClient,
  endpoint: string,
  requestUnits: number,
  success: boolean,
): Promise<void> {
  const { error } = await client.rpc(
    "record_provider_request_result",
    {
      p_provider: PROVIDER,
      p_endpoint: endpoint,
      p_request_units: Math.max(1, requestUnits),
      p_success: success,
    },
  );

  if (error) {
    console.warn(
      "Could not record Financial Datasets usage:",
      error.message,
    );
  }
}

async function recordRequestResult(
  client: SupabaseClient,
  options: MarketDataCacheOptions<unknown>,
  success: boolean,
): Promise<void> {
  await recordProviderResult(
    client,
    options.endpoint,
    Math.max(
      1,
      requestUnitsFor(options),
    ),
    success,
  );
}

async function completeRefresh<T>(
  client: SupabaseClient,
  options: MarketDataCacheOptions<T>,
  payload: T,
): Promise<void> {
  const { error } = await client.rpc(
    "complete_market_data_refresh",
    {
      p_cache_key: options.key,
      p_payload: payload,
      p_fresh_seconds: Math.max(1, Math.ceil(options.freshMs / 1000)),
      p_stale_seconds: Math.max(1, Math.ceil(options.staleMs / 1000)),
      p_request_units: requestUnitsFor(
        options as MarketDataCacheOptions<unknown>,
      ),
    },
  );

  if (error) {
    throw new Error(`Could not update the market-data cache: ${error.message}`);
  }
}

async function failRefresh(
  client: SupabaseClient,
  key: string,
  error: unknown,
  retrySeconds = DEFAULT_RETRY_SECONDS,
): Promise<void> {
  const message = error instanceof Error
    ? error.message
    : "Provider request failed.";

  const { error: cacheError } = await client.rpc(
    "fail_market_data_refresh",
    {
      p_cache_key: key,
      p_error: message,
      p_retry_seconds: retrySeconds,
    },
  );

  if (cacheError) {
    console.warn("Could not release the market-data refresh lease:", cacheError.message);
  }
}

async function waitForRefresh<T>(
  client: SupabaseClient,
  key: string,
): Promise<MarketDataCacheResult<T> | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    const row = await loadRow(client, key);

    if (row && hasPayload(row)) {
      return resultFromRow<T>(row, "hit");
    }
  }

  return null;
}

export async function getCachedMarketData<T>(
  options: MarketDataCacheOptions<T>,
): Promise<MarketDataCacheResult<T>> {
  const now = Date.now();
  let row = await loadRow(options.client, options.key);

  if (row && hasPayload(row) && dateMs(row.expires_at) > now) {
    return resultFromRow<T>(row, "hit");
  }

  const staleAvailable = Boolean(
    row && hasPayload(row) && dateMs(row.stale_until) > now,
  );

  if (row && dateMs(row.retry_after) > now) {
    if (staleAvailable) return resultFromRow<T>(row, "stale-error");
    throw new Error(row.provider_error || "Market data is temporarily unavailable.");
  }

  const claimed = await claimRefresh(
    options.client,
    options as MarketDataCacheOptions<unknown>,
  );

  if (!claimed) {
    if (staleAvailable && row) return resultFromRow<T>(row, "stale");

    const completed = await waitForRefresh<T>(options.client, options.key);
    if (completed) return completed;

    row = await loadRow(options.client, options.key);
    if (row && hasPayload(row)) return resultFromRow<T>(row, "stale");
    throw new Error("Market data is already being refreshed. Please retry shortly.");
  }

  let requestReserved = false;

  try {
    if (!options.usageManagedByFetcher) {
      requestReserved = await reserveRequest(
        options.client,
        options as MarketDataCacheOptions<unknown>,
      );

      if (!requestReserved) {
        throw new ProviderBudgetError();
      }
    }

    const payload = await options.fetcher();

    await completeRefresh(
      options.client,
      options,
      payload,
    );

    if (!options.usageManagedByFetcher) {
      await recordRequestResult(
        options.client,
        options as MarketDataCacheOptions<unknown>,
        true,
      );
    }

    return {
      data: payload,
      cache: {
        key: options.key,
        status: row && hasPayload(row) ? "refreshed" : "miss",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + options.freshMs).toISOString(),
      },
    };
  } catch (error) {
    if (
      requestReserved &&
      !options.usageManagedByFetcher
    ) {
      await recordRequestResult(
        options.client,
        options as MarketDataCacheOptions<unknown>,
        false,
      );
    }

    await failRefresh(
      options.client,
      options.key,
      error,
      retrySecondsForError(error),
    );

    if (staleAvailable && row) {
      return resultFromRow<T>(
        row,
        error instanceof ProviderBudgetError ? "stale-quota" : "stale-error",
      );
    }

    throw error;
  }
}

export function quoteFreshMs(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const isExtendedTradingHours = isWeekday && minutes >= 240 && minutes < 1200;

  return isExtendedTradingHours ? QUOTE_MARKET_TTL_MS : QUOTE_OFF_HOURS_TTL_MS;
}

export async function getCachedFinancialDatasetsQuote(
  client: SupabaseClient,
  tickerValue: unknown,
  apiKey: string,
  options: { priority?: boolean } = {},
): Promise<MarketDataCacheResult<FinancialDatasetsQuote>> {
  const ticker = normalizedTicker(tickerValue);
  if (!ticker) throw new Error("Ticker is required.");

  return getCachedMarketData({
    client,
    key: `quote:${ticker}`,
    dataType: "quote",
    ticker,
    parameters: {},
    freshMs: quoteFreshMs(),
    staleMs: QUOTE_STALE_MS,
    endpoint: "/prices/snapshot",
    priority: options.priority,
    fetcher: () => fetchFinancialDatasetsQuote(ticker, apiKey),
  });
}

export async function getCachedFinancialDatasetsPrices(
  client: SupabaseClient,
  tickerValue: unknown,
  apiKey: string,
  options: {
    interval?: "day" | "week" | "month" | "year";
    startDate: string;
    endDate: string;
    priority?: boolean;
  },
): Promise<MarketDataCacheResult<FinancialDatasetsPrice[]>> {
  const ticker = normalizedTicker(tickerValue);
  if (!ticker) throw new Error("Ticker is required.");

  const interval = options.interval ?? "day";

  // Use the New York market date rather than UTC. Otherwise, after
  // midnight UTC (8 PM ET during daylight time), today's market data
  // can be misclassified as historical and cached for years.
  const currentMarketDate =
    marketIsoDate();

  const includesCurrentDate =
    options.endDate >=
    currentMarketDate;

  let actualRequestUnits = 0;

  return getCachedMarketData({
    client,
    key: `prices:${ticker}:${interval}:${options.startDate}:${options.endDate}`,
    dataType: "prices",
    ticker,
    parameters: {
      interval,
      startDate: options.startDate,
      endDate: options.endDate,
    },
    freshMs: includesCurrentDate ? PRICE_CURRENT_TTL_MS : PRICE_HISTORICAL_TTL_MS,
    staleMs: PRICE_STALE_MS,
    endpoint: "/prices",
    usageManagedByFetcher: true,
    getRequestUnits: () =>
      actualRequestUnits,
    priority: options.priority,
    fetcher: () =>
      fetchFinancialDatasetsPrices(
        ticker,
        apiKey,
        {
          ...options,
          requestHooks: {
            beforeRequest:
              async () => {
                const reserved =
                  await reserveProviderUnits(
                    client,
                    1,
                    options.priority === true,
                  );

                if (!reserved) {
                  throw new ProviderBudgetError();
                }
              },
            afterRequest:
              async (
                success,
              ) => {
                actualRequestUnits += 1;

                await recordProviderResult(
                  client,
                  "/prices",
                  1,
                  success,
                );
              },
          },
        },
      ),
  });
}
