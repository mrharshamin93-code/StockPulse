import React from "react";
import { BarChart3, Bell, Check, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Sparkles, text: "AI-powered stock analysis & insights" },
  { icon: Bell, text: "Real-time stock alerts" },
  { icon: BarChart3, text: "Advanced screener, portfolio & watchlist" },
];

export default function PremiumGate({ onSubscribe, onRestore, isProcessing = false, price = "$4.99" }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <main className="min-h-full flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-7">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-950/40"><BarChart3 className="w-9 h-9 text-white" /></div>
            <p className="text-red-400 text-sm font-semibold tracking-wide mb-2">STOCKPULSE PRO</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight mb-3">Keep your investing edge</h1>
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm mx-auto">Your 7-day free access has ended. Subscribe to keep full access to StockPulse.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 mb-5 shadow-2xl">
            <div className="space-y-4 mb-6">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5 text-red-400" /></div><span className="text-sm font-medium text-slate-100">{text}</span><Check className="w-4 h-4 text-emerald-400 ml-auto shrink-0" /></div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-5 text-center">
              <div className="flex items-end justify-center gap-1"><span className="text-4xl font-bold tracking-tight">{price}</span><span className="text-slate-400 text-sm mb-1.5">/ month</span></div>
              <p className="text-xs text-slate-400 mt-1">Auto-renewing subscription. Cancel anytime.</p>
            </div>
          </div>
          <Button type="button" onClick={onSubscribe} disabled={isProcessing} className="w-full h-13 rounded-2xl text-base font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/30">{isProcessing ? "Please wait…" : "Continue with StockPulse Pro"}</Button>
          <button type="button" onClick={onRestore} disabled={isProcessing} className="w-full mt-4 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50">Restore Purchases</button>
          <div className="flex items-center justify-center gap-1 mt-6 text-xs text-slate-500"><Star className="w-3 h-3" /><span>Full access to every StockPulse feature</span></div>
          <div className="flex justify-center gap-5 mt-4 text-[11px] text-slate-500"><a href="/terms" className="hover:text-slate-300">Terms</a><a href="/privacy" className="hover:text-slate-300">Privacy Policy</a></div>
        </div>
      </main>
    </div>
  );
}
