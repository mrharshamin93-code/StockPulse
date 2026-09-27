import React from "react";
import { BarChart3, Bell, Check, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Sparkles, title: "AI Stock Insights", text: "Bull & bear cases powered by AI" },
  { icon: Bell, title: "Real-Time Alerts", text: "Stay on top of important price moves" },
  { icon: Search, title: "Advanced Stock Screener", text: "Find stocks that match your criteria" },
  { icon: BarChart3, title: "Portfolio & Watchlist", text: "Track everything in one place" },
];

export default function PremiumGate({ onSubscribe, onRestore, onSwitchAccount, isProcessing = false, price = "$4.99" }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <main className="min-h-full flex justify-center px-6 py-8">
        <div className="w-full max-w-md flex flex-col">
          <div className="text-center pt-5">
            <div className="mx-auto mb-5 w-14 h-14 rounded-2xl border border-white/15 bg-white/[0.06] flex items-center justify-center"><BarChart3 className="w-7 h-7 text-white" strokeWidth={1.8} /></div>
            <p className="text-xs font-semibold tracking-[0.24em] text-white/55 mb-3">STOCKPULSE PRO</p>
            <h1 className="font-heading text-[32px] leading-[1.08] font-bold tracking-tight">Invest smarter.<br />See more.</h1>
            <p className="mt-4 text-[15px] leading-6 text-white/55">Everything you need to research, track and understand your stocks in one place.</p>
          </div>
          <div className="mt-8 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.05] flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-white" strokeWidth={1.8} /></div><div className="min-w-0"><div className="text-[15px] font-semibold text-white">{title}</div><div className="mt-0.5 text-[13px] leading-5 text-white/45">{text}</div></div><Check className="w-4 h-4 text-white/60 ml-auto shrink-0" strokeWidth={2} /></div>)}
          </div>
          <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-5 text-center"><div className="text-[19px] font-semibold">7 days free</div><div className="mt-1 text-sm text-white/55">then {price}/month</div><div className="mt-2 text-[11px] leading-4 text-white/35">Auto-renews monthly unless cancelled at least 24 hours before renewal.</div></div>
          <div className="mt-5"><Button type="button" onClick={onSubscribe} disabled={isProcessing} className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 text-[16px] font-bold shadow-none">{isProcessing ? "Please wait…" : "Start 7-Day Free Trial"}</Button><div className="mt-3 text-center text-[11px] text-white/35">No charge today for eligible new subscribers</div></div>
          <button type="button" onClick={onRestore} disabled={isProcessing} className="w-full mt-5 text-sm font-medium text-white/55 hover:text-white disabled:opacity-50">Restore Purchases</button>
          <button type="button" onClick={onSwitchAccount} disabled={isProcessing} className="w-full mt-3 text-sm font-medium text-white/55 hover:text-white disabled:opacity-50">Sign in with another account</button>
          <div className="flex justify-center gap-6 mt-5 pb-2 text-[11px] text-white/35"><a href="/terms" className="hover:text-white/70">Terms</a><a href="/privacy" className="hover:text-white/70">Privacy Policy</a></div>
        </div>
      </main>
    </div>
  );
}
