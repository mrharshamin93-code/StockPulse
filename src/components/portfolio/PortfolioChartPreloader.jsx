import { useEffect } from "react";

import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { cachePortfolioStocks } from "@/lib/portfolioCache";
import { prefetchPortfolioGrowthChart } from "@/components/portfolio/PortfolioGrowthChart";

export default function PortfolioChartPreloader() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;

    async function preload() {
      try {
        const [stocksResult, watchlistResult] = await Promise.all([
          supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("watchlist_items")
            .select("ticker")
            .eq("user_id", user.id),
        ]);

        if (cancelled) return;
        if (stocksResult.error) throw stocksResult.error;
        if (watchlistResult.error) throw watchlistResult.error;

        const watchlistTickers = new Set(
          (watchlistResult.data || [])
            .map((item) => String(item?.ticker || "").trim().toUpperCase())
            .filter(Boolean),
        );
        const stocks = (stocksResult.data || [])
          .filter((stock) => stock?.id && stock.id !== "undefined")
          .filter((stock) =>
            watchlistTickers.has(
              String(stock?.ticker || "").trim().toUpperCase(),
            ),
          );

        cachePortfolioStocks(user.id, stocks);

        if (stocks.length) {
          await prefetchPortfolioGrowthChart({
            userId: user.id,
            stocks,
            period: "1M",
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Portfolio chart background preload failed:", error);
        }
      }
    }

    void preload();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}
