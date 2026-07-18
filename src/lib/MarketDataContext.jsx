import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
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
      const res = await base44.functions.invoke("finnhub", { action: "quotes", tickers: list });
      const quotesArr = res?.data?.quotes;
      if (quotesArr?.length) {
        const q = {};
        quotesArr.forEach(r => { if (r.c) q[r.ticker.toUpperCase()] = r; });
        setQuotes(prev => ({ ...prev, ...q }));
      }
    } catch {}
  }, []);

  // On login, load watchlist tickers and pre-fetch quotes immediately
  useEffect(() => {
    if (!user?.id) return;
    base44.entities.WatchlistItem.filter({ created_by_id: user.id }).then(items => {
      const tickers = items.map(i => i.ticker.toUpperCase());
      tickersRef.current = tickers;
      refreshQuotes(tickers);
    }).catch(() => {});

    // Keep quotes fresh every 60s while app is open
    const interval = setInterval(() => {
      if (tickersRef.current.length) refreshQuotes(tickersRef.current);
    }, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // When watchlist changes, update ticker list and refresh
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = base44.entities.WatchlistItem.subscribe(() => {
      base44.entities.WatchlistItem.filter({ created_by_id: user.id }).then(items => {
        const tickers = items.map(i => i.ticker.toUpperCase());
        tickersRef.current = tickers;
        refreshQuotes(tickers);
      }).catch(() => {});
    });
    return unsubscribe;
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