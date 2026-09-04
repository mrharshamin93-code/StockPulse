import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/lib/AuthContext";
import { financialDatasetsRequest } from "@/lib/financialDatasets";

const QUOTE_TTL_MS = 5 * 60 * 1000;
const PERSISTED_QUOTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PERSISTED_QUOTE_CACHE_KEY = "stockpulse:quote-cache:v1";

const MarketDataContext = createContext({
  quotes: {},
  refreshQuotes: async (_tickers = []) => ({}),
  fetchQuotes: async (_tickers = []) => ({}),
});

function normalizeTicker(ticker) {
  return String(ticker || "").trim().toUpperCase();
}

function normalizeTickerList(tickers) {
  return [...new Set((tickers || []).map(normalizeTicker).filter(Boolean))];
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeQuote(quote, fallbackTicker = "") {
  const ticker = normalizeTicker(quote?.ticker || fallbackTicker);

  if (!ticker) {
    return null;
  }

  return {
    ticker,
    c: finiteNumber(quote?.c),
    d: finiteNumber(quote?.d),
    dp: finiteNumber(quote?.dp),
    h: finiteNumber(quote?.h),
    l: finiteNumber(quote?.l),
    o: finiteNumber(quote?.o),
    pc: finiteNumber(quote?.pc),
    t: finiteNumber(quote?.t),
    cacheStatus: quote?.cacheStatus || null,
    cacheExpiresAt: quote?.cacheExpiresAt || null,
    error: quote?.error || null,
  };
}

function readPersistedQuoteCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PERSISTED_QUOTE_CACHE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    const entries = parsed && typeof parsed === "object" ? parsed : {};
    const now = Date.now();
    const cache = {};

    for (const [rawTicker, entry] of Object.entries(entries)) {
      const ticker = normalizeTicker(rawTicker);
      const fetchedAt = Number(entry?.fetchedAt);
      const quote = normalizeQuote(entry?.data, ticker);

      if (
        !ticker ||
        !quote ||
        !Number.isFinite(fetchedAt) ||
        now - fetchedAt > PERSISTED_QUOTE_MAX_AGE_MS ||
        !Number.isFinite(quote.c)
      ) {
        continue;
      }

      cache[ticker] = {
        data: quote,
        fetchedAt,
      };
    }

    return cache;
  } catch (error) {
    console.warn("Unable to read persisted quote cache:", error);
    return {};
  }
}

function quoteMapFromCache(cache) {
  return Object.fromEntries(
    Object.entries(cache || {})
      .filter(([, entry]) => entry?.data)
      .map(([ticker, entry]) => [ticker, entry.data]),
  );
}

function persistQuoteCache(cache) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const now = Date.now();
    const persisted = {};

    for (const [rawTicker, entry] of Object.entries(cache || {})) {
      const ticker = normalizeTicker(rawTicker);
      const fetchedAt = Number(entry?.fetchedAt);
      const quote = normalizeQuote(entry?.data, ticker);

      if (
        !ticker ||
        !quote ||
        !Number.isFinite(fetchedAt) ||
        now - fetchedAt > PERSISTED_QUOTE_MAX_AGE_MS ||
        !Number.isFinite(quote.c)
      ) {
        continue;
      }

      persisted[ticker] = {
        data: quote,
        fetchedAt,
      };
    }

    window.localStorage.setItem(
      PERSISTED_QUOTE_CACHE_KEY,
      JSON.stringify(persisted),
    );
  } catch (error) {
    console.warn("Unable to persist quote cache:", error);
  }
}

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const initialQuoteCacheRef = useRef(null);

  if (initialQuoteCacheRef.current === null) {
    initialQuoteCacheRef.current = readPersistedQuoteCache();
  }

  const [quotes, setQuotes] = useState(() =>
    quoteMapFromCache(initialQuoteCacheRef.current),
  );
  const tickersRef = useRef([]);
  const quoteCacheRef = useRef(initialQuoteCacheRef.current);

  const loadQuotes = useCallback(
    async (tickers, { force = false } = {}) => {
      if (!user?.id) {
        return {};
      }

      const normalizedTickers = normalizeTickerList(tickers);

      if (!normalizedTickers.length) {
        return {};
      }

      tickersRef.current = normalizeTickerList([
        ...tickersRef.current,
        ...normalizedTickers,
      ]);

      const now = Date.now();
      const resolved = {};
      const needsFetch = [];

      for (const ticker of normalizedTickers) {
        const cached = quoteCacheRef.current[ticker];
        const fresh =
          !force &&
          cached?.data &&
          Number.isFinite(cached?.fetchedAt) &&
          now - cached.fetchedAt < QUOTE_TTL_MS;

        if (cached?.data) {
          resolved[ticker] = cached.data;
        }

        if (!fresh) {
          needsFetch.push(ticker);
        }
      }

      if (Object.keys(resolved).length) {
        setQuotes((previous) => ({
          ...previous,
          ...resolved,
        }));
      }

      if (needsFetch.length) {
        const payload = await financialDatasetsRequest({
          action: "quotes",
          tickers: needsFetch,
        });

        const returnedQuotes = Array.isArray(payload?.quotes)
          ? payload.quotes
          : [];

        const byTicker = new Map(
          returnedQuotes
            .map((quote) => {
              const normalized = normalizeQuote(quote);
              return normalized ? [normalized.ticker, normalized] : null;
            })
            .filter(Boolean),
        );

        for (const ticker of needsFetch) {
          const returnedQuote = byTicker.get(ticker);
          const previousCached = quoteCacheRef.current[ticker];

          if (returnedQuote && Number.isFinite(returnedQuote.c)) {
            quoteCacheRef.current[ticker] = {
              data: returnedQuote,
              fetchedAt: Date.now(),
            };

            resolved[ticker] = returnedQuote;
            continue;
          }

          if (previousCached?.data) {
            resolved[ticker] = previousCached.data;
            continue;
          }

          const emptyQuote = normalizeQuote(
            {
              ticker,
              c: null,
              d: null,
              dp: null,
              h: null,
              l: null,
              o: null,
              pc: null,
              t: null,
            },
            ticker,
          );

          resolved[ticker] = emptyQuote;
        }

        persistQuoteCache(quoteCacheRef.current);
      }

      setQuotes((previous) => ({
        ...previous,
        ...resolved,
      }));

      return resolved;
    },
    [user?.id],
  );

  const refreshQuotes = useCallback(
    async (tickers) => {
      const requestedTickers =
        Array.isArray(tickers) && tickers.length
          ? tickers
          : tickersRef.current;

      /*
       * Persisted last-known prices stay visible while this refresh runs.
       * Force only bypasses the browser cache freshness check. The Financial
       * Datasets Edge Function can still satisfy the request from StockPulse's
       * shared persistent market_data_cache before calling the provider.
       */
      return loadQuotes(requestedTickers, { force: true });
    },
    [loadQuotes],
  );

  const fetchQuotes = useCallback(
    async (tickers) => loadQuotes(tickers, { force: false }),
    [loadQuotes],
  );

  const value = useMemo(
    () => ({
      quotes,
      refreshQuotes,
      fetchQuotes,
    }),
    [quotes, refreshQuotes, fetchQuotes],
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
