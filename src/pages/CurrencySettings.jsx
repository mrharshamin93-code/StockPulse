import React, { useState } from "react";
import SubPageHeader from "@/components/SubPageHeader";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
];

const LOCALE_CURRENCY_MAP = {
  US: "USD", CA: "CAD", GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  JP: "JPY", AU: "AUD", CH: "CHF", IN: "INR", CN: "CNY", BR: "BRL", MX: "MXN",
  KR: "KRW", SG: "SGD", HK: "HKD", NO: "NOK", SE: "SEK", NZ: "NZD",
};

const getDefaultCurrency = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const region = locale.split("-")[1]?.toUpperCase();
    return LOCALE_CURRENCY_MAP[region] || "USD";
  } catch {
    return "USD";
  }
};

const getCurrency = () => localStorage.getItem("currency") || getDefaultCurrency();

export default function CurrencySettings() {
  const [selected, setSelected] = useState(getCurrency);

  const handleSelect = (code) => {
    localStorage.setItem("currency", code);
    setSelected(code);
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title="Currency" backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">Select Currency</p>
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => handleSelect(c.code)}
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-mono font-bold text-sm text-muted-foreground">
                  {c.symbol}
                </div>
                <div>
                  <p className="font-medium text-sm">{c.code}</p>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                </div>
              </div>
              {selected === c.code && (
                <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}