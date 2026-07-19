import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, Briefcase, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import StockCard from "@/components/portfolio/StockCard";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import PortfolioGrowthChart from "@/components/portfolio/PortfolioGrowthChart";
import PortfolioOnboarding from "@/components/portfolio/PortfolioOnboarding";

const PULL_THRESHOLD = 72;

export default function Home() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const touchStartY = useRef(null);
  const scrollRef = useRef(null);
  const lastPriceRefresh = useRef(0);
  const priceRefreshCooldown = 30000; // 30 seconds

  // Load stocks from Supabase
  const loadStocks = useCallback(async ({ refreshPrices = false } = {}) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading stocks:", error);
      return;
    }

    setStocks(data || []);

    // Optional: Price refresh logic (only if you have a Finnhub Edge Function)
    const now = Date.now();
    if (data?.length > 0 && (refreshPrices || now - lastPriceRefresh.current > priceRefreshCooldown)) {
      lastPriceRefresh.current = now;
      // TODO: Replace with your Supabase Edge Function call for Finnhub quotes if needed
      // Example: await supabase.functions.invoke("get-stock-quotes", { body: { tickers } })
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    if (user?.id) {
      loadStocks({ refreshPrices: true }).finally(() => setLoading(false));
    }
  }, [user?.id, loadStocks]);

  // Realtime updates (replaces base44 subscription)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`stocks-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `user_id=eq.${user.id}` },
        () => loadStocks()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id, loadStocks]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    if (scrollRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      await loadStocks({ refreshPrices: true });
      setRefreshing(false);
    }
    setPullDistance(0);
    touchStartY.current = null;
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)", backgroundColor: "hsl(var(--background))" }}
    >
      {/* Header */}
      <header
        className="border-b border-gray-100 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "hsl(var(--background))" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-gray-900">StockPulse</h1>
              <p className="text-xs text-gray-500">Stock Insights and Analysis</p>
            </div>
          </div>
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || refreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: refreshing ? 48 : pullDistance, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center justify-center overflow-hidden bg-gray-50/50"
          >
            <motion.div
              animate={{ rotate: refreshing ? 360 : pullProgress * 180 }}
              transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
            >
              <RefreshCw className={`w-5 h-5 ${pullProgress >= 1 || refreshing ? "text-gray-900" : "text-gray-400"}`} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        ref={scrollRef}
        className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : stocks.length === 0 ? (
          <PortfolioOnboarding onStockAdded={loadStocks} />
        ) : (
          <>
            <PortfolioSummary stocks={stocks} />
            <PortfolioGrowthChart stocks={stocks} />

            <div>
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4 text-center">
                Holdings · {stocks.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stocks.map((stock) => (
                  <StockCard key={stock.id} stock={stock} onRefresh={loadStocks} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
