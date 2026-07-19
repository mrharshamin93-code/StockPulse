import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

async function callFinnhub(params) {
  const searchParams = new URLSearchParams(params).toString();
  const res = await fetch(`/api/finnhub?${searchParams}`);

  if (!res.ok) {
    throw new Error("Failed to fetch Finnhub data");
  }

  return res.json();
}

export default function StockDetail() {
  const { ticker: routeTicker } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quotes, fetchQuotes } = useMarketData();

  const ticker = useMemo(
    () => String(routeTicker || "").trim().toUpperCase(),
    [routeTicker]
  );

  const [companyName, setCompanyName] = useState(ticker);
  const [holding, setHolding] = useState(null);
  const [watchlistItem, setWatchlistItem] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [holdingLoading, setHoldingLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    fetchQuotes([ticker]);
  }, [ticker, fetchQuotes]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileData() {
      if (!ticker || !user?.id) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const [{ data: stockRow }, { data: watchlistRow }] = await Promise.all([
          supabase
            .from("stocks")
            .select("ticker, company_name")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .maybeSingle(),
          supabase
            .from("watchlist_items")
            .select("ticker, company_name")
            .eq("user_id", user.id)
            .eq("ticker", ticker)
            .maybeSingle(),
        ]);

        const localName =
          stockRow?.company_name ||
          watchlistRow?.company_name ||
          "";

        if (localName && !cancelled) {
          setCompanyName(localName);
        }

        if (!localName) {
          const profile = await callFinnhub({ action: "profile", ticker });
          if (!cancelled) {
            setCompanyName(profile?.name || ticker);
          }
        }

        if (!cancelled) {
          setWatchlistItem(watchlistRow || null);
        }
      } catch {
        if (!cancelled) {
          setCompanyName(ticker);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadProfileData();

    return () => {
      cancelled = true;
    };
  }, [ticker, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadHolding() {
      if (!ticker || !user?.id) {
        setHolding(null);
        setHoldingLoading(false);
        return;
      }

      setHoldingLoading(true);

      try {
        const { data } = await supabase
          .from("stocks")
          .select("*")
          .eq("user_id", user.id)
          .eq("ticker", ticker)
          .maybeSingle();

        if (!cancelled) {
          setHolding(data || null);
        }
      } catch {
        if (!cancelled) {
          setHolding(null);
        }
      } finally {
        if (!cancelled) {
          setHoldingLoading(false);
        }
      }
    }

    loadHolding();

    return () => {
      cancelled = true;
    };
  }, [ticker, user?.id]);

  const quote = quotes[ticker];
  const currentPrice =
    typeof quote?.c === "number"
      ? quote.c
      : typeof holding?.current_price === "number"
        ? holding.current_price
        : null;

  const ownedQuantity =
    typeof holding?.quantity === "number" ? holding.quantity : 0;

  const isOwned = !!holding;
  const isLoading = profileLoading || holdingLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-sm text-muted-foreground hover:text-black"
      >
        ← Back
      </button>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold">{ticker}</h1>
        <p className="text-xl text-muted-foreground">{companyName || ticker}</p>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Current Price</p>
            <p className="mt-1 text-5xl font-semibold">
              {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "—"}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Your Holdings</p>
            <p className="mt-1 text-5xl font-semibold">
              {isOwned ? `${ownedQuantity} shares` : "Not owned"}
            </p>
          </div>
        </div>

        {!isOwned && watchlistItem && (
          <p className="mt-4 text-sm text-muted-foreground">
            This stock is in your watchlist but not yet in your portfolio.
          </p>
        )}

        <div className="mt-12 flex gap-3">
          <Button
            onClick={() => alert(isOwned ? "Buy more coming soon" : "Buy coming soon")}
            className="h-12 flex-1"
          >
            {isOwned ? "Buy More" : "Buy"}
          </Button>

          {isOwned && (
            <Button
              variant="outline"
              onClick={() => alert("Sell coming soon")}
              className="h-12 flex-1"
            >
              Sell
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
