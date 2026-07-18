import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { TrendingUp, BarChart2, Brain, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  { icon: TrendingUp, label: "Track your portfolio", desc: "Monitor all your holdings in one place" },
  { icon: BarChart2, label: "Real-time market data", desc: "Live prices and performance metrics" },
  { icon: Brain, label: "AI Insights", desc: "Smart analysis and news summaries" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSkip = () => navigate("/");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Look up the stock ticker "${ticker.toUpperCase()}". Return the company name, current market price, and sector.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            company_name: { type: "string" },
            current_price: { type: "number" },
            sector: { type: "string" }
          }
        }
      });

      if (!result?.valid) {
        setError("Ticker not found. Please check and try again.");
        setLoading(false);
        return;
      }

      await base44.entities.Stock.create({
        ticker: ticker.toUpperCase(),
        company_name: result.company_name,
        quantity: parseFloat(quantity),
        purchase_price: parseFloat(purchasePrice),
        current_price: result.current_price,
        sector: result.sector,
      });

      navigate("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold">StockPulse</span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2">Add Your First Stock</h1>
          <p className="text-sm text-muted-foreground">Start by adding a stock you own to begin tracking your portfolio.</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {STEPS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="w-3 h-3" />
              {label}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <div className="space-y-1.5">
              <Label>Ticker Symbol</Label>
              <Input
                placeholder="e.g. AAPL, TSLA"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                required
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shares</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min="0.001"
                  step="any"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Avg. Buy Price ($)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 150.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  required
                  min="0.01"
                  step="any"
                  className="h-11"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Add Stock & Continue
            </Button>
          </form>
        </div>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Skip for now
        </button>
      </div>
    </div>
  );
}