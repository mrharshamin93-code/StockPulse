import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const MarketDataContext = createContext({ quotes: {}, refreshQuotes: () => {} });

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});
  const tickersRef = useRef([]);

  const refreshQuotes = useCallback(async (tickers) => {
    const list = tickers || tickersRef.current;
    if (!list.length) return;

    try {
      const tickersParam = list.join(",");
      const response = await fetch(`/api/finnhub?action=quotes&tickers=${encodeURIComponent(tickersParam)}`);
      
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.quotes) {
        setQuotes(data.quotes);
      } else if (data.error) {
        console.error("Finnhub quotes error:", data.error);
      }
    } catch (error) {
      console.error("Failed to refresh quotes:", error);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    // Start with a reasonable default set (can be expanded later)
    tickersRef.current = ["AAPL", "TSLA", "NVDA"];
    refreshQuotes(tickersRef.current);
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
