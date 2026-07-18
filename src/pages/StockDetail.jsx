import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StockDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load stock data later
    setStock({
      id,
      ticker: "AAPL",
      company_name: "Apple Inc.",
      current_price: 225.50,
      quantity: 10,
      purchase_price: 180.00
    });
    setLoading(false);
  }, [id]);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-black">
        ← Back
      </button>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h1 className="text-4xl font-bold">{stock.ticker}</h1>
        <p className="text-xl text-muted-foreground">{stock.company_name}</p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-muted-foreground">Current Price</p>
            <p className="text-5xl font-semibold mt-1">${stock.current_price}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Holdings</p>
            <p className="text-5xl font-semibold mt-1">{stock.quantity} shares</p>
          </div>
        </div>

        <div className="mt-12 flex gap-3">
          <Button onClick={() => alert("Buy coming soon")} className="flex-1 h-12">Buy More</Button>
          <Button variant="outline" onClick={() => alert("Sell coming soon")} className="flex-1 h-12">Sell</Button>
        </div>
      </div>
    </div>
  );
}
