import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

export default function PriceAlerts() {
  const { user } = useAuth();

  const [alerts, setAlerts] =
    useState([]);

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

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
    async ({
      silent = false,
    } = {}) => {
      if (!user?.id) {
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          alertsResult,
          notificationsResult,
        ] =
          await Promise.all([
            supabase
              .from("stock_alerts")
              .select(
                "id,user_id,ticker,condition,target_price,enabled,triggered,last_checked_price,last_checked_at,triggered_at,created_at,notification_error",
              )
              .eq(
                "user_id",
                user.id,
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              ),

            supabase
              .from(
                "app_notifications",
              )
              .select(
                "id,type,title,body,ticker,route,read_at,created_at",
              )
              .eq(
                "user_id",
                user.id,
              )
              .eq(
                "type",
                "price_alert",
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              )
              .limit(20),
          ]);

        if (
          alertsResult.error
        ) {
          throw alertsResult.error;
        }

        if (
          notificationsResult.error
        ) {
          throw notificationsResult.error;
        }

        const loadedNotifications =
          notificationsResult.data ||
          [];

        setAlerts(
          alertsResult.data || [],
        );

        setNotifications(
          loadedNotifications,
        );

        const unreadIds =
          loadedNotifications
            .filter(
              (notification) =>
                !notification.read_at,
            )
            .map(
              (notification) =>
                notification.id,
            );

        if (unreadIds.length) {
          const {
            error: readError,
          } =
            await supabase
              .from(
                "app_notifications",
              )
              .update({
                read_at:
                  new Date().toISOString(),
              })
              .in(
                "id",
                unreadIds,
              )
              .eq(
                "user_id",
                user.id,
              );

          if (readError) {
            console.warn(
              "Could not mark notifications read:",
              readError,
            );
          }
        }
      } catch (loadError) {
        console.error(
          "Price alerts failed to load:",
          loadError,
        );

        setError(
          loadError?.message ||
            "Unable to load price alerts.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

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
      !Number.isFinite(
        parsedTarget,
      ) ||
      parsedTarget <= 0
    ) {
      setError(
        "Enter a valid ticker and target price.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        error: insertError,
      } =
        await supabase
          .from("stock_alerts")
          .insert({
            user_id:
              user.id,

            ticker:
              ticker
                .trim()
                .toUpperCase(),

            condition,

            target_price:
              parsedTarget,

            enabled:
              true,

            triggered:
              false,

            triggered_at:
              null,

            notification_sent_at:
              null,

            notification_error:
              null,
          });

      if (insertError) {
        throw insertError;
      }

      setOpen(false);
      setTicker("");
      setCondition("above");
      setTargetPrice("");

      await load({
        silent: true,
      });
    } catch (saveError) {
      console.error(
        "Price alert creation failed:",
        saveError,
      );

      setError(
        saveError?.message ||
          "Unable to create the alert.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!user?.id) {
      return;
    }

    const {
      error: deleteError,
    } =
      await supabase
        .from("stock_alerts")
        .delete()
        .eq(
          "id",
          id,
        )
        .eq(
          "user_id",
          user.id,
        );

    if (deleteError) {
      setError(
        deleteError.message ||
          "Unable to delete the alert.",
      );
      return;
    }

    setAlerts(
      (previous) =>
        previous.filter(
          (alert) =>
            alert.id !== id,
        ),
    );
  }

  async function handleToggle(alert) {
    if (!user?.id) {
      return;
    }

    const nextEnabled =
      !alert.enabled;

    const {
      error: updateError,
    } =
      await supabase
        .from("stock_alerts")
        .update({
          enabled:
            nextEnabled,
        })
        .eq(
          "id",
          alert.id,
        )
        .eq(
          "user_id",
          user.id,
        );

    if (updateError) {
      setError(
        updateError.message ||
          "Unable to update the alert.",
      );
      return;
    }

    setAlerts(
      (previous) =>
        previous.map(
          (item) =>
            item.id ===
            alert.id
              ? {
                  ...item,
                  enabled:
                    nextEnabled,
                }
              : item,
        ),
    );
  }

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

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Price monitoring
              </h2>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Supabase checks enabled alerts and saves a notification here when a target is reached. Native iPhone push delivery will be connected after the iOS app and Apple Developer account are ready.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                load({
                  silent: true,
                })
              }
              disabled={
                loading ||
                refreshing
              }
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Active alerts
              </h2>

              <p className="mt-0.5 text-xs text-gray-400">
                {
                  alerts.filter(
                    (alert) =>
                      alert.enabled &&
                      !alert.triggered,
                  ).length
                } monitoring
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(true)
              }
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
            <div className="px-5 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-gray-300" />

              <p className="mt-2 text-sm font-medium text-gray-600">
                No alerts set
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Add a target price to start monitoring.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alerts.map(
                (alert) => {
                  const triggered =
                    Boolean(
                      alert.triggered,
                    );

                  return (
                    <div
                      key={
                        alert.id
                      }
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
                        ) : alert.condition ===
                          "above" ? (
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
                            !alert.enabled &&
                            !triggered
                              ? "text-gray-400"
                              : "text-gray-900"
                          }`}
                        >
                          {
                            alert.ticker
                          }{" "}

                          <span className="font-normal text-gray-400">
                            {
                              alert.condition
                            }
                          </span>{" "}

                          $
                          {Number(
                            alert.target_price,
                          ).toFixed(
                            2,
                          )}
                        </p>

                        {triggered ? (
                          <p className="mt-0.5 text-xs text-emerald-600">
                            Triggered
                            {alert.last_checked_price
                              ? ` at $${Number(
                                  alert.last_checked_price,
                                ).toFixed(
                                  2,
                                )}`
                              : ""}
                            {alert.triggered_at
                              ? ` · ${formatTimestamp(
                                  alert.triggered_at,
                                )}`
                              : ""}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggle(
                                alert,
                              )
                            }
                            className="mt-0.5 text-xs text-gray-400 transition-colors hover:text-gray-900"
                          >
                            {alert.enabled
                              ? "Enabled · tap to disable"
                              : "Disabled · tap to enable"}
                          </button>
                        )}

                        {!triggered &&
                        alert.last_checked_at ? (
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            Last checked
                            {alert.last_checked_price
                              ? ` at $${Number(
                                  alert.last_checked_price,
                                ).toFixed(
                                  2,
                                )}`
                              : ""}
                            {" · "}
                            {formatTimestamp(
                              alert.last_checked_at,
                            )}
                          </p>
                        ) : null}

                        {alert.notification_error ? (
                          <p className="mt-1 text-[10px] text-red-500">
                            {
                              alert.notification_error
                            }
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            alert.id,
                          )
                        }
                        className="rounded-lg p-2 transition-colors hover:bg-red-50"
                        aria-label={`Delete ${alert.ticker} alert`}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Triggered notifications
            </h2>

            <p className="mt-0.5 text-xs text-gray-400">
              In-app history for reached targets
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : notifications.length ===
            0 ? (
            <div className="px-5 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-gray-300" />

              <p className="mt-2 text-sm font-medium text-gray-600">
                No triggered alerts yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(
                (
                  notification,
                ) => (
                  <button
                    type="button"
                    key={
                      notification.id
                    }
                    onClick={() => {
                      if (
                        notification.route
                      ) {
                        window.location.href =
                          notification.route;
                      }
                    }}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-gray-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {
                        notification.title
                      }
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {
                        notification.body
                      }
                    </p>

                    <p className="mt-1 text-[10px] text-gray-400">
                      {formatTimestamp(
                        notification.created_at,
                      )}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}
        </section>
      </main>

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              New Price Alert
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={
              handleAdd
            }
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
                onChange={(
                  event,
                ) =>
                  setTicker(
                    event.target.value.toUpperCase(),
                  )
                }
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
                  onClick={() =>
                    setCondition(
                      "above",
                    )
                  }
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    condition ===
                    "above"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Price Above
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCondition(
                      "below",
                    )
                  }
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    condition ===
                    "below"
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
                value={
                  targetPrice
                }
                onChange={(
                  event,
                ) =>
                  setTargetPrice(
                    event.target.value,
                  )
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
