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
    console.log("Refreshing quotes for:", list); // TODO: Add real API later
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    // Mock data for now
    tickersRef.current = ["AAPL", "TSLA", "NVDA"];
    refreshQuotes(tickersRef.current);
  }, [user?.id]);

  return (
    <MarketDataContext.Provider value={{ quotes, refreshQuotes }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
