import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const MarketDataContext = createContext({
  quotes: {},
  refreshQuotes: () => {},
});

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});
  const tickersRef = useRef([]);

  const refreshQuotes = useCallback(async (tickers) => {
    const rawList = Array.isArray(tickers) && tickers.length ? tickers : tickersRef.current;
    const list = [...new Set((rawList || []).map((ticker) => String(ticker).trim().toUpperCase()).filter(Boolean))];

    if (!list.length) return;

    tickersRef.current = list;

    try {
      const tickersParam = list.join(",");
      const response = await fetch(`/api/finnhub?action=quotes&tickers=${encodeURIComponent(tickersParam)}`);

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data?.quotes)) {
        const mappedQuotes = data.quotes.reduce((acc, quote) => {
          if (quote?.ticker) {
            acc[quote.ticker] = quote;
          }
          return acc;
        }, {});

        setQuotes((prev) => ({
          ...prev,
          ...mappedQuotes,
        }));
      } else if (data?.error) {
        console.error("Finnhub quotes error:", data.error);
      }
    } catch (error) {
      console.error("Failed to refresh quotes:", error);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setQuotes({});
      tickersRef.current = [];
      return;
    }

    if (tickersRef.current.length) {
      refreshQuotes(tickersRef.current);
    }
  }, [user?.id, refreshQuotes]);

  return (
    <MarketDataContext.Provider value={{ quotes, refreshQuotes }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
