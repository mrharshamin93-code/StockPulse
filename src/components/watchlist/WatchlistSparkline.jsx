import React, { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

const SPARKLINE_TTL = 5 * 60 * 1000;
const sparklineCache = new Map();
const sparklineBatchPending = new Map();

let sparklineBatchTimer = null;

function queueSparklineBatch(ticker) {
  return new Promise((resolve, reject) => {
    const pending = sparklineBatchPending.get(ticker) || {
      resolves: [],
      rejects: [],
    };

    pending.resolves.push(resolve);
    pending.rejects.push(reject);
    sparklineBatchPending.set(ticker, pending);

    if (sparklineBatchTimer !== null) {
      return;
    }

    sparklineBatchTimer = window.setTimeout(() => {
      const batch = new Map(sparklineBatchPending);
      sparklineBatchPending.clear();
      sparklineBatchTimer = null;

      void (async () => {
        const tickers = [...batch.keys()];
        const { data: rows, error } = await supabase.rpc(
          "get_stock_sparklines",
          {
            p_tickers: tickers,
            p_limit: 30,
          },
        );

        if (error) {
          for (const pendingEntry of batch.values()) {
            pendingEntry.rejects.forEach((reject) => reject(error));
          }
          return;
        }

        const grouped = new Map();

        for (const row of rows || []) {
          const key = String(row?.ticker || "").trim().toUpperCase();
          const close = Number(row?.close);

          if (!key || !Number.isFinite(close) || close <= 0) {
            continue;
          }

          const values = grouped.get(key) || [];
          values.push(close);
          grouped.set(key, values);
        }

        const timestamp = Date.now();

        for (const [tickerKey, pendingEntry] of batch.entries()) {
          const values = grouped.get(tickerKey) || [];
          const data = values.length >= 2 ? values : null;

          if (data) {
            sparklineCache.set(tickerKey, {
              data,
              timestamp,
            });
          }

          pendingEntry.resolves.forEach((resolve) => resolve(data));
        }
      })().catch((error) => {
        for (const pendingEntry of batch.values()) {
          pendingEntry.rejects.forEach((reject) => reject(error));
        }
      });
    }, 0);
  });
}

async function fetchSparkline(ticker, signal) {
  const key = String(ticker || "").trim().toUpperCase();

  if (!key) {
    return null;
  }

  const cached = sparklineCache.get(key);

  if (
    cached &&
    Date.now() - cached.timestamp < SPARKLINE_TTL
  ) {
    return cached.data;
  }

  if (signal?.aborted) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
  }

  const data = await queueSparklineBatch(key);

  if (signal?.aborted) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
  }

  return data;
}

function MiniSparkline({ data, isPositive }) {
  const width = 58;
  const height = 38;
  const padding = 2;
  const color = isPositive ? "#10b981" : "#ef4444";

  if (!data || data.length < 2) {
    return (
      <div
        className="flex h-[38px] w-[58px] items-center justify-center text-xs text-muted-foreground/50"
        aria-label="Chart unavailable"
      >
        —
      </div>
    );
  }

  const minimum = Math.min(...data);
  const maximum = Math.max(...data);
  const range = maximum - minimum || 1;

  const points = data
    .map((price, index) => {
      const x =
        padding +
        (index / (data.length - 1)) *
          (width - padding * 2);

      const y =
        padding +
        ((maximum - price) / range) *
          (height - padding * 2);

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WatchlistSparkline({
  ticker,
  isPositive,
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchSparkline(ticker, controller.signal)
      .then(setData)
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn(
            `Sparkline failed for ${ticker}:`,
            error,
          );
        }
      });

    return () => controller.abort();
  }, [ticker]);

  return (
    <MiniSparkline
      data={data}
      isPositive={isPositive}
    />
  );
}
