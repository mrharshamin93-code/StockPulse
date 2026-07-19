import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";


export default function Home() {
  const { user, isLoadingAuth } = useAuth();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHoldings = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from("stocks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setHoldings(data);
    }
  };

  // Realtime updates
  useEffect(() => {
    if (!user?.id) return;

    fetchHoldings();

    const channel = supabase
      .channel(`portfolio-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stocks", filter: `user_id=eq.${user.id}` },
        () => fetchHoldings()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHoldings();
    setRefreshing(false);
  };

  if (isLoadingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground text-sm">Your current holdings overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* === Your Original PortfolioSummary (migrated) === */}
      <div className="mb-8">
        <PortfolioSummary stocks={holdings} />
      </div>

      {/* Holdings List */}
      {holdings.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <span className="font-semibold">Holdings ({holdings.length})</span>
          </div>
          
          <div className="divide-y">
            {holdings.map((stock) => {
              const currentPrice = stock.current_price || stock.purchase_price || 0;
              const value = currentPrice * (stock.quantity || 0);
              const cost = (stock.purchase_price || 0) * (stock.quantity || 0);
              const gain = value - cost;
              const gainPct = cost > 0 ? (gain / cost) * 100 : 0;

              return (
                <div key={stock.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <div className="font-semibold">{stock.ticker}</div>
                    <div className="text-xs text-muted-foreground">
                      {stock.quantity} × ${stock.purchase_price?.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${value.toFixed(2)}</div>
                    <div className={`text-xs ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {gain >= 0 ? "+" : ""}${gain.toFixed(2)} ({gainPct.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-gray-100 rounded-3xl">
          <Briefcase className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-muted-foreground">No holdings yet. Add stocks from your Watchlist.</p>
        </div>
      )}
    </div>
  );
}
