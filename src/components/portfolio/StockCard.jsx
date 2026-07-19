import React, { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function BuyDialog({ open, onOpenChange, stock, onDone }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(
    stock?.current_price?.toFixed(2) || stock?.purchase_price?.toFixed(2) || ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stock?.id) return;

    setLoading(true);
    const qty = parseFloat(quantity);
    const price = parseFloat(purchasePrice);

    try {
      // Get current user ID safely
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Calculate new weighted average cost
      const newQty = stock.quantity + qty;
      const newAvgCost = ((stock.purchase_price * stock.quantity) + (price * qty)) / newQty;

      // Update stock
      const { error: updateError } = await supabase
        .from("stocks")
        .update({
          quantity: newQty,
          purchase_price: +newAvgCost.toFixed(4),
          current_price: stock.current_price || price,
        })
        .eq("id", stock.id)
        .eq("user_id", currentUser.id); // Extra safety

      if (updateError) throw updateError;

      // Insert transaction
      const { error: txError } = await supabase.from("stock_transactions").insert({
        user_id: currentUser.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "buy",
        quantity: qty,
        price,
        total: qty * price,
      });

      if (txError) throw txError;

      onDone?.();
      onOpenChange(false);
      setQuantity("");
    } catch (error) {
      console.error("Buy error:", error);
      alert("Failed to buy shares. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Buy {stock?.ticker}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{stock?.company_name}</p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
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
              <Label>Purchase Price</Label>
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
          <Button type="submit" className="w-full" disabled={loading || !quantity || !purchasePrice}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Buy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellDialog({ open, onOpenChange, stock, onDone }) {
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const max = stock?.quantity || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stock?.id) return;

    setLoading(true);
    const sellQty = parseFloat(quantity);
    const sellPrice = stock.current_price || stock.purchase_price;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Record transaction
      await supabase.from("stock_transactions").insert({
        user_id: currentUser.id,
        ticker: stock.ticker.toUpperCase(),
        company_name: stock.company_name,
        type: "sell",
        quantity: sellQty,
        price: sellPrice,
        total: sellQty * sellPrice,
      });

      if (sellQty >= max) {
        await supabase.from("stocks").delete().eq("id", stock.id);
      } else {
        await supabase
          .from("stocks")
          .update({ quantity: parseFloat((max - sellQty).toFixed(6)) })
          .eq("id", stock.id);
      }

      onDone?.();
      onOpenChange(false);
      setQuantity("");
    } catch (error) {
      console.error("Sell error:", error);
      alert("Failed to sell shares. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Sell {stock?.ticker}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {stock?.company_name} · {max} shares held
        </p>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Shares to Sell</Label>
            <div className="relative">
              <Input
                type="number"
                step="any"
                min="0.01"
                max={max}
                placeholder=""
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity(String(max))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                all
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !quantity || parseFloat(quantity) <= 0}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockCard({ stock, onRefresh }) {
  const totalValue = (stock.current_price || 0) * stock.quantity;
  const totalCost = stock.purchase_price * stock.quantity;
  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
  const isPositive = gain >= 0;

  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  return (
    <>
      <BuyDialog open={buyOpen} onOpenChange={setBuyOpen} stock={stock} onDone={() => onRefresh?.()} />
      <SellDialog open={sellOpen} onOpenChange={setSellOpen} stock={stock} onDone={() => onRefresh?.()} />

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 transition-all duration-200">
        <div className="flex items-start justify-between mb-4">
          <Link to={`/stock/${stock.id}`} className="group flex-1 min-w-0">
            <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">{stock.sector}</span>
            <h3 className="font-heading text-lg font-bold mt-0.5 text-gray-900">{stock.ticker}</h3>
            <p className="text-sm text-gray-500 truncate max-w-[180px]">{stock.company_name}</p>
          </Link>

          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <button
              onClick={() => setBuyOpen(true)}
              className="h-8 px-3 text-xs font-semibold rounded-md bg-black text-white hover:bg-gray-800 active:scale-95 transition-all"
            >
              Buy
            </button>
            <button
              onClick={() => setSellOpen(true)}
              className="h-8 px-3 text-xs font-semibold rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Sell
            </button>
          </div>
        </div>

        <Link to={`/stock/${stock.id}`}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Price</p>
              <p className="font-semibold text-sm text-gray-900">${stock.current_price?.toFixed(2) || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Shares</p>
              <p className="font-semibold text-sm text-gray-900">{stock.quantity}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Value</p>
              <p className="font-semibold text-sm text-gray-900">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
            <p className={`text-sm font-medium ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}${gain.toFixed(2)} total
            </p>
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? "+" : ""}{gainPct.toFixed(1)}%
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}
