import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

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
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampSeconds(value) {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}

function mapDatabaseQuote(row) {
  const ticker = normalizeTicker(row?.symbol);
  if (!ticker) return null;

  return {
    ticker,
    c: finiteNumber(row?.price),
    d: finiteNumber(row?.change_amount),
    dp: finiteNumber(row?.change_percent),
    h: finiteNumber(row?.day_high),
    l: finiteNumber(row?.day_low),
    o: finiteNumber(row?.open_price),
    pc: finiteNumber(row?.previous_close),
    t: timestampSeconds(row?.market_timestamp || row?.quote_updated_at),
  };
}

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});
  const tickersRef = useRef([]);
  const quoteCacheRef = useRef({});

  const loadDatabaseQuotes = useCallback(
    async (tickers, { force = false } = {}) => {
      if (!user?.id) return {};

      const normalizedTickers = normalizeTickerList(tickers);
      if (!normalizedTickers.length) return {};

      tickersRef.current = normalizeTickerList([
        ...tickersRef.current,
        ...normalizedTickers,
      ]);

      const now = Date.now();
      const resolved = {};
      const needsDatabase = [];

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
          needsDatabase.push(ticker);
        }
      }

      if (needsDatabase.length) {
        const { data, error } = await supabase
          .from("stock_screener_stocks")
          .select(
            "symbol,price,change_amount,change_percent,open_price,day_high,day_low,previous_close,market_timestamp,quote_updated_at",
          )
          .in("symbol", needsDatabase);

        if (error) {
          throw new Error(error.message || "Unable to load cached market quotes.");
        }

        const rowsByTicker = new Map(
          (data || []).map((row) => [normalizeTicker(row?.symbol), row]),
        );

        for (const ticker of needsDatabase) {
          const mapped = mapDatabaseQuote(rowsByTicker.get(ticker));
          const quote = mapped || {
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
        Array.isArray(tickers) && tickers.length ? tickers : tickersRef.current;

      // Refreshes from StockPulse's Supabase cache only.
      // Browser/page refreshes never call Financial Datasets for quotes.
      return loadDatabaseQuotes(requestedTickers, { force: true });
    },
    [loadDatabaseQuotes],
  );

  const fetchQuotes = useCallback(
    async (tickers) => loadDatabaseQuotes(tickers, { force: false }),
    [loadDatabaseQuotes],
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
