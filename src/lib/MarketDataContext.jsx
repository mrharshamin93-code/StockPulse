import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@/lib/AuthContext";

const QUOTE_TTL_MS = 15000;
const DEFAULT_BATCH_SIZE = 25;

const MarketDataContext = createContext({
  quotes: {},
  refreshQuotes: async () => {},
  fetchQuotes: async () => {},
});

function normalizeTicker(ticker) {
  return String(ticker || "").trim().toUpperCase();
}

function normalizeTickerList(tickers) {
  return [...new Set((tickers || []).map(normalizeTicker).filter(Boolean))];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});

  const tickersRef = useRef([]);
  const quoteCacheRef = useRef({});
  const inFlightPromisesRef = useRef({});

  const fetchQuoteBatch = useCallback(async (tickers) => {
    const normalizedTickers = normalizeTickerList(tickers);

    if (!normalizedTickers.length) return {};

    const params = new URLSearchParams({
      action: "quotes",
      tickers: normalizedTickers.join(","),
    });

    const response = await fetch(`/api/finnhub?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Finnhub quotes request failed with status ${response.status}`);
    }

    const data = await response.json();
    const incomingQuotes = Array.isArray(data?.quotes) ? data.quotes : [];

    const mappedQuotes = incomingQuotes.reduce((acc, quote) => {
      const ticker = normalizeTicker(quote?.ticker);
      if (!ticker) return acc;

      acc[ticker] = {
        ticker,
        c: typeof quote?.c === "number" ? quote.c : null,
        d: typeof quote?.d === "number" ? quote.d : null,
        dp: typeof quote?.dp === "number" ? quote.dp : null,
        h: typeof quote?.h === "number" ? quote.h : null,
        l: typeof quote?.l === "number" ? quote.l : null,
        o: typeof quote?.o === "number" ? quote.o : null,
        pc: typeof quote?.pc === "number" ? quote.pc : null,
        t: quote?.t ?? null,
      };

      return acc;
    }, {});

    const now = Date.now();

    normalizedTickers.forEach((ticker) => {
      const quote = mappedQuotes[ticker] || {
        ticker,
        c: null,
        d: null,
        dp: null,
        h: null,
        l: null,
        o: null,
        pc: null,
        t: null,
      };

      quoteCacheRef.current[ticker] = {
        data: quote,
        fetchedAt: now,
      };
    });

    setQuotes((prev) => ({
      ...prev,
      ...mappedQuotes,
    }));

    return mappedQuotes;
  }, []);

  const fetchTickers = useCallback(
    async (tickers, options = {}) => {
      if (!user?.id) return {};

      const { force = false, batchSize = DEFAULT_BATCH_SIZE } = options;
      const normalizedTickers = normalizeTickerList(tickers);

      if (!normalizedTickers.length) return {};

      tickersRef.current = normalizeTickerList([
        ...tickersRef.current,
        ...normalizedTickers,
      ]);

      const now = Date.now();
      const freshQuotes = {};
      const staleOrMissing = [];

      normalizedTickers.forEach((ticker) => {
        const cached = quoteCacheRef.current[ticker];
        const isFresh =
          !force &&
          cached?.data &&
          typeof cached?.fetchedAt === "number" &&
          now - cached.fetchedAt < QUOTE_TTL_MS;

        if (isFresh) {
          freshQuotes[ticker] = cached.data;
        } else {
          staleOrMissing.push(ticker);
        }
      });

      if (Object.keys(freshQuotes).length > 0) {
        setQuotes((prev) => ({
          ...prev,
          ...freshQuotes,
        }));
      }

      if (!staleOrMissing.length) {
        return freshQuotes;
      }

      const pending = [];
      const tickersNeedingNetwork = [];

      staleOrMissing.forEach((ticker) => {
        const existingPromise = inFlightPromisesRef.current[ticker];
        if (existingPromise) {
          pending.push(existingPromise);
        } else {
          tickersNeedingNetwork.push(ticker);
        }
      });

      const batches = chunkArray(tickersNeedingNetwork, batchSize);

      batches.forEach((batch) => {
        const batchPromise = fetchQuoteBatch(batch)
          .catch((error) => {
            throw error;
          })
          .finally(() => {
            batch.forEach((ticker) => {
              delete inFlightPromisesRef.current[ticker];
            });
          });

        batch.forEach((ticker) => {
          inFlightPromisesRef.current[ticker] = batchPromise;
        });

        pending.push(batchPromise);
      });

      if (pending.length) {
        try {
          await Promise.all(pending);
        } catch (error) {
          console.error("Failed to refresh quotes:", error);
        }
      }

      const resolvedQuotes = normalizedTickers.reduce((acc, ticker) => {
        const cached = quoteCacheRef.current[ticker];
        if (cached?.data) {
          acc[ticker] = cached.data;
        }
        return acc;
      }, {});

      if (Object.keys(resolvedQuotes).length > 0) {
        setQuotes((prev) => ({
          ...prev,
          ...resolvedQuotes,
        }));
      }

      return resolvedQuotes;
    },
    [fetchQuoteBatch, user?.id]
  );

  const refreshQuotes = useCallback(
    async (tickers) => {
      const requestedTickers =
        Array.isArray(tickers) && tickers.length ? tickers : tickersRef.current;

      return fetchTickers(requestedTickers, { force: true });
    },
    [fetchTickers]
  );

  const fetchQuotes = useCallback(
    async (tickers) => {
      return fetchTickers(tickers, { force: false });
    },
    [fetchTickers]
  );

  const value = useMemo(
    () => ({
      quotes,
      refreshQuotes,
      fetchQuotes,
    }),
    [quotes, refreshQuotes, fetchQuotes]
  );

  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
