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
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import SubPageHeader from "@/components/SubPageHeader";

const REPORT_BUCKET = "monthly-reports";

const STATUS_LABELS = {
  pending: "Queued",
  processing: "Generating",
  ready: "Ready",
  failed: "Failed",
  skipped: "Skipped",
  sent: "Sent",
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
    localStorage.getItem("currency") ||
    "USD"
  )
    .trim()
    .toUpperCase();
}

function formatMonth(value) {
  if (!value) {
    return "Portfolio report";
  }

  const date = new Date(
    `${value}T00:00:00Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return "Portfolio report";
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

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function formatMoney(value, currency) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(number);
  } catch {
    return `${currency} ${number.toFixed(2)}`;
  }
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatFileSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "PDF";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportTone(status) {
  if (status === "ready" || status === "sent") {
    return {
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
      backgroundClass: "bg-emerald-50",
      textClass: "text-emerald-700",
    };
  }

  if (status === "failed") {
    return {
      icon: AlertCircle,
      iconClass: "text-red-600",
      backgroundClass: "bg-red-50",
      textClass: "text-red-700",
    };
  }

  return {
    icon: Clock3,
    iconClass: "text-blue-600",
    backgroundClass: "bg-blue-50",
    textClass: "text-blue-700",
  };
}


async function getFunctionErrorMessage(
  functionError,
  fallbackMessage,
) {
  try {
    const response =
      functionError?.context;

    if (
      response &&
      typeof response.clone === "function"
    ) {
      const payload =
        await response
          .clone()
          .json()
          .catch(() => null);

      if (
        payload?.error &&
        typeof payload.error === "string"
      ) {
        return payload.error;
      }

      if (
        payload?.message &&
        typeof payload.message === "string"
      ) {
        return payload.message;
      }
    }
  } catch (parseError) {
    console.warn(
      "Could not parse Edge Function error response:",
      parseError,
    );
  }

  return (
    functionError?.message ||
    fallbackMessage
  );
}

async function createReportSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(REPORT_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error("A secure report link could not be created.");
  }

  return data.signedUrl;
}

export default function MonthlyReport() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyReportId, setBusyReportId] = useState("");
  const [autoReport, setAutoReport] = useState(false);
  const [timezone, setTimezone] = useState(getLocalTimezone);
  const [currency] = useState(getCurrency);
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [profileResult, reportsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "monthly_report_opt_in,report_timezone,report_currency,monthly_report_last_generated_at",
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("monthly_report_deliveries")
          .select(
            "id,report_month,delivery_kind,status,report_currency,storage_path,file_name,file_size_bytes,portfolio_value,cost_basis,gain_loss,gain_loss_percent,generated_at,created_at,error_message",
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(12),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      const profile =
        profileResult.data || null;

      setAutoReport(
        Boolean(profile?.monthly_report_opt_in),
      );
      setTimezone(
        profile?.report_timezone || getLocalTimezone(),
      );
      setReports(reportsResult.data || []);
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

  const readyReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === "ready" &&
          report.storage_path,
      ),
    [reports],
  );

  async function toggleAutoReport(enabled) {
    if (!user?.id || saving) {
      return;
    }

    const previous = autoReport;
    const localTimezone = getLocalTimezone();

    setAutoReport(enabled);
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const authMetadata =
        user?.user_metadata &&
        typeof user.user_metadata === "object"
          ? user.user_metadata
          : {};

      const fullName =
        user?.full_name ||
        authMetadata?.full_name ||
        authMetadata?.name ||
        null;

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email:
              user?.email ||
              null,
            full_name:
              fullName,
            monthly_report_opt_in:
              enabled,
            report_timezone:
              localTimezone,
            report_currency:
              currency,
          },
          {
            onConflict: "id",
          },
        );

      if (updateError) {
        throw updateError;
      }

      setTimezone(localTimezone);
      localStorage.setItem(
        "monthlyReport",
        String(enabled),
      );
      setMessage(
        enabled
          ? "Automatic monthly report generation is enabled."
          : "Automatic monthly report generation is disabled.",
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

  async function handleGenerateNow() {
    if (!user?.id || generating) {
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("Generating your private PDF in Supabase…");

    try {
      const localTimezone = getLocalTimezone();
      const { data, error: functionError } =
        await supabase.functions.invoke(
          "monthly-report",
          {
            body: {
              action: "request",
              currency,
              timezone: localTimezone,
            },
          },
        );

      if (functionError) {
        throw new Error(
          await getFunctionErrorMessage(
            functionError,
            "The report could not be generated.",
          ),
        );
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The report could not be generated.",
        );
      }

      setTimezone(localTimezone);
      setMessage(
        "Your report is ready and stored privately in StockPulse.",
      );
      await loadSettings();
    } catch (generateError) {
      console.error(
        "Monthly report generation failed:",
        generateError,
      );
      setMessage("");
      setError(
        generateError?.message ||
          "The report could not be generated. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleView(report) {
    if (!report?.storage_path) {
      return;
    }

    setBusyReportId(report.id);
    setError("");

    try {
      const signedUrl = await createReportSignedUrl(
        report.storage_path,
      );
      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (viewError) {
      console.error("Report open failed:", viewError);
      setError(
        viewError?.message ||
          "The report could not be opened.",
      );
    } finally {
      setBusyReportId("");
    }
  }

  async function handleDownload(report) {
    if (!report?.storage_path) {
      return;
    }

    setBusyReportId(report.id);
    setError("");

    try {
      const signedUrl = await createReportSignedUrl(
        report.storage_path,
      );
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("The report download failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        report.file_name ||
        `StockPulse-${report.report_month.slice(0, 7)}-Portfolio-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error(
        "Report download failed:",
        downloadError,
      );
      setError(
        downloadError?.message ||
          "The report could not be downloaded.",
      );
    } finally {
      setBusyReportId("");
    }
  }

  async function handleEmail(report) {
    if (
      !report?.storage_path ||
      busyReportId
    ) {
      return;
    }

    setBusyReportId(report.id);
    setError("");
    setMessage("");

    try {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.share !== "function"
      ) {
        throw new Error(
          "Email sharing is not supported in this browser. Open StockPulse in Safari on your iPhone and try again.",
        );
      }

      const signedUrl =
        await createReportSignedUrl(
          report.storage_path,
        );

      const response =
        await fetch(signedUrl);

      if (!response.ok) {
        throw new Error(
          "The report could not be prepared for email.",
        );
      }

      const blob =
        await response.blob();

      const fileName =
        report.file_name ||
        `StockPulse-${report.report_month.slice(0, 7)}-Portfolio-Report.pdf`;

      const pdfBlob =
        blob.type === "application/pdf"
          ? blob
          : blob.slice(
              0,
              blob.size,
              "application/pdf",
            );

      const file =
        new File(
          [pdfBlob],
          fileName,
          {
            type:
              "application/pdf",
          },
        );

      if (
        typeof navigator.canShare === "function" &&
        !navigator.canShare({
          files: [file],
        })
      ) {
        throw new Error(
          "This browser cannot attach the PDF to an email. Open StockPulse in Safari on your iPhone and try again.",
        );
      }

      const reportMonth =
        formatMonth(
          report.report_month,
        );

      await navigator.share({
        title:
          `StockPulse ${reportMonth} Portfolio Report`,

        text:
          `Attached is my StockPulse portfolio report for ${reportMonth}.`,

        files: [file],
      });

      setMessage(
        "Report shared successfully.",
      );
    } catch (shareError) {
      if (
        shareError?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "Report email share failed:",
        shareError,
      );

      setError(
        shareError?.message ||
          "The report could not be shared by email.",
      );
    } finally {
      setBusyReportId("");
    }
  }


  async function handleDelete(report) {
    if (!report?.id || busyReportId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the ${formatMonth(report.report_month)} report?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyReportId(report.id);
    setError("");
    setMessage("");

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke(
          "monthly-report",
          {
            body: {
              action: "delete",
              reportId: report.id,
            },
          },
        );

      if (functionError) {
        throw new Error(
          await getFunctionErrorMessage(
            functionError,
            "The report could not be deleted.",
          ),
        );
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The report could not be deleted.",
        );
      }

      setReports((previous) =>
        previous.filter(
          (item) => item.id !== report.id,
        ),
      );
      setMessage("Report deleted.");
    } catch (deleteError) {
      console.error("Report deletion failed:", deleteError);
      setError(
        deleteError?.message ||
          "The report could not be deleted.",
      );
    } finally {
      setBusyReportId("");
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
                <FileText className="h-5 w-5 text-white" />
              </div>

              <div>
                <h2 className="font-heading text-base font-bold text-gray-900">
                  Monthly portfolio PDF
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Generated securely by Supabase using your real holdings,
                  entered purchase prices, current market prices, allocation,
                  unrealized performance, and the month&apos;s recorded buys and
                  sells.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateNow}
            disabled={generating || loading}
            className="flex min-h-[68px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <FileText className="h-4 w-4 text-blue-600" />
                )}
              </div>

              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Generate my report
                </span>
                <p className="mt-0.5 text-xs text-gray-500">
                  Creates the previous completed month and stores it privately
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
                  Automatic monthly report
                </span>
                <p className="mt-0.5 text-xs text-gray-500">
                  {autoReport
                    ? "A new private report will be generated every month"
                    : "Automatic generation is off"}
                </p>
              </div>
            </div>

            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <Switch
                checked={autoReport}
                onCheckedChange={toggleAutoReport}
                disabled={loading}
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
            Only your latest three completed reports are retained to keep
            Supabase Storage usage low. Reports are private and opened with
            short-lived secure links.
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
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                My reports
              </h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {readyReports.length} ready
              </p>
            </div>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : reports.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText className="mx-auto h-7 w-7 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-600">
                No reports yet
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Generate your first monthly portfolio PDF above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report) => {
                const tone = reportTone(report.status);
                const Icon = tone.icon;
                const isReady =
                  report.status === "ready" && report.storage_path;
                const isBusy = busyReportId === report.id;
                const reportCurrency =
                  report.report_currency || currency;

                return (
                  <div
                    key={report.id}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.backgroundClass}`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        ) : (
                          <Icon className={`h-4 w-4 ${tone.iconClass}`} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatMonth(report.report_month)}
                            </p>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.backgroundClass} ${tone.textClass}`}
                            >
                              {STATUS_LABELS[report.status] || report.status}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelete(report)}
                            disabled={Boolean(busyReportId)}
                            aria-label={`Delete ${formatMonth(
                              report.report_month,
                            )} report`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {isReady ? (
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                Value
                              </p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-gray-700">
                                {formatMoney(
                                  report.portfolio_value,
                                  reportCurrency,
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                P&amp;L
                              </p>
                              <p
                                className={`mt-0.5 truncate text-xs font-semibold ${
                                  Number(report.gain_loss) >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatMoney(
                                  report.gain_loss,
                                  reportCurrency,
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                Return
                              </p>
                              <p
                                className={`mt-0.5 text-xs font-semibold ${
                                  Number(report.gain_loss_percent) >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatPercent(report.gain_loss_percent)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                File
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-gray-700">
                                {formatFileSize(report.file_size_bytes)}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <p className="mt-2 text-[11px] text-gray-400">
                          {formatTimestamp(
                            report.generated_at || report.created_at,
                          )}
                        </p>

                        {report.status === "failed" && report.error_message ? (
                          <p className="mt-2 text-xs leading-5 text-red-600">
                            {report.error_message}
                          </p>
                        ) : null}

                        {isReady ? (
                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleView(report)}
                              disabled={Boolean(busyReportId)}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(report)}
                              disabled={Boolean(busyReportId)}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleEmail(report)}
                              disabled={Boolean(busyReportId)}
                              className="h-8 gap-1.5 text-xs"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </Button>

                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="px-1 text-center text-[11px] leading-5 text-gray-400">
          Reports use your entered portfolio data and available market prices.
          Market data may be delayed. StockPulse does not provide financial
          advice.
        </p>
      </main>
    </div>
  );
}
