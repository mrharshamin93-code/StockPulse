import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

import {
  getProfile,
  getQuote,
} from "@/lib/financialDatasets";

export default function AddStockDialog({
  onStockAdded,
}) {
  const { user } = useAuth();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    ticker,
    setTicker,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState("");

  const [
    purchasePrice,
    setPurchasePrice,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    tickerValid,
    setTickerValid,
  ] = useState(null);

  const [
    validating,
    setValidating,
  ] = useState(false);

  const debounceRef =
    useRef(null);

  useEffect(() => {
    const clean =
      ticker
        .trim()
        .toUpperCase();

    if (!clean) {
      setTickerValid(null);
      setError("");

      return undefined;
    }

    setValidating(true);
    setTickerValid(null);
    setError("");

    if (clean.length < 2) {
      setValidating(false);

      return undefined;
    }

    let cancelled =
      false;

    clearTimeout(
      debounceRef.current,
    );

    debounceRef.current =
      setTimeout(
        async () => {
          const attempt =
            async () => {
              return getQuote(
                clean,
              );
            };

          let data;

          try {
            data =
              await attempt();
          } catch {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  1000,
                ),
            );

            try {
              data =
                await attempt();
            } catch {
              if (!cancelled) {
                setValidating(
                  false,
                );
              }

              return;
            }
          }

          if (cancelled) {
            return;
          }

          if (
            !data?.c ||
            Number(data.c) === 0
          ) {
            setTickerValid(
              false,
            );

            setError(
              `"${clean}" doesn't appear to be a valid ticker symbol.`,
            );
          } else {
            setTickerValid(
              true,
            );

            setError("");
          }

          setValidating(
            false,
          );
        },
        1200,
      );

    return () => {
      cancelled = true;

      clearTimeout(
        debounceRef.current,
      );
    };
  }, [ticker]);

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !tickerValid ||
        !user?.id
      ) {
        return;
      }

      setError("");
      setLoading(true);

      const cleanTicker =
        ticker
          .trim()
          .toUpperCase();

      const inputQuantity =
        parseFloat(
          quantity,
        );

      const inputPurchasePrice =
        parseFloat(
          purchasePrice,
        );

      let company_name =
        cleanTicker;

      let exchange = "";

      try {
        const profileData =
          await getProfile(
            cleanTicker,
          );

        if (
          profileData?.name
        ) {
          company_name =
            profileData.name;
        }

        if (
          profileData?.exchange
        ) {
          exchange =
            profileData.exchange;
        }
      } catch (
        profileError
      ) {
        console.warn(
          "Profile lookup failed:",
          profileError,
        );
      }

      let current_price =
        inputPurchasePrice;

      try {
        const quoteData =
          await getQuote(
            cleanTicker,
          );

        if (
          Number(
            quoteData?.c,
          ) > 0
        ) {
          current_price =
            Number(
              quoteData.c,
            );
        }
      } catch (
        quoteError
      ) {
        console.warn(
          "Quote lookup failed:",
          quoteError,
        );
      }

      const {
        data:
          existingStock,
        error:
          existingStockError,
      } =
        await supabase
          .from("stocks")
          .select("*")
          .eq(
            "user_id",
            user.id,
          )
          .eq(
            "ticker",
            cleanTicker,
          )
          .maybeSingle();

      if (
        existingStockError
      ) {
        setLoading(false);

        setError(
          existingStockError.message ||
            "Failed to check existing portfolio stock.",
        );

        return;
      }

      let stockError =
        null;

      if (existingStock) {
        const existingQuantity =
          parseFloat(
            existingStock.quantity,
          ) || 0;

        const existingPurchasePrice =
          parseFloat(
            existingStock.purchase_price,
          ) || 0;

        const combinedQuantity =
          existingQuantity +
          inputQuantity;

        const weightedPurchasePrice =
          combinedQuantity > 0
            ? (
                existingQuantity *
                  existingPurchasePrice +
                inputQuantity *
                  inputPurchasePrice
              ) /
              combinedQuantity
            : inputPurchasePrice;

        const {
          error:
            updateError,
        } =
          await supabase
            .from("stocks")
            .update({
              company_name,

              quantity:
                combinedQuantity,

              purchase_price:
                weightedPurchasePrice,

              current_price,
            })
            .eq(
              "id",
              existingStock.id,
            )
            .eq(
              "user_id",
              user.id,
            );

        stockError =
          updateError;
      } else {
        const {
          error:
            insertError,
        } =
          await supabase
            .from("stocks")
            .insert({
              user_id:
                user.id,

              ticker:
                cleanTicker,

              company_name,

              quantity:
                inputQuantity,

              purchase_price:
                inputPurchasePrice,

              current_price,
            });

        stockError =
          insertError;
      }

      if (stockError) {
        setLoading(false);

        setError(
          stockError.message ||
            "Failed to add stock.",
        );

        return;
      }

      try {
        const {
          data:
            existing,
        } =
          await supabase
            .from(
              "watchlist_items",
            )
            .select("id")
            .eq(
              "user_id",
              user.id,
            )
            .eq(
              "ticker",
              cleanTicker,
            )
            .limit(1);

        if (
          !existing ||
          existing.length ===
            0
        ) {
          await supabase
            .from(
              "watchlist_items",
            )
            .insert({
              user_id:
                user.id,

              ticker:
                cleanTicker,

              company_name,

              exchange,
            });
        }
      } catch (
        watchlistError
      ) {
        console.warn(
          "Unable to add stock to watchlist:",
          watchlistError,
        );
      }

      setLoading(false);
      setOpen(false);
      setTicker("");
      setQuantity("");
      setPurchasePrice("");
      setError("");
      setTickerValid(null);

      onStockAdded?.();
    };

  const handleOpenChange =
    (value) => {
      setOpen(value);

      if (!value) {
        setTicker("");
        setQuantity("");
        setPurchasePrice("");
        setError("");
        setTickerValid(null);
      }
    };

  return (
    <Dialog
      open={open}
      onOpenChange={
        handleOpenChange
      }
    >
      <DialogTrigger asChild>
        <button className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/80 shadow-lg backdrop-blur-md transition-transform active:scale-95">
          <Plus className="h-6 w-6 text-gray-800" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Add to Portfolio
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5 pt-2"
        >
          <div className="space-y-2">
            <Label>
              Ticker Symbol
            </Label>

            <div className="relative">
              <Input
                placeholder="e.g. AAPL"
                value={ticker}
                onChange={(
                  event,
                ) =>
                  setTicker(
                    event.target
                      .value,
                  )
                }
                className="pr-9 font-mono uppercase"
                required
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validating && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {!validating &&
                  tickerValid ===
                    true && (
                    <CheckCircle2 className="h-4 w-4 text-black" />
                  )}

                {!validating &&
                  tickerValid ===
                    false && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Shares
              </Label>

              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="10"
                value={quantity}
                onChange={(
                  event,
                ) =>
                  setQuantity(
                    event.target
                      .value,
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Avg. Purchase Price
              </Label>

              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="150.00"
                value={
                  purchasePrice
                }
                onChange={(
                  event,
                ) =>
                  setPurchasePrice(
                    event.target
                      .value,
                  )
                }
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

              <span>
                {error}
              </span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              !tickerValid ||
              validating ||
              !quantity ||
              !purchasePrice
            }
          >
            {loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            {loading
              ? "Saving…"
              : "Add to Portfolio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
