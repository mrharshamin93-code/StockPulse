import React from "react";
import { Sparkles, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREMIUM_FEATURES = [
  "AI-powered stock analysis & insights",
  "Bullish & bearish breakdowns",
  "Curated news per stock",
  "No ads — ever",
];

export default function PremiumGate() {
  return (
    <div
      className="min-h-screen bg-gray-50/50 flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <header
        className="bg-white border-b border-gray-100 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Analysis</h1>
          <p className="text-xs text-muted-foreground">AI-powered stock insights</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-3xl bg-violet-50 flex items-center justify-center relative">
              <Sparkles className="w-10 h-10 text-violet-500" />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow">
                <Lock className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="font-heading text-2xl font-bold mb-2">Unlock Premium</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Get unlimited AI stock analysis, curated news, and an ad-free experience.
            </p>
          </div>

          {/* Pricing card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-5 shadow-sm">
            <div className="flex items-end gap-1 mb-1">
              <span className="font-heading text-4xl font-bold">$4.99</span>
              <span className="text-muted-foreground text-sm mb-1.5">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Cancel anytime. No commitments.</p>

            <div className="space-y-3">
              {PREMIUM_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full h-12 text-base font-semibold gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            <Sparkles className="w-4 h-4" />
            Upgrade to Premium
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Payment coming soon. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
}