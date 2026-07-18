import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import StockCard from "@/components/portfolio/StockCard";

export default function Watchlist() {
  const { user } = useAuth();
  const { quotes } = useMarketData();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    // Mock data for now - replace with real API later
    setStocks([
      { id: 1, ticker: "AAPL", company_name: "Apple Inc.", quantity: 10, purchase_price: 180, current_price: 225.5, sector: "Technology" },
      { id: 2, ticker: "TSLA", company_name: "Tesla Inc.", quantity: 5, purchase_price: 250, current_price: 260, sector: "Automotive" },
    ]);
    setLoading(false);
  }, [user?.id]);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  if (loading) return <div className="p-8">Loading watchlist...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-heading text-3xl font-bold">Watchlist</h1>
        <Button onClick={refresh}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stocks.map(stock => (
          <StockCard key={stock.id} stock={stock} onRefresh={refresh} />
        ))}
      </div>

      {stocks.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No stocks in watchlist yet. Add some to get started.</p>
      )}
    </div>
  );
}
