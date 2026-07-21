import React, { useMemo } from "react";

function getValidNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function formatCurrency(value) {
  return `$${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

export default function PortfolioGrowthChart({
  stocks = [],
}) {
  const {
    totalValue,
    pricesAvailable,
  } = useMemo(() => {
    if (!stocks.length) {
      return {
        totalValue: null,
        pricesAvailable: false,
      };
    }

    let value = 0;

    for (const stock of stocks) {
      const price = getValidNumber(
        stock?.current_price,
      );

      const quantity = getValidNumber(
        stock?.quantity,
      );

      if (
        price === null ||
        price <= 0 ||
        quantity === null ||
        quantity < 0
      ) {
        return {
          totalValue: null,
          pricesAvailable: false,
        };
      }

      value += price * quantity;
    }

    return {
      totalValue: value,
      pricesAvailable: true,
    };
  }, [stocks]);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
        Portfolio Growth
      </p>

      <p className="font-heading text-3xl font-bold text-gray-900">
        {pricesAvailable
          ? formatCurrency(
              totalValue,
            )
          : "—"}
      </p>

      <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-gray-700">
          Historical growth unavailable
        </p>

        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-gray-500">
          A portfolio chart will appear only
          after real historical portfolio
          snapshots are recorded. No
          estimated or generated chart data
          is displayed.
        </p>

        {!pricesAvailable && (
          <p className="mt-3 text-xs font-medium text-amber-700">
            Waiting for current market
            prices.
          </p>
        )}
      </div>
    </section>
  );
}
