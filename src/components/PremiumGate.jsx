import React from "react";
import { BarChart3, BellRing, BrainCircuit, Check, LineChart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREMIUM_FEATURES = [
  { icon: BrainCircuit, label: "AI stock analysis & insights" },
  { icon: BellRing, label: "Real-time stock alerts" },
  { icon: LineChart, label: "Portfolio & watchlist tracking" },
  { icon: BarChart3, label: "Advanced stock screener" },
];

export default function PremiumGate({ onSubscribe, onRestore, isPurchasing = false }) {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <main className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-slate-950 text-white shadow-lg flex items-center justify-center">
              <LineChart className="h-8 w-8" />
            </div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-2">
              StockPulse Pro
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950 mb-3">
              Keep your edge in the market
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Your 7-day free access has ended. Subscribe to keep using all of StockPulse.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-5">
            <div className="space-y-4">
              {PREMIUM_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5 text-slate-800" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                  <Check className="ml-auto h-4 w-4 text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-5 pt-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">StockPulse Pro Monthly</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-950">$4.99</span>
                  <span className="text-sm text-slate-500">/ month</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                Apple billing
              </div>
            </div>
          </div>

          <Button
            className="w-full h-13 rounded-xl text-base font-semibold bg-slate-950 hover:bg-slate-800 text-white shadow-sm"
            onClick={onSubscribe}
            disabled={isPurchasing}
          >
            {isPurchasing ? "Connecting to App Store…" : "Continue — $4.99/month"}
          </Button>

          <p className="text-center text-xs leading-5 text-slate-500 mt-3 px-3">
            Auto-renews monthly until cancelled. Manage or cancel anytime in your Apple ID subscription settings.
          </p>

          <button
            type="button"
            onClick={onRestore}
            className="block mx-auto mt-4 text-sm font-medium text-slate-700 hover:text-slate-950"
          >
            Restore Purchases
          </button>

          <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <a href="/terms" className="hover:text-slate-600">Terms</a>
            <span aria-hidden="true">•</span>
            <a href="/privacy" className="hover:text-slate-600">Privacy Policy</a>
          </div>
        </div>
      </main>
    </div>
  );
}
