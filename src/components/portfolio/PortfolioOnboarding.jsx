import React from "react";
import { TrendingUp, BarChart2, Zap, Plus } from "lucide-react";

const STEPS = [
  {
    icon: Plus,
    title: "Add your first stock",
    desc: "Search any ticker and enter how many shares you own and at what price.",
  },
  {
    icon: BarChart2,
    title: "Track performance",
    desc: "See your portfolio value, total return, and growth chart update in real time.",
  },
  {
    icon: Zap,
    title: "Get AI insights",
    desc: "Visit the Analysis tab for AI-powered news and pros/cons on any stock.",
  },
];

export default function PortfolioOnboarding({ onStockAdded }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-lg mx-auto text-center">
      {/* Hero */}
      <div className="w-20 h-20 rounded-3xl bg-foreground flex items-center justify-center mb-6 shadow-lg">
        <TrendingUp className="w-10 h-10 text-white" />
      </div>
      <h2 className="font-heading text-2xl font-bold mb-2">Welcome to StockPulse</h2>
      <p className="text-muted-foreground text-sm mb-10 leading-relaxed">
        Your intelligent portfolio tracker. Add your first holding to get started — it only takes a few seconds.
      </p>

      {/* Steps */}
      <div className="w-full space-y-3 mb-10">
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className="flex items-start gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-4 text-left">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <span className="ml-auto text-xs font-bold text-muted-foreground/40 mt-1 shrink-0">0{i + 1}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">Tap the <strong>+</strong> button below to add your first stock.</p>
    </div>
  );
}