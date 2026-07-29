import React, {
  useState,
} from "react";

import SubPageHeader from "@/components/SubPageHeader";
import { useAuth } from "@/lib/AuthContext";

const CURRENCIES = [
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "CA$",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
  },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "Fr",
  },
  {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
  },
  {
    code: "CNY",
    name: "Chinese Yuan",
    symbol: "¥",
  },
  {
    code: "BRL",
    name: "Brazilian Real",
    symbol: "R$",
  },
  {
    code: "MXN",
    name: "Mexican Peso",
    symbol: "$",
  },
  {
    code: "KRW",
    name: "South Korean Won",
    symbol: "₩",
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
  },
  {
    code: "HKD",
    name: "Hong Kong Dollar",
    symbol: "HK$",
  },
  {
    code: "NOK",
    name: "Norwegian Krone",
    symbol: "kr",
  },
  {
    code: "SEK",
    name: "Swedish Krona",
    symbol: "kr",
  },
  {
    code: "NZD",
    name: "New Zealand Dollar",
    symbol: "NZ$",
  },
];

export default function CurrencySettings() {
  const {
    preferences,
    updatePreference,
    isLoadingPreferences,
  } = useAuth();

  const selected =
    preferences?.currency ||
    "USD";

  const [
    savingCurrency,
    setSavingCurrency,
  ] = useState(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const handleSelect =
    async (code) => {
      if (
        savingCurrency ||
        code === selected
      ) {
        return;
      }

      setSavingCurrency(code);
      setErrorMessage("");

      try {
        await updatePreference(
          "currency",
          code,
        );
      } catch (error) {
        console.error(
          "Unable to save currency:",
          error,
        );

        setErrorMessage(
          "Unable to save your currency. Please try again.",
        );
      } finally {
        setSavingCurrency(null);
      }
    };

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",
      }}
    >
      <SubPageHeader
        title="Currency"
        backPath="/settings"
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">
          Select Currency
        </p>

        <div
          className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50"
          style={{
            backgroundColor:
              "hsl(var(--card))",
          }}
        >
          {CURRENCIES.map(
            (currency) => {
              const isSelected =
                selected ===
                currency.code;

              const isSaving =
                savingCurrency ===
                currency.code;

              return (
                <button
                  key={
                    currency.code
                  }
                  type="button"
                  onClick={() =>
                    handleSelect(
                      currency.code,
                    )
                  }
                  disabled={
                    isLoadingPreferences ||
                    Boolean(
                      savingCurrency,
                    )
                  }
                  aria-pressed={
                    isSelected
                  }
                  className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50/70 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-mono font-bold text-sm text-muted-foreground">
                      {
                        currency.symbol
                      }
                    </div>

                    <div>
                      <p className="font-medium text-sm">
                        {
                          currency.code
                        }
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {
                          isSaving
                            ? "Saving..."
                            : currency.name
                        }
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={
                          3
                        }
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : null}
                </button>
              );
            },
          )}
        </div>

        {errorMessage ? (
          <p
            className="text-sm text-red-600 mt-4 px-1"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </main>
    </div>
  );
}
