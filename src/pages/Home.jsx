import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, Briefcase, RefreshCw } from "lucide-react";

export default function Home() {
  const { user, isLoadingAuth } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Welcome back, {user?.name || "Investor"}</h1>
            <p className="text-muted-foreground">Here's what's happening in your portfolio</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <Briefcase className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-4xl font-semibold mt-2">$0.00</p>
            <p className="text-sm text-emerald-600 mt-1">+0.00% today</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl p-6">
            <p className="text-sm text-muted-foreground">Total Gain / Loss</p>
            <p className="text-4xl font-semibold mt-2 text-emerald-600">$0.00</p>
            <p className="text-sm text-emerald-600 mt-1">+0.00%</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl p-6">
            <p className="text-sm text-muted-foreground">Number of Holdings</p>
            <p className="text-4xl font-semibold mt-2">0</p>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Portfolio data will appear here once you add holdings.
        </div>
      </div>
    </div>
  );
}
