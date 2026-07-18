import React from "react";
import { useLocation } from "react-router-dom";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";

function Metric({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function ResultRow({ stock, onAdd }) {
  const changePos = (stock.changePercent ?? 0) >= 0;
  const week52Pos = (stock.week52Change ?? 0) >= 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm">{stock.ticker}</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">
              {stock.exchange}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{stock.name}</p>
          {stock.sector && (
            <p className="text-[10px] text-muted-foreground/50">{stock.sector}</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="font-semibold text-sm">${stock.price?.toFixed(2) ?? "—"}</p>
          {stock.changePercent != null && (
            <div
              className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                changePos ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {changePos ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {changePos ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </div>
          )}
        </div>

        <button
          onClick={() => onAdd(stock)}
          className="text-xs font-medium text-foreground border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0 min-h-[36px]"
        >
          + Watch
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-gray-50 pt-2 sm:grid-cols-8">
        <Metric
          label="52W Chg"
          value={
            stock.week52Change != null ? (
              <span className={week52Pos ? "text-emerald-600" : "text-red-600"}>
                {week52Pos ? "+" : ""}
                {stock.week52Change.toFixed(1)}%
              </span>
            ) : null
          }
        />
        <Metric label="P/E" value={stock.pe != null ? stock.pe.toFixed(1) : null} />
        <Metric label="EPS" value={stock.eps != null ? `
$$
{stock.eps.toFixed(2)}` : null} />
        <Metric label="D/E" value={stock.deRatio != null ? stock.deRatio.toFixed(2) : null} />
        <Metric
          label="Mkt Cap"
          value={stock.marketCapB != null ? `
$$
{stock.marketCapB.toFixed(1)}B` : null}
        />
        <Metric
          label="Div Yield"
          value={stock.dividendYield != null ? `${stock.dividendYield.toFixed(2)}%` : null}
        />
        <Metric label="P/B" value={stock.pb != null ? stock.pb.toFixed(2) : null} />
        <Metric label="ROE %" value={stock.roe != null ? `${stock.roe.toFixed(1)}%` : null} />
      </div>
    </div>
  );
}

export default function ScreenerResults() {
  const { state } = useLocation();
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  const results = state?.results ?? [];
  const loading = state?.loading ?? false;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const addToWatchlist = async (stock) => {
    if (!user?.id) {
      showToast("Please log in first");
      return;
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from("watchlist_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("ticker", stock.ticker)
        .limit(1);

      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        showToast(`${stock.ticker} already in watchlist`);
        return;
      }

      const { error: insertError } = await supabase.from("watchlist_items").insert({
        user_id: user.id,
        ticker: stock.ticker,
        company_name: stock.name,
        exchange: stock.exchange,
      });

      if (insertError) throw insertError;

      showToast(`${stock.ticker} added to watchlist`);
    } catch {
      showToast("Failed to add to watchlist");
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50 flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-foreground text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      <SubPageHeader title={`Results · ${results.length} found`} />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-3 flex-1">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-24 text-muted-foreground text-sm">
            No results found. Try adjusting your filters.
          </div>
        )}

        {!loading &&
          results.map((s, i) => <ResultRow key={i} stock={s} onAdd={addToWatchlist} />)}
      </main>
    </div>
  );
}
