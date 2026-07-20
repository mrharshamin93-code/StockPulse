import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase"; // ← Make sure this exists
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { Loader2, Star, Plus, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

// ==================== HELPER FUNCTIONS (unchanged) ====================
function abbreviateExchange(exchange) {
  // ... (keep your entire abbreviateExchange function as is)
}

function getCompanyName(ticker, stock, item) {
  // ... (keep your entire getCompanyName function as is)
}

// ==================== TOAST (unchanged) ====================
function Toast({ message, onDone }) {
  // ... (keep your Toast component as is)
}

// ==================== ADD TO PORTFOLIO DIALOG (updated) ====================
function AddToPortfolioDialog({ open, onOpenChange, ticker, companyName, onAdded }) {
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    let currentPrice = parseFloat(purchasePrice);

    try {
      const { data: res } = await supabase.functions.invoke("finnhub", {
        body: { action: "quote", ticker },
      });
      if (res?.c) currentPrice = res.c;
    } catch (err) {
      console.error("Failed to fetch current price:", err);
    }

    const { error } = await supabase.from("stocks").insert({
      user_id: user.id,
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      current_price: currentPrice,
      sector: "",
    });

    setLoading(false);

    if (error) {
      console.error("Error adding to portfolio:", error);
      alert("Failed to add to portfolio");
      return;
    }

    setQuantity("");
    setPurchasePrice("");
    onAdded();
  };

  return (
    // ... (keep the rest of the dialog JSX exactly the same)
  );
}

// ==================== MiniSparkline & AnimatedPrice (unchanged) ====================
function MiniSparkline({ isPositive }) { /* ... keep as is ... */ }
function AnimatedPrice({ value }) { /* ... keep as is ... */ }

// ==================== WATCHLIST CARD (mostly unchanged) ====================
function WatchlistCard({ item, stock, quote, onRemove, onStarToggle, index }) {
  // ... (keep the entire WatchlistCard component as is)
}

// ==================== MAIN COMPONENT ====================
export default function Watchlist() {
  const { user } = useAuth();
  const { quotes: globalQuotes, refreshQuotes } = useMarketData();

  const [items, setItems] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [quotes, setQuotes] = useState(globalQuotes);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialogItem, setDialogItem] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeout = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.contains(e.target) && !suggestionsRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search suggestions
  useEffect(() => {
    const q = ticker.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data: res } = await supabase.functions.invoke("finnhub", {
          body: { action: "search", query: q },
        });
        setSuggestions(res?.results || []);
      } catch {
        setSuggestions([]);
      }
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [ticker]);

  // ==================== LOAD DATA ====================
  const load = async () => {
    if (!user?.id) return [];

    const [watchRes, stockRes] = await Promise.all([
      supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("stocks")
        .select("*")
        .eq("user_id", user.id),
    ]);

    const watchData = watchRes.data || [];
    const stockData = stockRes.data || [];

    setItems(watchData);
    setStocks(stockData);

    // Seed quotes from cached values
    const seedQuotes = {};
    [...watchData, ...stockData].forEach((item) => {
      const t = item.ticker.toUpperCase();
      if (item.cached_price && !seedQuotes[t]) {
        seedQuotes[t] = {
          c: item.cached_price,
          dp: item.cached_change_pct,
          d: item.cached_change,
        };
      }
    });

    if (Object.keys(seedQuotes).length > 0) {
      setQuotes((prev) => ({ ...seedQuotes, ...prev }));
    }

    // Backfill exchange/company_name if missing
    const missing = watchData.filter((i) => !i.exchange || !i.company_name);
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (item) => {
          try {
            const { data: res } = await supabase.functions.invoke("finnhub", {
              body: { action: "profile", ticker: item.ticker },
            });
            const updates = {};
            if (res?.exchange) updates.exchange = res.exchange;
            if (res?.name) updates.company_name = res.name;

            if (Object.keys(updates).length > 0) {
              await supabase
                .from("watchlist_items")
                .update(updates)
                .eq("id", item.id);
            }
          } catch (err) {
            console.error("Backfill error:", err);
          }
        })
      );

      // Reload after backfill
      const { data: updated } = await supabase
        .from("watchlist_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setItems(updated || []);
      return updated || [];
    }

    return watchData;
  };

  // Sync global quotes
  useEffect(() => {
    if (Object.keys(globalQuotes).length > 0) {
      setQuotes((prev) => ({ ...prev, ...globalQuotes }));
    }
  }, [globalQuotes]);

  // Initial load
  useEffect(() => {
    if (user?.id) {
      load().then((watchData) => {
        setLoading(false);
        if (watchData?.length) {
          refreshQuotes(watchData.map((i) => i.ticker.toUpperCase()));
        }
      });
    }
  }, [user?.id]);

  // ==================== REALTIME SUBSCRIPTIONS ====================
  // Stocks (Portfolio)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("stocks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stocks",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id)
            .then(({ data }) => setStocks(data || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Watchlist Items
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("watchlist-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlist_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          supabase
            .from("watchlist_items")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => setItems(data || []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ==================== ADD TICKER ====================
  const addTicker = async (symbol, exchange = "") => {
    symbol = symbol.trim().toUpperCase();
    if (!symbol || !user) return;

    const alreadyExists = items.some(
      (i) => i.ticker.toUpperCase() === symbol
    );
    if (alreadyExists) {
      setToast(`"${symbol}" is already in your watchlist.`);
      return;
    }

    setAdding(true);
    setShowSuggestions(false);

    let company_name = "";
    let finalExchange = exchange;

    try {
      const { data: profileRes } = await supabase.functions.invoke("finnhub", {
        body: { action: "profile", ticker: symbol },
      });
      company_name = profileRes?.name || "";
      if (!finalExchange && profileRes?.exchange) {
        finalExchange = profileRes.exchange;
      }
    } catch (err) {
      console.error("Profile fetch failed:", err);
    }

    const { error } = await supabase.from("watchlist_items").insert({
      user_id: user.id,
      ticker: symbol,
      exchange: finalExchange,
      company_name,
    });

    setTicker("");
    setAdding(false);

    if (error) {
      console.error("Error adding to watchlist:", error);
      setToast("Failed to add ticker");
      return;
    }

    const watchData = await load();
    if (watchData?.length) {
      refreshQuotes(watchData.map((i) => i.ticker.toUpperCase()));
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    addTicker(ticker, "");
  };

  // ==================== REMOVE ====================
  const handleRemove = async (id) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));

    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("id", id);

    if (error) {
      setItems(previous);
      setToast("Failed to remove — please try again.");
    }
  };

  // ==================== STAR TOGGLE ====================
  const handleStarToggle = async (item, stock) => {
    if (stock) {
      // Remove from portfolio
      const previous = stocks;
      setStocks((prev) => prev.filter((s) => s.id !== stock.id));

      const { error } = await supabase.from("stocks").delete().eq("id", stock.id);

      if (error) {
        setStocks(previous);
        setToast("Failed to update — please try again.");
      } else {
        setToast(`${item.ticker} removed from portfolio`);
      }
    } else {
      const companyName = getCompanyName(item.ticker, null, item);
      setDialogItem({ ticker: item.ticker, companyName });
    }
  };

  const handlePortfolioAdded = async () => {
    const tickerSymbol = dialogItem?.ticker;
    setDialogItem(null);
    await load();
    if (tickerSymbol) setToast(`${tickerSymbol} added to portfolio`);
  };

  const findStock = (tickerSymbol) =>
    stocks.find((s) => s.ticker.toUpperCase() === tickerSymbol.toUpperCase());

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen flex flex-col" /* ... keep your styling ... */>
      <AnimatePresence>{toast && <Toast message={toast} onDone={() => setToast(null)} />}</AnimatePresence>

      {dialogItem && (
        <AddToPortfolioDialog
          open={true}
          onOpenChange={() => setDialogItem(null)}
          ticker={dialogItem.ticker}
          companyName={dialogItem.companyName}
          onAdded={handlePortfolioAdded}
        />
      )}

      {/* Header + Search + List — keep exactly as you had it */}
      {/* ... your existing JSX from <header> to the end ... */}
    </div>
  );
}
