const API_BASE_URL =
  "https://api.financialdatasets.ai";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

type UnknownRecord =
  Record<string, unknown>;

export type FinancialDatasetsQuote = {
  ticker: string;
  price: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  timestamp: number | null;
};

export type FinancialDatasetsPrice = {
  timestamp: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

function normalizeText(
  value: unknown,
): string {
  return String(value ?? "")
    .trim();
}

function normalizeTicker(
  value: unknown,
): string {
  return normalizeText(value)
    .toUpperCase();
}

export function finiteNumber(
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

export function timestampSeconds(
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

export function timestampToIso(
  value: unknown,
): string | null {
  const timestamp =
    timestampSeconds(value);

  if (
    timestamp === null ||
    timestamp <= 0
  ) {
    return null;
  }

  const date = new Date(
    timestamp * 1000,
  );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
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
      payload as UnknownRecord;

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
    return "Financial Datasets requires an active plan or API credits.";
  }

  if (status === 404) {
    return "Financial Datasets returned no data for the requested ticker.";
  }

  if (status === 429) {
    return "Financial Datasets rate limit reached.";
  }

  return `Financial Datasets returned status ${status}.`;
}

async function delay(
  milliseconds: number,
): Promise<void> {
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function providerGet(
  path: string,
  query: UnknownRecord,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<unknown> {
  if (!apiKey) {
    throw new Error(
      "Missing FINANCIAL_DATASETS_API_KEY.",
    );
  }

  const url = new URL(
    `${API_BASE_URL}${path}`,
  );

  for (
    const [key, value]
    of Object.entries(query)
  ) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        String(value),
      );
    }
  }

  let lastError: Error | null = null;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

    try {
      const response = await fetch(
        url.toString(),
        {
          headers: {
            Accept: "application/json",
            "X-API-KEY": apiKey,
          },
          signal: controller.signal,
        },
      );

      const text =
        await response.text();

      let payload: unknown = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (response.ok) {
        return payload;
      }

      const error = new Error(
        providerMessage(
          response.status,
          payload,
        ),
      );

      if (
        attempt < maxRetries &&
        (
          response.status === 429 ||
          response.status >= 500
        )
      ) {
        lastError = error;
        await delay(
          800 * 2 ** attempt,
        );
        continue;
      }

      throw error;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              "Financial Datasets request failed.",
            );

      if (
        attempt >= maxRetries ||
        (
          lastError.name !==
            "AbortError" &&
          !/fetch|network/i.test(
            lastError.message,
          )
        )
      ) {
        throw lastError;
      }

      await delay(
        800 * 2 ** attempt,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ??
    new Error(
      "Financial Datasets request failed.",
    );
}

export async function fetchFinancialDatasetsQuote(
  tickerValue: unknown,
  apiKey: string,
): Promise<FinancialDatasetsQuote> {
  const ticker =
    normalizeTicker(tickerValue);

  if (!ticker) {
    throw new Error(
      "Ticker is required.",
    );
  }

  const payload =
    await providerGet(
      "/prices/snapshot",
      { ticker },
      apiKey,
    );

  const root =
    payload &&
    typeof payload === "object"
      ? payload as UnknownRecord
      : {};

  const snapshot =
    root.snapshot &&
    typeof root.snapshot === "object"
      ? root.snapshot as UnknownRecord
      : root;

  const price = finiteNumber(
    snapshot.price ??
      snapshot.close ??
      snapshot.current_price,
  );

  const changeAmount = finiteNumber(
    snapshot.day_change ??
      snapshot.change ??
      snapshot.change_amount,
  );

  const previousClose =
    finiteNumber(
      snapshot.previous_close ??
        snapshot.previousClose,
    ) ??
    (
      price !== null &&
      changeAmount !== null
        ? price - changeAmount
        : null
    );

  let changePercent = finiteNumber(
    snapshot.day_change_percent ??
      snapshot.change_percent ??
      snapshot.changePercent,
  );

  if (
    changePercent === null &&
    changeAmount !== null &&
    previousClose !== null &&
    previousClose !== 0
  ) {
    changePercent =
      changeAmount /
      previousClose *
      100;
  }

  if (
    (
      price === null ||
      price <= 0
    ) &&
    (
      previousClose === null ||
      previousClose <= 0
    )
  ) {
    throw new Error(
      "Financial Datasets returned no usable quote.",
    );
  }

  return {
    ticker:
      normalizeTicker(
        snapshot.ticker,
      ) || ticker,
    price,
    changeAmount,
    changePercent,
    previousClose,
    open: finiteNumber(
      snapshot.open ??
        snapshot.open_price,
    ),
    high: finiteNumber(
      snapshot.high ??
        snapshot.day_high,
    ),
    low: finiteNumber(
      snapshot.low ??
        snapshot.day_low,
    ),
    timestamp:
      timestampSeconds(
        snapshot.time_milliseconds,
      ) ??
      timestampSeconds(
        snapshot.time,
      ) ??
      timestampSeconds(
        snapshot.date,
      ),
  };
}

export async function fetchFinancialDatasetsPrices(
  tickerValue: unknown,
  apiKey: string,
  options: {
    interval?: "day" | "week" | "month" | "year";
    startDate: string;
    endDate: string;
  },
): Promise<FinancialDatasetsPrice[]> {
  const ticker =
    normalizeTicker(tickerValue);

  if (!ticker) {
    throw new Error(
      "Ticker is required.",
    );
  }

  const payload =
    await providerGet(
      "/prices",
      {
        ticker,
        interval:
          options.interval ??
          "day",
        start_date:
          options.startDate,
        end_date:
          options.endDate,
      },
      apiKey,
    );

  const root =
    payload &&
    typeof payload === "object"
      ? payload as UnknownRecord
      : {};

  const prices =
    Array.isArray(root.prices)
      ? root.prices
      : [];

  return prices
    .map((item) => {
      const record =
        item &&
        typeof item === "object"
          ? item as UnknownRecord
          : {};

      const timestamp =
        timestampSeconds(
          record.time ??
            record.date,
        );

      const close = finiteNumber(
        record.close ??
          record.price,
      );

      if (
        timestamp === null ||
        timestamp <= 0 ||
        close === null ||
        close <= 0
      ) {
        return null;
      }

      const volume = finiteNumber(
        record.volume,
      );

      return {
        timestamp,
        open: finiteNumber(
          record.open,
        ),
        high: finiteNumber(
          record.high,
        ),
        low: finiteNumber(
          record.low,
        ),
        close,
        volume:
          volume !== null &&
          volume >= 0
            ? volume
            : null,
      } satisfies FinancialDatasetsPrice;
    })
    .filter(
      (
        item,
      ): item is FinancialDatasetsPrice =>
        item !== null,
    )
    .sort(
      (left, right) =>
        left.timestamp -
        right.timestamp,
    );
}
