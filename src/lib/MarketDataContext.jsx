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

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});
  const tickersRef = useRef([]);
  const quoteCacheRef = useRef({});

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

        if (fresh) {
          resolved[ticker] = cached.data;
        } else {
          needsFetch.push(ticker);
        }
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
          const quote =
            byTicker.get(ticker) ||
            normalizeQuote(
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

          quoteCacheRef.current[ticker] = {
            data: quote,
            fetchedAt: Date.now(),
          };

          resolved[ticker] = quote;
        }
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
       * Force only bypasses the browser-memory cache.
       * The Financial Datasets Edge Function still goes through StockPulse's
       * shared persistent market_data_cache, so a page refresh does not
       * necessarily consume a provider request.
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
