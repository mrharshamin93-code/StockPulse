import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const MarketDataContext = createContext({
  quotes: {},
  refreshQuotes: async () => {},
});

export function MarketDataProvider({ children }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState({});
  const tickersRef = useRef([]);
  const inFlightRef = useRef(false);

  const refreshQuotes = useCallback(async (tickers) => {
    if (!user?.id) return;

    const requestedTickers = Array.isArray(tickers) && tickers.length ? tickers : tickersRef.current;

    const normalizedTickers = [
      ...new Set(
        (requestedTickers || [])
          .map((ticker) => String(ticker || "").trim().toUpperCase())
          .filter(Boolean)
      ),
    ];

    if (!normalizedTickers.length) return;

    tickersRef.current = normalizedTickers;

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
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
        const ticker = String(quote?.ticker || "").trim().toUpperCase();
        if (!ticker) return acc;

        acc[ticker] = {
          ticker,
          c: typeof quote.c === "number" ? quote.c : null,
          d: typeof quote.d === "number" ? quote.d : null,
          dp: typeof quote.dp === "number" ? quote.dp : null,
          h: typeof quote.h === "number" ? quote.h : null,
          l: typeof quote.l === "number" ? quote.l : null,
          o: typeof quote.o === "number" ? quote.o : null,
          pc: typeof quote.pc === "number" ? quote.pc : null,
          t: quote.t ?? null,
        };

        return acc;
      }, {});

      if (Object.keys(mappedQuotes).length > 0) {
        setQuotes((prev) => ({
          ...prev,
          ...mappedQuotes,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh quotes:", error);
    } finally {
      inFlightRef.current = false;
    }
  }, [user?.id]);

  return (
    <MarketDataContext.Provider
      value={{
        quotes,
        refreshQuotes,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataContext);
}
