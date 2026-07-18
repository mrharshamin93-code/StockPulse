import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

export default function AddStockDialog({ onStockAdded }) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tickerValid, setTickerValid] = useState(null);
  const [validating, setValidating] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const clean = ticker.trim().toUpperCase();

    if (!clean) {
      setTickerValid(null);
      setError("");
      return;
    }

    setValidating(true);
    setTickerValid(null);
    setError("");

    if (clean.length < 2) {
      setValidating(false);
      return;
    }

    let cancelled = false;
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const attempt = async () => {
        const res = await fetch(`/api/finnhub?action=quote&ticker=${encodeURIComponent(clean)}`);
        if (!res.ok) {
          throw new Error("Failed to validate ticker");
        }
        return res.json();
      };

      let data;

      try {
        data = await attempt();
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          data = await attempt();
        } catch {
          if (!cancelled) setValidating(false);
          return;
        }
      }

      if (cancelled) return;

      if (!data?.c || data.c === 0) {
        setTickerValid(false);
        setError(`"${clean}" doesn't appear to be a valid ticker symbol.`);
      } else {
        setTickerValid(true);
        setError("");
      }

      setValidating(false);
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [ticker]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tickerValid || !user?.id) return;

    setError("");
    setLoading(true);

    const cleanTicker = ticker.trim().toUpperCase();

    let company_name = cleanTicker;
    let exchange = "";

    try {
      const profileRes = await fetch(
        `/api/finnhub?action=profile&ticker=${encodeURIComponent(cleanTicker)}`
      );

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData?.name) company_name = profileData.name;
        if (profileData?.exchange) exchange = profileData.exchange;
      }
    } catch {}

    let current_price = parseFloat(purchasePrice);

    try {
      const quoteRes = await fetch(
        `/api/finnhub?action=quote&ticker=${encodeURIComponent(cleanTicker)}`
      );

      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        if (quoteData?.c) current_price = quoteData.c;
      }
    } catch {}

    const { error: stockError } = await supabase.from("stocks").insert({
      user_id: user.id,
      ticker: cleanTicker,
      company_name,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price,
    });

    if (stockError) {
      setLoading(false);
      setError(stockError.message || "Failed to add stock.");
      return;
    }

    try {
      const { data: existing } = await supabase
        .from("watchlist_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("ticker", cleanTicker)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("watchlist_items").insert({
          user_id: user.id,
          ticker: cleanTicker,
          company_name,
          exchange,
        });
      }
    } catch {}

    setLoading(false);
    setOpen(false);
    setTicker("");
    setQuantity("");
    setPurchasePrice("");
    setError("");
    setTickerValid(null);
    onStockAdded?.();
  };

  const handleOpenChange = (val) => {
    setOpen(val);
    if (!val) {
      setTicker("");
      setQuantity("");
      setPurchasePrice("");
      setError("");
      setTickerValid(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center border border-white/60 active:scale-95 transition-transform">
          <Plus className="w-6 h-6 text-gray-800" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Add to Portfolio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Ticker Symbol</Label>
            <div className="relative">
              <Input
                placeholder="e.g. AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="uppercase font-mono pr-9"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validating && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {!validating && tickerValid === true && (
                  <CheckCircle2 className="w-4 h-4 text-black" />
                )}
                {!validating && tickerValid === false && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shares</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Avg. Purchase Price</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="150.00"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !tickerValid || validating || !quantity || !purchasePrice}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {loading ? "Validating…" : "Add to Portfolio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
