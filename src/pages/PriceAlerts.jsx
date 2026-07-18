import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import StockAlertsSection from "@/components/settings/StockAlertsSection";

export default function PriceAlerts() {
  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <header
        className="bg-white border-b border-gray-100 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <Link to="/settings" className="p-1 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Price Alerts</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <StockAlertsSection hideLabel />
      </main>
    </div>
  );
}