import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const PERIODS = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "2Y",
  "5Y",
  "10Y",
  "All",
];

const PERIOD_CONFIG = {
  "1D": {
    resolution: "5",
    requestDays: 7,
    displayDays: 1,
    latestSession: true,
  },
  "1W": {
    resolution: "60",
    requestDays: 14,
    displayDays: 7,
  },
  "1M": {
    resolution: "D",
    requestDays: 45,
    displayDays: 30,
  },
  "3M": {
    resolution: "D",
    requestDays: 110,
    displayDays: 90,
  },
  "6M": {
    resolution: "D",
    requestDays: 200,
    displayDays: 180,
  },
  YTD: {
    resolution: "D",
    requestDays: null,
    displayDays: null,
  },
  "1Y": {
    resolution: "D",
    requestDays: 390,
    displayDays: 365,
  },
  "2Y": {
    resolution: "W",
    requestDays: 780,
    displayDays: 730,
  },
  "5Y": {
    resolution: "W",
    requestDays: 1900,
    displayDays: 1825,
  },
  "10Y": {
    resolution: "M",
    requestDays: 3720,
    displayDays: 3650,
  },
  All: {
    resolution: "M",
    requestDays: null,
    displayDays: null,
  },
};

const MAX_RENDERED_POINTS = 180;
const FETCH_BATCH_SIZE = 5;

function getValidNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function getTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? Math.floor(timestamp / 1000)
    : null;
}

function normalizeTicker(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeHoldings(stocks) {
  const grouped = new Map();

  for (const stock of stocks || []) {
    const ticker = normalizeTicker(
      stock?.ticker,
    );

    const quantity = getValidNumber(
      stock?.quantity,
    );

    const purchasePrice =
      getValidNumber(
        stock?.purchase_price,
      );

    const currentPrice =
      getValidNumber(
        stock?.current_price,
      );

    const createdAt =
      getTimestamp(
        stock?.created_at,
      );

    const updatedAt =
      getTimestamp(
        stock?.updated_at,
      );

    if (
      !ticker ||
      quantity === null ||
      quantity <= 0 ||
      purchasePrice === null ||
      purchasePrice <= 0 ||
      createdAt === null
    ) {
      continue;
    }

    const existing =
      grouped.get(ticker) || {
        ticker,
        quantity: 0,
        totalCost: 0,
        createdAt,
        updatedAt: null,
        currentPrice: null,
      };

    existing.quantity += quantity;
    existing.totalCost +=
      purchasePrice * quantity;

    existing.createdAt =
      Math.min(
        existing.createdAt,
        createdAt,
      );

    if (
      currentPrice !== null &&
      currentPrice > 0 &&
      (
        existing.updatedAt === null ||
        (updatedAt || createdAt) >=
          existing.updatedAt
      )
    ) {
      existing.currentPrice =
        currentPrice;

      existing.updatedAt =
        updatedAt || createdAt;
    }

    grouped.set(
      ticker,
      existing,
    );
  }

  return Array.from(
    grouped.values(),
  ).map((holding) => ({
    ...holding,
    purchasePrice:
      holding.totalCost /
      holding.quantity,
  }));
}

function getRequestBounds(
  period,
  earliestPurchase,
) {
  const now = Math.floor(
    Date.now() / 1000,
  );

  const config =
    PERIOD_CONFIG[period] ||
    PERIOD_CONFIG["1M"];

  if (period === "YTD") {
    const currentDate =
      new Date();

    const yearStart =
      Math.floor(
        new Date(
          currentDate.getFullYear(),
          0,
          1,
          0,
          0,
          0,
          0,
        ).getTime() / 1000,
      );

    return {
      from: yearStart,
      to: now,
      resolution:
        config.resolution,
      provisionalChartStart:
        yearStart,
    };
  }

  if (period === "All") {
    const from = Math.max(
      0,
      earliestPurchase -
        7 * 86400,
    );

    return {
      from,
      to: now,
      resolution:
        config.resolution,
      provisionalChartStart:
        earliestPurchase,
    };
  }

  return {
    from:
      now -
      config.requestDays *
        86400,
    to: now,
    resolution:
      config.resolution,
    provisionalChartStart:
      now -
      config.displayDays *
        86400,
  };
}

async function fetchTickerHistory({
  ticker,
  resolution,
  from,
  to,
  signal,
}) {
  const response = await fetch(
    "/api/finnhub",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        action:
          "candles_range",
        ticker,
        resolution,
        from,
        to,
      }),
      signal,
    },
  );

  const payload =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        `Unable to load ${ticker} history`,
    );
  }

  const candles =
    Array.isArray(
      payload?.candles,
    )
      ? payload.candles
      : [];

  return candles
    .map((candle) => {
      const timestamp =
        getValidNumber(
          candle?.t,
        );

      const close =
        getValidNumber(
          candle?.v ??
            candle?.c,
        );

      if (
        timestamp === null ||
        close === null ||
        close <= 0
      ) {
        return null;
      }

      return {
        timestamp:
          Math.floor(
            timestamp,
          ),
        price: close,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.timestamp -
        b.timestamp,
    );
}

async function fetchHistories({
  holdings,
  bounds,
  signal,
}) {
  const result = new Map();

  for (
    let index = 0;
    index < holdings.length;
    index += FETCH_BATCH_SIZE
  ) {
    const batch =
      holdings.slice(
        index,
        index +
          FETCH_BATCH_SIZE,
      );

    const batchResults =
      await Promise.all(
        batch.map(
          async (holding) => ({
            ticker:
              holding.ticker,
            points:
              await fetchTickerHistory({
                ticker:
                  holding.ticker,
                resolution:
                  bounds.resolution,
                from:
                  bounds.from,
                to: bounds.to,
                signal,
              }),
          }),
        ),
      );

    for (
      const item of batchResults
    ) {
      result.set(
        item.ticker,
        item.points,
      );
    }
  }

  return result;
}

function getUtcDayStart(
  timestamp,
) {
  const date = new Date(
    timestamp * 1000,
  );

  return Math.floor(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ) / 1000,
  );
}

function getChartStart({
  period,
  histories,
  provisionalChartStart,
}) {
  if (
    period !== "1D"
  ) {
    return provisionalChartStart;
  }

  let latestMarketTimestamp =
    null;

  for (
    const points of histories.values()
  ) {
    const latest =
      points.at(-1)
        ?.timestamp;

    if (
      latest !== undefined &&
      (
        latestMarketTimestamp ===
          null ||
        latest >
          latestMarketTimestamp
      )
    ) {
      latestMarketTimestamp =
        latest;
    }
  }

  if (
    latestMarketTimestamp === null
  ) {
    return provisionalChartStart;
  }

  return getUtcDayStart(
    latestMarketTimestamp,
  );
}

function prepareHoldingSeries({
  holding,
  history,
  chartStart,
  chartEnd,
}) {
  const acquisitionTime =
    holding.createdAt;

  const eligibleHistory =
    (history || []).filter(
      (point) =>
        point.timestamp >=
          chartStart &&
        point.timestamp >=
          acquisitionTime &&
        point.timestamp <=
          chartEnd,
    );

  const series = [];

  if (
    acquisitionTime >=
      chartStart &&
    acquisitionTime <= chartEnd
  ) {
    series.push({
      timestamp:
        acquisitionTime,
      price:
        holding.purchasePrice,
      source:
        "entered-purchase",
    });
  }

  if (
    acquisitionTime <
      chartStart &&
    eligibleHistory.length > 0
  ) {
    series.push({
      timestamp:
        eligibleHistory[0]
          .timestamp,
      price:
        eligibleHistory[0]
          .price,
      source: "market",
    });
  }

  for (
    const point of eligibleHistory
  ) {
    series.push({
      ...point,
      source: "market",
    });
  }

  if (
    holding.currentPrice !==
      null &&
    holding.currentPrice > 0 &&
    holding.updatedAt !== null &&
    holding.updatedAt >=
      chartStart &&
    holding.updatedAt >=
      acquisitionTime &&
    holding.updatedAt <=
      chartEnd
  ) {
    series.push({
      timestamp:
        holding.updatedAt,
      price:
        holding.currentPrice,
      source: "market-quote",
    });
  }

  const byTimestamp =
    new Map();

  for (
    const point of series
  ) {
    byTimestamp.set(
      point.timestamp,
      point,
    );
  }

  return Array.from(
    byTimestamp.values(),
  ).sort(
    (a, b) =>
      a.timestamp -
      b.timestamp,
  );
}

function findPriceAtOrBefore(
  series,
  timestamp,
) {
  let low = 0;
  let high =
    series.length - 1;
  let result = null;

  while (low <= high) {
    const middle =
      Math.floor(
        (low + high) / 2,
      );

    const point =
      series[middle];

    if (
      point.timestamp <=
      timestamp
    ) {
      result = point.price;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function formatChartLabel(
  timestamp,
  period,
) {
  const date = new Date(
    timestamp * 1000,
  );

  if (period === "1D") {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      },
    );
  }

  if (period === "1W") {
    return date.toLocaleDateString(
      "en-US",
      {
        weekday: "short",
      },
    );
  }

  if (
    [
      "1M",
      "3M",
      "6M",
      "YTD",
    ].includes(period)
  ) {
    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    );
  }

  if (
    period === "10Y" ||
    period === "All"
  ) {
    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        year: "numeric",
      },
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "2-digit",
    },
  );
}

function buildPortfolioData({
  holdings,
  histories,
  chartStart,
  chartEnd,
  period,
}) {
  const prepared =
    holdings.map(
      (holding) => ({
        holding,
        series:
          prepareHoldingSeries({
            holding,
            history:
              histories.get(
                holding.ticker,
              ) || [],
            chartStart,
            chartEnd,
          }),
      }),
    );

  if (
    prepared.some(
      (item) =>
        item.series.length ===
        0,
    )
  ) {
    return {
      data: [],
      missingTicker:
        prepared.find(
          (item) =>
            item.series.length ===
            0,
        )?.holding.ticker ||
        null,
    };
  }

  const timestampSet =
    new Set();

  for (
    const item of prepared
  ) {
    for (
      const point of item.series
    ) {
      timestampSet.add(
        point.timestamp,
      );
    }
  }

  const timestamps =
    Array.from(
      timestampSet,
    )
      .filter(
        (timestamp) =>
          timestamp >=
            chartStart &&
          timestamp <=
            chartEnd,
      )
      .sort(
        (a, b) => a - b,
      );

  const data = [];

  for (
    const timestamp of timestamps
  ) {
    let totalValue = 0;
    let hasPosition = false;
    let complete = true;

    for (
      const item of prepared
    ) {
      const {
        holding,
        series,
      } = item;

      if (
        timestamp <
        holding.createdAt
      ) {
        continue;
      }

      hasPosition = true;

      const price =
        findPriceAtOrBefore(
          series,
          timestamp,
        );

      if (
        price === null
      ) {
        complete = false;
        break;
      }

      totalValue +=
        price *
        holding.quantity;
    }

    if (
      !hasPosition ||
      !complete
    ) {
      continue;
    }

    data.push({
      timestamp,
      label:
        formatChartLabel(
          timestamp,
          period,
        ),
      value:
        Math.round(
          totalValue * 100,
        ) / 100,
    });
  }

  if (
    data.length <=
    MAX_RENDERED_POINTS
  ) {
    return {
      data,
      missingTicker: null,
    };
  }

  const step = Math.ceil(
    data.length /
      MAX_RENDERED_POINTS,
  );

  const reduced =
    data.filter(
      (_, index) =>
        index % step === 0,
    );

  const finalPoint =
    data.at(-1);

  if (
    reduced.at(-1)
      ?.timestamp !==
    finalPoint.timestamp
  ) {
    reduced.push(
      finalPoint,
    );
  }

  return {
    data: reduced,
    missingTicker: null,
  };
}

function formatCurrency(value) {
  return `$${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

function formatYAxisValue(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return "—";
  }

  if (
    Math.abs(numericValue) >=
    1_000_000
  ) {
    return `$${(
      numericValue /
      1_000_000
    ).toFixed(1)}M`;
  }

  if (
    Math.abs(numericValue) >=
    1000
  ) {
    return `$${(
      numericValue / 1000
    ).toFixed(0)}k`;
  }

  return `$${numericValue.toFixed(
    0,
  )}`;
}

function PortfolioTooltip({
  active,
  payload,
  label,
  startValue,
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  const value =
    Number(
      payload[0]?.value,
    );

  if (
    !Number.isFinite(value)
  ) {
    return null;
  }

  const gain =
    startValue > 0
      ? value - startValue
      : null;

  const gainPct =
    gain !== null &&
    startValue > 0
      ? (gain /
          startValue) *
        100
      : null;

  const positive =
    gain === null ||
    gain >= 0;

  return (
    <div className="min-w-[150px] rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <p className="text-base font-bold text-gray-900">
        {formatCurrency(value)}
      </p>

      {gainPct !== null && (
        <p
          className={`mt-1 text-xs font-semibold ${
            positive
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        >
          {positive ? "+" : ""}
          {gainPct.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

export default function PortfolioGrowthChart({
  stocks = [],
}) {
  const [period, setPeriod] =
    useState("1M");

  const [chartData, setChartData] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const holdings = useMemo(
    () =>
      normalizeHoldings(
        stocks,
      ),
    [stocks],
  );

  useEffect(() => {
    if (
      holdings.length === 0
    ) {
      setChartData([]);
      setError(
        "Enter a valid quantity, purchase price, and purchase date for each holding.",
      );

      return undefined;
    }

    const controller =
      new AbortController();

    async function loadChart() {
      setLoading(true);
      setError("");

      try {
        const earliestPurchase =
          Math.min(
            ...holdings.map(
              (holding) =>
                holding.createdAt,
            ),
          );

        const bounds =
          getRequestBounds(
            period,
            earliestPurchase,
          );

        const histories =
          await fetchHistories({
            holdings,
            bounds,
            signal:
              controller.signal,
          });

        if (
          controller.signal.aborted
        ) {
          return;
        }

        const chartStart =
          getChartStart({
            period,
            histories,
            provisionalChartStart:
              bounds.provisionalChartStart,
          });

        const result =
          buildPortfolioData({
            holdings,
            histories,
            chartStart,
            chartEnd:
              bounds.to,
            period,
          });

        if (
          result.missingTicker
        ) {
          throw new Error(
            `Historical prices are unavailable for ${result.missingTicker} in this range.`,
          );
        }

        if (
          result.data.length < 2
        ) {
          throw new Error(
            "Not enough verified price history is available for this range.",
          );
        }

        setChartData(
          result.data,
        );
      } catch (loadError) {
        if (
          loadError?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Portfolio growth load failed:",
          loadError,
        );

        setChartData([]);

        setError(
          loadError?.message ||
            "Unable to load portfolio history.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    loadChart();

    return () =>
      controller.abort();
  }, [
    holdings,
    period,
  ]);

  const firstValue =
    chartData[0]?.value ??
    null;

  const latestValue =
    chartData.at(-1)?.value ??
    null;

  const periodGain =
    firstValue !== null &&
    latestValue !== null
      ? latestValue -
        firstValue
      : null;

  const periodGainPct =
    periodGain !== null &&
    firstValue > 0
      ? (periodGain /
          firstValue) *
        100
      : null;

  const isPositive =
    periodGain === null ||
    periodGain >= 0;

  const chartColor =
    isPositive
      ? "#10b981"
      : "#ef4444";

  const gradientId =
    "portfolioGrowthGradient";

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
          Portfolio Growth
        </p>

        <p className="font-heading text-3xl font-bold text-gray-900">
          {latestValue !== null
            ? formatCurrency(
                latestValue,
              )
            : "—"}
        </p>

        {periodGain !== null &&
          periodGainPct !==
            null && (
            <p
              className={`mt-1 flex items-center gap-1 text-sm font-semibold ${
                isPositive
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}

              {isPositive
                ? "+"
                : "-"}
              {formatCurrency(
                Math.abs(
                  periodGain,
                ),
              )}{" "}
              (
              {isPositive
                ? "+"
                : ""}
              {periodGainPct.toFixed(
                2,
              )}
              %)
            </p>
          )}
      </div>

      <p className="mt-3 text-[11px] leading-4 text-gray-400">
        Based on your entered purchase
        prices and dates, combined with
        real historical market prices.
      </p>

      <div className="mt-4 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map(
          (periodOption) => (
            <button
              key={periodOption}
              type="button"
              onClick={() =>
                setPeriod(
                  periodOption,
                )
              }
              className={`min-w-[38px] shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                period ===
                periodOption
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {periodOption}
            </button>
          ),
        )}
      </div>

      <div className="mt-4 h-52 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 text-center">
            <p className="max-w-md text-sm text-gray-500">
              {error}
            </p>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={chartData}
              margin={{
                top: 4,
                right: 4,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={
                      chartColor
                    }
                    stopOpacity={
                      0.16
                    }
                  />

                  <stop
                    offset="95%"
                    stopColor={
                      chartColor
                    }
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                  fill: "#9ca3af",
                }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />

              <YAxis
                domain={[
                  "auto",
                  "auto",
                ]}
                tickFormatter={
                  formatYAxisValue
                }
                tick={{
                  fontSize: 10,
                  fill: "#9ca3af",
                }}
                tickLine={false}
                axisLine={false}
                width={46}
              />

              <Tooltip
                content={
                  <PortfolioTooltip
                    startValue={
                      firstValue
                    }
                  />
                }
              />

              <Area
                type="linear"
                dataKey="value"
                stroke={
                  chartColor
                }
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill:
                    chartColor,
                  strokeWidth: 0,
                }}
                isAnimationActive={
                  false
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
