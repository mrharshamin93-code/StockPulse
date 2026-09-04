import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { financialDatasetsRequest } from "@/lib/financialDatasets";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SubPageHeader from "@/components/SubPageHeader";

export default function PriceAlerts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [alerts, setAlerts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [open, setOpen] =
    useState(false);

  const [ticker, setTicker] =
    useState("");

  const [condition, setCondition] =
    useState("above");

  const [targetPrice, setTargetPrice] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(
    async () => {
      if (!user?.id) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: alertsError } =
          await supabase
            .from("stock_alerts")
            .select(
              "id,user_id,ticker,condition,target_price,enabled,triggered,last_checked_price,triggered_at,created_at",
            )
            .eq(
              "user_id",
              user.id,
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            );

        if (alertsError) {
          throw alertsError;
        }

        setAlerts(data || []);
      } catch (loadError) {
        console.error(
          "Price alerts failed to load:",
          loadError,
        );

        setError(
          "Unable to load price alerts. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const requestedTicker =
      String(
        location.state?.ticker ||
          "",
      )
        .trim()
        .toUpperCase();

    if (
      !location.state?.openAddAlert ||
      !requestedTicker
    ) {
      return;
    }

    setTicker(requestedTicker);
    setCondition("above");
    setTargetPrice("");
    setError("");
    setOpen(true);

    navigate(
      location.pathname,
      {
        replace: true,
        state: null,
      },
    );
  }, [
    location.key,
    location.pathname,
    location.state,
    navigate,
  ]);

  function openBlankAlertDialog() {
    setTicker("");
    setCondition("above");
    setTargetPrice("");
    setError("");
    setOpen(true);
  }

  function handleAlertDialogOpenChange(
    nextOpen,
  ) {
    setOpen(nextOpen);

    if (
      !nextOpen &&
      !saving
    ) {
      setTicker("");
      setCondition("above");
      setTargetPrice("");
    }
  }

  async function handleAdd(event) {
    event.preventDefault();

    if (
      !user?.id ||
      saving
    ) {
      return;
    }

    const parsedTarget =
      Number(targetPrice);

    if (
      !ticker.trim() ||
      !Number.isFinite(parsedTarget) ||
      parsedTarget <= 0
    ) {
      setError(
        "Enter a valid ticker and target price.",
      );
      return;
    }

    const normalizedTicker =
      ticker
        .trim()
        .toUpperCase();

    setSaving(true);
    setError("");

    try {
      let quote;

      try {
        quote = await financialDatasetsRequest({
          action: "quote",
          ticker: normalizedTicker,
        });
      } catch (validationError) {
        const message = String(
          validationError?.message ||
            "",
        ).toLowerCase();

        if (
          message.includes("no prices") ||
          message.includes("no data") ||
          message.includes("no usable quote") ||
          message.includes("invalid ticker") ||
          message.includes("valid ticker") ||
          message.includes("not found")
        ) {
          setError("Ticker not found.");
          return;
        }

        console.error(
          "Ticker validation failed:",
          validationError,
        );

        setError(
          "Unable to verify this ticker right now. Please try again.",
        );
        return;
      }

      const validatedPrice = Number(
        quote?.c ??
          quote?.price ??
          quote?.current_price,
      );

      if (
        !Number.isFinite(validatedPrice) ||
        validatedPrice <= 0
      ) {
        setError("Ticker not found.");
        return;
      }

      const { error: insertError } =
        await supabase
          .from("stock_alerts")
          .insert({
            user_id: user.id,
            ticker: normalizedTicker,
            condition,
            target_price: parsedTarget,
            enabled: true,
            triggered: false,
            triggered_at: null,
            notification_sent_at: null,
            notification_error: null,
          });

      if (insertError) {
        throw insertError;
      }

      setOpen(false);
      setTicker("");
      setCondition("above");
      setTargetPrice("");

      await load();
    } catch (saveError) {
      console.error(
        "Price alert creation failed:",
        saveError,
      );

      setError(
        "Unable to create the alert. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!user?.id) {
      return;
    }

    const { error: deleteError } =
      await supabase
        .from("stock_alerts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        "Price alert deletion failed:",
        deleteError,
      );

      setError(
        "Unable to delete the alert. Please try again.",
      );
      return;
    }

    setAlerts(
      (previous) =>
        previous.filter(
          (alert) => alert.id !== id,
        ),
    );
  }

  async function handleToggle(alert) {
    if (!user?.id) {
      return;
    }

    const nextEnabled =
      !alert.enabled;

    const { error: updateError } =
      await supabase
        .from("stock_alerts")
        .update({
          enabled: nextEnabled,
        })
        .eq("id", alert.id)
        .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Price alert update failed:",
        updateError,
      );

      setError(
        "Unable to update the alert. Please try again.",
      );
      return;
    }

    setAlerts(
      (previous) =>
        previous.map(
          (item) =>
            item.id === alert.id
              ? {
                  ...item,
                  enabled: nextEnabled,
                }
              : item,
        ),
    );
  }

  const activeCount = alerts.filter(
    (alert) =>
      alert.enabled &&
      !alert.triggered,
  ).length;

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",
      }}
    >
      <SubPageHeader
        title="Price Alerts"
        backPath="/settings"
      />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Your alerts
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                {activeCount} active · Push notification when reached
              </p>
            </div>

            <button
              type="button"
              onClick={openBlankAlertDialog}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Alert
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Bell className="mx-auto h-7 w-7 text-gray-300" />

              <p className="mt-2 text-sm font-medium text-gray-600">
                No price alerts
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Add an alert and StockPulse will notify you when the target is reached.
              </p>

              <button
                type="button"
                onClick={openBlankAlertDialog}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Alert
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alerts.map((alert) => {
                const triggered = Boolean(
                  alert.triggered,
                );

                return (
                  <div
                    key={alert.id}
                    className="flex min-h-[68px] items-center gap-3 px-5 py-4"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        triggered
                          ? "bg-emerald-50"
                          : alert.enabled
                            ? "bg-amber-50"
                            : "bg-gray-100"
                      }`}
                    >
                      {triggered ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : alert.condition === "above" ? (
                        <TrendingUp
                          className={`h-4 w-4 ${
                            alert.enabled
                              ? "text-amber-500"
                              : "text-gray-400"
                          }`}
                        />
                      ) : (
                        <TrendingDown
                          className={`h-4 w-4 ${
                            alert.enabled
                              ? "text-amber-500"
                              : "text-gray-400"
                          }`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          !alert.enabled && !triggered
                            ? "text-gray-400"
                            : "text-gray-900"
                        }`}
                      >
                        {alert.ticker}{" "}
                        <span className="font-normal text-gray-400">
                          {alert.condition}
                        </span>{" "}
                        ${Number(alert.target_price).toFixed(2)}
                      </p>

                      {triggered ? (
                        <p className="mt-0.5 text-xs text-emerald-600">
                          Target reached
                          {alert.last_checked_price
                            ? ` at $${Number(
                                alert.last_checked_price,
                              ).toFixed(2)}`
                            : ""}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggle(alert)}
                          className="mt-0.5 text-xs text-gray-400 transition-colors hover:text-gray-900"
                        >
                          {alert.enabled
                            ? "Enabled · tap to disable"
                            : "Disabled · tap to enable"}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(alert.id)}
                      className="rounded-lg p-2 transition-colors hover:bg-red-50"
                      aria-label={`Delete ${alert.ticker} alert`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Dialog
        open={open}
        onOpenChange={handleAlertDialogOpenChange}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              New Price Alert
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleAdd}
            className="space-y-4 pt-1"
          >
            <div className="space-y-2">
              <Label htmlFor="alert-ticker">
                Ticker
              </Label>

              <Input
                id="alert-ticker"
                placeholder="AAPL"
                value={ticker}
                onChange={(event) => {
                  setTicker(
                    event.target.value.toUpperCase(),
                  );
                  setError("");
                }}
                required
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Condition
              </Label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCondition("above")}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    condition === "above"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Price Above
                </button>

                <button
                  type="button"
                  onClick={() => setCondition("below")}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    condition === "below"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Price Below
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-target-price">
                Target Price ($)
              </Label>

              <Input
                id="alert-target-price"
                type="number"
                step="any"
                min="0.01"
                placeholder="150.00"
                value={targetPrice}
                onChange={(event) =>
                  setTargetPrice(event.target.value)
                }
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                saving ||
                !ticker ||
                !targetPrice
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              Create Alert
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
