import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function BuyDialog({
  open,
  onOpenChange,
  stock,
  onDone,
}) {
  const currentPrice =
    getValidNumber(
      stock?.current_price,
    );

  const purchasePriceValue =
    getValidNumber(
      stock?.purchase_price,
    );

  const [quantity, setQuantity] =
    useState("");

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState(
    currentPrice > 0
      ? currentPrice.toFixed(2)
      : purchasePriceValue > 0
        ? purchasePriceValue.toFixed(
            2,
          )
        : "",
  );

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stock?.id) {
      return;
    }

    const quantityValue =
      Number(quantity);

    const priceValue =
      Number(purchasePrice);

    if (
      !Number.isFinite(
        quantityValue,
      ) ||
      quantityValue <= 0 ||
      !Number.isFinite(
        priceValue,
      ) ||
      priceValue <= 0
    ) {
      return;
    }

    setLoading(true);

    try {
      const {
        data: {
          user: currentUser,
        },
      } =
        await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error(
          "Not authenticated",
        );
      }

      const existingQuantity =
        getValidNumber(
          stock.quantity,
        ) || 0;

      const existingAverageCost =
        getValidNumber(
          stock.purchase_price,
        ) || 0;

      const newQuantity =
        existingQuantity +
        quantityValue;

      const newAverageCost =
        newQuantity > 0
          ? (existingAverageCost *
              existingQuantity +
              priceValue *
                quantityValue) /
            newQuantity
          : priceValue;

      const updatePayload = {
        quantity: newQuantity,
        purchase_price:
          +newAverageCost.toFixed(4),
      };

      if (
        currentPrice !== null &&
        currentPrice > 0
      ) {
        updatePayload.current_price =
          currentPrice;
      }

      const { error: updateError } =
        await supabase
          .from("stocks")
          .update(updatePayload)
          .eq("id", stock.id)
          .eq(
            "user_id",
            currentUser.id,
          );

      if (updateError) {
        throw updateError;
      }

      const {
        error: transactionError,
      } = await supabase
        .from(
          "stock_transactions",
        )
        .insert({
          user_id:
            currentUser.id,
          ticker:
            stock.ticker.toUpperCase(),
          company_name:
            stock.company_name || "",
          type: "buy",
          quantity:
            quantityValue,
          price: priceValue,
          total:
            quantityValue *
            priceValue,
        });

      if (transactionError) {
        console.warn(
          "Transaction insert failed:",
          transactionError,
        );
      }

      await onDone?.();
      onOpenChange(false);
      setQuantity("");
    } catch (error) {
      console.error(
        "Buy error details:",
        error,
      );

      window.alert(
        "Failed to buy shares. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Buy {stock?.ticker}
          </DialogTitle>

          <DialogDescription>
            Add more shares to your{" "}
            {stock?.ticker} position.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 pt-2"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`buy-shares-${stock?.id}`}>
                Shares
              </Label>

              <Input
                id={`buy-shares-${stock?.id}`}
                type="number"
                step="any"
                min="0.000001"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`buy-price-${stock?.id}`}>
                Purchase Price
              </Label>

              <Input
                id={`buy-price-${stock?.id}`}
                type="number"
                step="any"
                min="0.01"
                value={purchasePrice}
                onChange={(event) =>
                  setPurchasePrice(
                    event.target.value,
                  )
                }
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !quantity ||
              !purchasePrice
            }
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            Buy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellDialog({
  open,
  onOpenChange,
  stock,
  onDone,
}) {
  const [quantity, setQuantity] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const maximumQuantity =
    getValidNumber(
      stock?.quantity,
    ) || 0;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stock?.id) {
      return;
    }

    const sellQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        sellQuantity,
      ) ||
      sellQuantity <= 0 ||
      sellQuantity >
        maximumQuantity
    ) {
      return;
    }

    const currentPrice =
      getValidNumber(
        stock.current_price,
      );

    if (
      currentPrice === null ||
      currentPrice <= 0
    ) {
      window.alert(
        "A current market price is required before selling.",
      );

      return;
    }

    setLoading(true);

    try {
      const {
        data: {
          user: currentUser,
        },
      } =
        await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error(
          "Not authenticated",
        );
      }

      const {
        error: transactionError,
      } = await supabase
        .from(
          "stock_transactions",
        )
        .insert({
          user_id:
            currentUser.id,
          ticker:
            stock.ticker.toUpperCase(),
          company_name:
            stock.company_name || "",
          type: "sell",
          quantity:
            sellQuantity,
          price: currentPrice,
          total:
            sellQuantity *
            currentPrice,
        });

      if (transactionError) {
        throw transactionError;
      }

      if (
        sellQuantity >=
        maximumQuantity
      ) {
        const { error } =
          await supabase
            .from("stocks")
            .delete()
            .eq("id", stock.id)
            .eq(
              "user_id",
              currentUser.id,
            );

        if (error) {
          throw error;
        }
      } else {
        const { error } =
          await supabase
            .from("stocks")
            .update({
              quantity:
                +(
                  maximumQuantity -
                  sellQuantity
                ).toFixed(6),
            })
            .eq("id", stock.id)
            .eq(
              "user_id",
              currentUser.id,
            );

        if (error) {
          throw error;
        }
      }

      await onDone?.();
      onOpenChange(false);
      setQuantity("");
    } catch (error) {
      console.error(
        "Sell error:",
        error,
      );

      window.alert(
        "Failed to sell shares. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Sell {stock?.ticker}
          </DialogTitle>

          <DialogDescription>
            {stock?.company_name} ·{" "}
            {maximumQuantity} shares held
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 pt-2"
        >
          <div className="space-y-2">
            <Label htmlFor={`sell-shares-${stock?.id}`}>
              Shares to Sell
            </Label>

            <div className="relative">
              <Input
                id={`sell-shares-${stock?.id}`}
                type="number"
                step="any"
                min="0.000001"
                max={
                  maximumQuantity
                }
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value,
                  )
                }
                className="pr-12"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    String(
                      maximumQuantity,
                    ),
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                all
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !quantity ||
              Number(quantity) <= 0
            }
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            Sell
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockCard({
  stock,
  onRefresh,
}) {
  const [buyOpen, setBuyOpen] =
    useState(false);

  const [sellOpen, setSellOpen] =
    useState(false);

  const currentPrice =
    getValidNumber(
      stock?.current_price,
    );

  const quantity =
    getValidNumber(
      stock?.quantity,
    );

  const purchasePrice =
    getValidNumber(
      stock?.purchase_price,
    );

  const marketPriceAvailable =
    currentPrice !== null &&
    currentPrice > 0 &&
    quantity !== null &&
    quantity >= 0;

  const costAvailable =
    purchasePrice !== null &&
    purchasePrice >= 0 &&
    quantity !== null &&
    quantity >= 0;

  const totalValue =
    marketPriceAvailable
      ? currentPrice *
        quantity
      : null;

  const totalCost =
    costAvailable
      ? purchasePrice *
        quantity
      : null;

  const gain =
    totalValue !== null &&
    totalCost !== null
      ? totalValue - totalCost
      : null;

  const gainPct =
    gain !== null &&
    totalCost > 0
      ? (gain / totalCost) *
        100
      : null;

  const isPositive =
    gain !== null &&
    gain >= 0;

  return (
    <>
      <BuyDialog
        open={buyOpen}
        onOpenChange={setBuyOpen}
        stock={stock}
        onDone={onRefresh}
      />

      <SellDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        stock={stock}
        onDone={onRefresh}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md">
        <div className="mb-4 flex items-start justify-between">
          <Link
            to={`/stock/${stock.id}`}
            className="group min-w-0 flex-1"
          >
            {stock.sector && (
              <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
                {stock.sector}
              </span>
            )}

            <h3 className="mt-0.5 font-heading text-lg font-bold text-gray-900">
              {stock.ticker}
            </h3>

            <p className="max-w-[180px] truncate text-sm text-gray-500">
              {stock.company_name}
            </p>
          </Link>

          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setBuyOpen(true)
              }
              className="h-8 rounded-md bg-black px-3 text-xs font-semibold text-white transition-all hover:bg-gray-800 active:scale-95"
            >
              Buy
            </button>

            <button
              type="button"
              onClick={() =>
                setSellOpen(true)
              }
              className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-black transition-all hover:bg-gray-50 active:scale-95"
            >
              Sell
            </button>
          </div>
        </div>

        <Link to={`/stock/${stock.id}`}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                Price
              </p>

              <p className="text-sm font-semibold text-gray-900">
                {marketPriceAvailable
                  ? formatCurrency(
                      currentPrice,
                    )
                  : "—"}
              </p>
            </div>

            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                Shares
              </p>

              <p className="text-sm font-semibold text-gray-900">
                {quantity !== null
                  ? quantity
                  : "—"}
              </p>
            </div>

            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                Value
              </p>

              <p className="text-sm font-semibold text-gray-900">
                {totalValue !== null
                  ? formatCurrency(
                      totalValue,
                    )
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
            {gain === null ? (
              <p className="text-sm font-medium text-gray-400">
                Market price unavailable
              </p>
            ) : (
              <>
                <p
                  className={`text-sm font-medium ${
                    isPositive
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {isPositive
                    ? "+"
                    : "-"}
                  {formatCurrency(
                    Math.abs(gain),
                  )}{" "}
                  total
                </p>

                {gainPct !== null && (
                  <div
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isPositive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}

                    {isPositive
                      ? "+"
                      : ""}
                    {gainPct.toFixed(1)}
                    %
                  </div>
                )}
              </>
            )}
          </div>
        </Link>
      </div>
    </>
  );
}
