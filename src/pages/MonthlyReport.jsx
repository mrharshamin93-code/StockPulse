import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import SubPageHeader from "@/components/SubPageHeader";

const DELIVERY_LABELS = {
  pending: "Queued",
  processing: "Generating",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

function getLocalTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone || "UTC"
    );
  } catch {
    return "UTC";
  }
}

function getCurrency() {
  return (
    localStorage.getItem(
      "currency",
    ) || "USD"
  )
    .trim()
    .toUpperCase();
}

function formatMonth(value) {
  if (!value) {
    return "Monthly report";
  }

  const date = new Date(
    `${value}T00:00:00Z`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Monthly report";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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

function deliveryTone(status) {
  if (status === "sent") {
    return {
      icon: CheckCircle2,
      iconClass:
        "text-emerald-600",
      backgroundClass:
        "bg-emerald-50",
      textClass:
        "text-emerald-700",
    };
  }

  if (status === "failed") {
    return {
      icon: AlertCircle,
      iconClass: "text-red-600",
      backgroundClass:
        "bg-red-50",
      textClass:
        "text-red-700",
    };
  }

  return {
    icon: Clock3,
    iconClass:
      "text-blue-600",
    backgroundClass:
      "bg-blue-50",
    textClass:
      "text-blue-700",
  };
}

export default function MonthlyReport() {
  const { user } = useAuth();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [autoReport, setAutoReport] =
    useState(false);

  const [timezone, setTimezone] =
    useState(getLocalTimezone);

  const [currency] =
    useState(getCurrency);

  const [deliveries, setDeliveries] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const recipientEmail =
    user?.email || "your account email";

  const loadSettings =
    useCallback(async () => {
      if (!user?.id) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [
          profileResult,
          deliveriesResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "monthly_report_opt_in,report_timezone,report_currency,monthly_report_last_sent_at",
            )
            .eq("id", user.id)
            .single(),

          supabase
            .from(
              "monthly_report_deliveries",
            )
            .select(
              "id,report_month,delivery_kind,status,recipient_email,created_at,sent_at,error_message",
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
            )
            .limit(6),
        ]);

        if (
          profileResult.error
        ) {
          throw profileResult.error;
        }

        if (
          deliveriesResult.error
        ) {
          throw deliveriesResult.error;
        }

        const profile =
          profileResult.data;

        setAutoReport(
          Boolean(
            profile
              ?.monthly_report_opt_in,
          ),
        );

        setTimezone(
          profile
            ?.report_timezone ||
            getLocalTimezone(),
        );

        setDeliveries(
          deliveriesResult.data || [],
        );
      } catch (loadError) {
        console.error(
          "Monthly report settings failed:",
          loadError,
        );

        setError(
          loadError?.message ||
            "Unable to load report settings.",
        );
      } finally {
        setLoading(false);
      }
    }, [user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const nextReportText =
    useMemo(() => {
      if (!autoReport) {
        return "Automatic delivery is off";
      }

      return `Sent monthly to ${recipientEmail}`;
    }, [
      autoReport,
      recipientEmail,
    ]);

  async function toggleAutoReport(
    enabled,
  ) {
    if (
      !user?.id ||
      saving
    ) {
      return;
    }

    const previous =
      autoReport;

    setAutoReport(enabled);
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const localTimezone =
        getLocalTimezone();

      const {
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          monthly_report_opt_in:
            enabled,
          report_timezone:
            localTimezone,
          report_currency:
            currency,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setTimezone(
        localTimezone,
      );

      localStorage.setItem(
        "monthlyReport",
        String(enabled),
      );

      setMessage(
        enabled
          ? "Automatic monthly reports are enabled."
          : "Automatic monthly reports are disabled.",
      );
    } catch (saveError) {
      console.error(
        "Monthly report preference failed:",
        saveError,
      );

      setAutoReport(previous);
      setError(
        saveError?.message ||
          "Unable to update the report preference.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailNow() {
    if (
      !user?.id ||
      sending
    ) {
      return;
    }

    setSending(true);
    setError("");
    setMessage(
      "Generating your PDF and emailing it…",
    );

    try {
      const localTimezone =
        getLocalTimezone();

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        "monthly-report",
        {
          body: {
            action: "request",
            currency,
            timezone:
              localTimezone,
          },
        },
      );

      if (functionError) {
        throw functionError;
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The report could not be emailed.",
        );
      }

      setTimezone(
        localTimezone,
      );

      setMessage(
        `Report sent to ${
          data.recipient ||
          recipientEmail
        }.`,
      );

      await loadSettings();
    } catch (sendError) {
      console.error(
        "Monthly report email failed:",
        sendError,
      );

      setMessage("");
      setError(
        sendError?.message ||
          "The report could not be emailed. Please try again.",
      );
    } finally {
      setSending(false);
    }
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
        title="Performance Report"
        backPath="/settings"
      />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900">
                <Mail className="h-5 w-5 text-white" />
              </div>

              <div>
                <h2 className="font-heading text-base font-bold text-gray-900">
                  Monthly portfolio PDF
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  A polished report with portfolio value, entered cost basis,
                  unrealized performance, allocation, current holdings, and the
                  selected month&apos;s real buy and sell history.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleEmailNow
            }
            disabled={
              sending ||
              loading
            }
            className="flex min-h-[68px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Mail className="h-4 w-4 text-blue-600" />
                )}
              </div>

              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Email my report now
                </span>

                <p className="mt-0.5 text-xs text-gray-500">
                  Sends the previous completed month to {recipientEmail}
                </p>
              </div>
            </div>
          </button>

          <div className="flex min-h-[68px] items-center justify-between border-t border-gray-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                <CalendarDays className="h-4 w-4 text-violet-600" />
              </div>

              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Automatic monthly email
                </span>

                <p className="mt-0.5 text-xs text-gray-500">
                  {nextReportText}
                </p>
              </div>
            </div>

            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <Switch
                checked={
                  autoReport
                }
                onCheckedChange={
                  toggleAutoReport
                }
                disabled={
                  loading
                }
              />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Report settings
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Currency
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {currency}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Timezone
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                {timezone}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-500">
            Currency follows your StockPulse currency setting. The timezone is
            detected from this device and saved when you enable automatic
            reports or request a report.
          </p>
        </section>

        {message ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Delivery history
            </h2>

            <button
              type="button"
              onClick={
                loadSettings
              }
              disabled={
                loading
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Clock3 className="mx-auto h-6 w-6 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No reports have been requested yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {deliveries.map(
                (delivery) => {
                  const tone =
                    deliveryTone(
                      delivery.status,
                    );
                  const Icon =
                    tone.icon;

                  return (
                    <div
                      key={
                        delivery.id
                      }
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.backgroundClass}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${tone.iconClass}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {formatMonth(
                            delivery.report_month,
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-gray-500">
                          {delivery.delivery_kind ===
                          "manual"
                            ? "Requested manually"
                            : "Automatic report"}

                          {delivery.sent_at
                            ? ` · ${formatTimestamp(
                                delivery.sent_at,
                              )}`
                            : delivery.created_at
                              ? ` · ${formatTimestamp(
                                  delivery.created_at,
                                )}`
                              : ""}
                        </p>

                        {delivery.error_message ? (
                          <p className="mt-1 line-clamp-2 text-xs text-red-600">
                            {
                              delivery.error_message
                            }
                          </p>
                        ) : null}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.backgroundClass} ${tone.textClass}`}
                      >
                        {DELIVERY_LABELS[
                          delivery.status
                        ] ||
                          delivery.status}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        <p className="px-2 text-center text-[11px] leading-5 text-gray-400">
          Market prices may be delayed. Reports use the purchase prices entered
          by the user and are provided for informational purposes only.
        </p>
      </main>
    </div>
  );
}
