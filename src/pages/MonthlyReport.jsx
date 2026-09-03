// src/pages/MonthlyReport.jsx

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
  TrendingDown,
  TrendingUp,
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
    return `${Math.max(
      1,
      Math.round(bytes / 1024),
    )} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function reportTone(status) {
  if (
    status === "ready" ||
    status === "sent"
  ) {
    return {
      icon: CheckCircle2,
      iconClass:
        "text-emerald-600",
      backgroundClass:
        "bg-emerald-500/10",
      textClass:
        "text-emerald-600",
      borderClass:
        "border-emerald-500/20",
    };
  }

  if (status === "failed") {
    return {
      icon: AlertCircle,
      iconClass:
        "text-red-600",
      backgroundClass:
        "bg-red-500/10",
      textClass:
        "text-red-600",
      borderClass:
        "border-red-500/20",
    };
  }

  return {
    icon: Clock3,
    iconClass:
      "text-blue-600",
    backgroundClass:
      "bg-blue-500/10",
    textClass:
      "text-blue-600",
    borderClass:
      "border-blue-500/20",
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
      typeof response.clone ===
        "function"
    ) {
      const payload =
        await response
          .clone()
          .json()
          .catch(() => null);

      if (
        payload?.error &&
        typeof payload.error ===
          "string"
      ) {
        return payload.error;
      }

      if (
        payload?.message &&
        typeof payload.message ===
          "string"
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

async function createReportSignedUrl(
  storagePath,
) {
  const { data, error } =
    await supabase.storage
      .from(REPORT_BUCKET)
      .createSignedUrl(
        storagePath,
        60,
      );

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error(
      "A secure report link could not be created.",
    );
  }

  return data.signedUrl;
}

function SectionLabel({ children }) {
  return (
    <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
  icon: Icon,
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-foreground";

  return (
    <div className="rounded-[17px] border border-border/80 bg-card px-3.5 py-3.5 shadow-[0_2px_7px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>

        {Icon ? (
          <Icon
            size={15}
            strokeWidth={2}
            className={toneClass}
          />
        ) : null}
      </div>

      <p
        className={[
          "mt-1.5 truncate text-[16px] font-bold tracking-[-0.3px]",
          toneClass,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

export default function MonthlyReport() {
  const { user } = useAuth();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    busyReportId,
    setBusyReportId,
  ] = useState("");

  const [
    autoReport,
    setAutoReport,
  ] = useState(false);

  const [timezone, setTimezone] =
    useState(getLocalTimezone);

  const [currency] =
    useState(getCurrency);

  const [reports, setReports] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

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
          reportsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "monthly_report_opt_in,report_timezone,report_currency,monthly_report_last_generated_at",
            )
            .eq(
              "id",
              user.id,
            )
            .maybeSingle(),

          supabase
            .from(
              "monthly_report_deliveries",
            )
            .select(
              "id,report_month,delivery_kind,status,report_currency,storage_path,file_name,file_size_bytes,portfolio_value,cost_basis,gain_loss,gain_loss_percent,generated_at,created_at,error_message",
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
            .limit(12),
        ]);

        if (
          profileResult.error
        ) {
          throw profileResult.error;
        }

        if (
          reportsResult.error
        ) {
          throw reportsResult.error;
        }

        const profile =
          profileResult.data ||
          null;

        setAutoReport(
          Boolean(
            profile?.monthly_report_opt_in,
          ),
        );

        setTimezone(
          profile?.report_timezone ||
            getLocalTimezone(),
        );

        setReports(
          reportsResult.data ||
            [],
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

  const readyReports =
    useMemo(
      () => {
        const seenMonths = new Set();

        return reports.filter((report) => {
          if (
            report.status !== "ready" ||
            !report.storage_path ||
            seenMonths.has(report.report_month)
          ) {
            return false;
          }

          seenMonths.add(report.report_month);
          return true;
        });
      },
      [reports],
    );

  const latestReadyReport =
    readyReports[0] ||
    null;

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

    const localTimezone =
      getLocalTimezone();

    setAutoReport(enabled);
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const authMetadata =
        user?.user_metadata &&
        typeof user.user_metadata ===
          "object"
          ? user.user_metadata
          : {};

      const fullName =
        user?.full_name ||
        authMetadata?.full_name ||
        authMetadata?.name ||
        null;

      const {
        error: updateError,
      } = await supabase
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
            onConflict:
              "id",
          },
        );

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

      setAutoReport(
        previous,
      );

      setError(
        saveError?.message ||
          "Unable to update the report preference.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateNow() {
    if (
      !user?.id ||
      generating
    ) {
      return;
    }

    setGenerating(true);
    setError("");
    setMessage(
      "Generating your private PDF…",
    );

    try {
      const localTimezone =
        getLocalTimezone();

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          "monthly-report",
          {
            body: {
              action:
                "request",

              currency,

              timezone:
                localTimezone,
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

      setTimezone(
        localTimezone,
      );

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

  async function handleView(
    report,
  ) {
    if (
      !report?.storage_path
    ) {
      return;
    }

    setBusyReportId(
      report.id,
    );

    setError("");

    try {
      const signedUrl =
        await createReportSignedUrl(
          report.storage_path,
        );

      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (viewError) {
      console.error(
        "Report open failed:",
        viewError,
      );

      setError(
        viewError?.message ||
          "The report could not be opened.",
      );
    } finally {
      setBusyReportId("");
    }
  }

  async function handleDownload(
    report,
  ) {
    if (
      !report?.storage_path
    ) {
      return;
    }

    setBusyReportId(
      report.id,
    );

    setError("");

    try {
      const signedUrl =
        await createReportSignedUrl(
          report.storage_path,
        );

      const response =
        await fetch(
          signedUrl,
        );

      if (!response.ok) {
        throw new Error(
          "The report download failed.",
        );
      }

      const blob =
        await response.blob();

      const objectUrl =
        URL.createObjectURL(
          blob,
        );

      const link =
        document.createElement(
          "a",
        );

      link.href =
        objectUrl;

      link.download =
        report.file_name ||
        `StockPulse-${report.report_month.slice(
          0,
          7,
        )}-Portfolio-Report.pdf`;

      document.body.appendChild(
        link,
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(
        objectUrl,
      );
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

  async function handleEmail(
    report,
  ) {
    if (
      !report?.storage_path ||
      busyReportId
    ) {
      return;
    }

    setBusyReportId(
      report.id,
    );

    setError("");
    setMessage("");

    try {
      if (
        typeof navigator ===
          "undefined" ||
        typeof navigator.share !==
          "function"
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
        await fetch(
          signedUrl,
        );

      if (!response.ok) {
        throw new Error(
          "The report could not be prepared for email.",
        );
      }

      const blob =
        await response.blob();

      const fileName =
        report.file_name ||
        `StockPulse-${report.report_month.slice(
          0,
          7,
        )}-Portfolio-Report.pdf`;

      const pdfBlob =
        blob.type ===
        "application/pdf"
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
        typeof navigator.canShare ===
          "function" &&
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

  async function handleDelete(
    report,
  ) {
    if (
      !report?.id ||
      busyReportId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete the ${formatMonth(
          report.report_month,
        )} report?`,
      );

    if (!confirmed) {
      return;
    }

    setBusyReportId(
      report.id,
    );

    setError("");
    setMessage("");

    try {
      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          "monthly-report",
          {
            body: {
              action:
                "delete",

              reportId:
                report.id,
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

      setReports(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              report.id,
          ),
      );

      setMessage(
        "Report deleted.",
      );
    } catch (deleteError) {
      console.error(
        "Report deletion failed:",
        deleteError,
      );

      setError(
        deleteError?.message ||
          "The report could not be deleted.",
      );
    } finally {
      setBusyReportId("");
    }
  }

  const latestCurrency =
    latestReadyReport?.report_currency ||
    currency;

  const latestReturn =
    Number(
      latestReadyReport?.gain_loss_percent,
    );

  const latestGain =
    Number(
      latestReadyReport?.gain_loss,
    );

  const latestPositive =
    Number.isFinite(
      latestReturn,
    )
      ? latestReturn >= 0
      : Number.isFinite(
            latestGain,
          )
        ? latestGain >= 0
        : true;

  return (
    <div
      className="min-h-full bg-background text-foreground"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 72px)",
      }}
    >
      <SubPageHeader
        title="Performance Report"
        backPath="/settings"
      />

      <main className="mx-auto w-full max-w-[430px] space-y-5 px-4 pb-7 pt-4">
        {latestReadyReport ? (
          <section>
            <SectionLabel>
              Latest Report
            </SectionLabel>

            <div className="rounded-[22px] border border-border bg-card p-4 shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {formatMonth(
                      latestReadyReport.report_month,
                    )}
                  </p>

                  <h1 className="mt-1 text-[22px] font-bold tracking-[-0.55px]">
                    Portfolio Performance
                  </h1>
                </div>

                <div
                  className={[
                    "inline-flex h-[30px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold",
                    latestPositive
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600",
                  ].join(
                    " ",
                  )}
                >
                  {latestPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}

                  {formatPercent(
                    latestReadyReport.gain_loss_percent,
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MetricCard
                  label="Value"
                  value={formatMoney(
                    latestReadyReport.portfolio_value,
                    latestCurrency,
                  )}
                />

                <MetricCard
                  label="P&L"
                  value={formatMoney(
                    latestReadyReport.gain_loss,
                    latestCurrency,
                  )}
                  tone={
                    latestPositive
                      ? "positive"
                      : "negative"
                  }
                />

                <MetricCard
                  label="Return"
                  value={formatPercent(
                    latestReadyReport.gain_loss_percent,
                  )}
                  tone={
                    latestPositive
                      ? "positive"
                      : "negative"
                  }
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    handleView(
                      latestReadyReport,
                    )
                  }
                  disabled={Boolean(
                    busyReportId,
                  )}
                  className="h-[40px] gap-1.5 rounded-[12px] px-2 text-[11px]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    handleDownload(
                      latestReadyReport,
                    )
                  }
                  disabled={Boolean(
                    busyReportId,
                  )}
                  className="h-[40px] gap-1.5 rounded-[12px] px-2 text-[11px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    handleEmail(
                      latestReadyReport,
                    )
                  }
                  disabled={Boolean(
                    busyReportId,
                  )}
                  className="h-[40px] gap-1.5 rounded-[12px] px-2 text-[11px]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Share
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <SectionLabel>
            Report Controls
          </SectionLabel>

          <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
            <button
              type="button"
              onClick={
                handleGenerateNow
              }
              disabled={
                generating ||
                loading
              }
              className="flex min-h-[68px] w-full items-center gap-3 px-4 text-left transition-colors active:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-blue-500/10 text-blue-600">
                {generating ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <FileText className="h-4.5 w-4.5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  Generate Report
                </p>

                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  Create a private PDF for the previous completed month
                </p>
              </div>

              <span className="text-[11px] font-semibold text-muted-foreground">
                {generating
                  ? "Generating…"
                  : "Generate"}
              </span>
            </button>

            <div className="mx-4 border-t border-border/80" />

            <div className="flex min-h-[68px] items-center gap-3 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-violet-500/10 text-violet-600">
                <CalendarDays className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  Automatic Monthly Report
                </p>

                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  {autoReport
                    ? "A private report will be generated every month"
                    : "Automatic generation is turned off"}
                </p>
              </div>

              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
          </div>
        </section>

        <section>
          <SectionLabel>
            Settings
          </SectionLabel>

          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Currency"
              value={currency}
            />

            <MetricCard
              label="Timezone"
              value={timezone}
            />
          </div>

          <p className="mt-2 px-2 text-[11px] leading-4 text-muted-foreground">
            The latest three completed reports are retained. Reports are private and use short-lived secure links.
          </p>
        </section>

        {message ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-[16px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[12px] leading-5 text-emerald-600"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {message}
            </span>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] leading-5 text-red-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error}
            </span>
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between px-2">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Report History
              </h2>

              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {readyReports.length} ready
              </p>
            </div>

            <button
              type="button"
              onClick={
                loadSettings
              }
              disabled={
                loading
              }
              className="inline-flex h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors active:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-3.5 w-3.5",
                  loading
                    ? "animate-spin"
                    : "",
                ].join(
                  " ",
                )}
              />

              Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_3px_10px_rgba(0,0,0,0.035)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length ===
              0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>

                <p className="mt-3 text-[14px] font-semibold">
                  No reports yet
                </p>

                <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-4 text-muted-foreground">
                  Generate your first monthly portfolio report above.
                </p>
              </div>
            ) : (
              reports.map(
                (
                  report,
                  index,
                ) => {
                  const tone =
                    reportTone(
                      report.status,
                    );

                  const Icon =
                    tone.icon;

                  const isReady =
                    report.status ===
                      "ready" &&
                    report.storage_path;

                  const isBusy =
                    busyReportId ===
                    report.id;

                  const reportCurrency =
                    report.report_currency ||
                    currency;

                  const reportPositive =
                    Number(
                      report.gain_loss_percent,
                    ) >= 0;

                  return (
                    <div
                      key={
                        report.id
                      }
                      className={[
                        "px-4 py-4",
                        index <
                        reports.length -
                          1
                          ? "border-b border-border/80"
                          : "",
                      ].join(
                        " ",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]",
                            tone.backgroundClass,
                          ].join(
                            " ",
                          )}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Icon
                              className={[
                                "h-4 w-4",
                                tone.iconClass,
                              ].join(
                                " ",
                              )}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold">
                                {formatMonth(
                                  report.report_month,
                                )}
                              </p>

                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={[
                                    "rounded-full border px-2 py-0.5 text-[9px] font-semibold",
                                    tone.backgroundClass,
                                    tone.textClass,
                                    tone.borderClass,
                                  ].join(
                                    " ",
                                  )}
                                >
                                  {STATUS_LABELS[
                                    report.status
                                  ] ||
                                    report.status}
                                </span>

                                <span className="truncate text-[10px] text-muted-foreground">
                                  {formatTimestamp(
                                    report.generated_at ||
                                      report.created_at,
                                  )}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  report,
                                )
                              }
                              disabled={Boolean(
                                busyReportId,
                              )}
                              aria-label={`Delete ${formatMonth(
                                report.report_month,
                              )} report`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-red-500 transition-colors active:bg-red-500/10 disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {isReady ? (
                            <>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded-[12px] bg-background/60 px-2.5 py-2">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                                    Value
                                  </p>

                                  <p className="mt-1 truncate text-[11px] font-bold">
                                    {formatMoney(
                                      report.portfolio_value,
                                      reportCurrency,
                                    )}
                                  </p>
                                </div>

                                <div className="rounded-[12px] bg-background/60 px-2.5 py-2">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                                    P&L
                                  </p>

                                  <p
                                    className={[
                                      "mt-1 truncate text-[11px] font-bold",
                                      reportPositive
                                        ? "text-emerald-600"
                                        : "text-red-600",
                                    ].join(
                                      " ",
                                    )}
                                  >
                                    {formatMoney(
                                      report.gain_loss,
                                      reportCurrency,
                                    )}
                                  </p>
                                </div>

                                <div className="rounded-[12px] bg-background/60 px-2.5 py-2">
                                  <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                                    Return
                                  </p>

                                  <p
                                    className={[
                                      "mt-1 text-[11px] font-bold",
                                      reportPositive
                                        ? "text-emerald-600"
                                        : "text-red-600",
                                    ].join(
                                      " ",
                                    )}
                                  >
                                    {formatPercent(
                                      report.gain_loss_percent,
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatFileSize(
                                    report.file_size_bytes,
                                  )}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-3 gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    handleView(
                                      report,
                                    )
                                  }
                                  disabled={Boolean(
                                    busyReportId,
                                  )}
                                  className="h-[36px] gap-1 rounded-[10px] px-2 text-[10px]"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    handleDownload(
                                      report,
                                    )
                                  }
                                  disabled={Boolean(
                                    busyReportId,
                                  )}
                                  className="h-[36px] gap-1 rounded-[10px] px-2 text-[10px]"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Save
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    handleEmail(
                                      report,
                                    )
                                  }
                                  disabled={Boolean(
                                    busyReportId,
                                  )}
                                  className="h-[36px] gap-1 rounded-[10px] px-2 text-[10px]"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  Share
                                </Button>
                              </div>
                            </>
                          ) : null}

                          {report.status ===
                            "failed" &&
                          report.error_message ? (
                            <p className="mt-2 text-[11px] leading-4 text-red-600">
                              {
                                report.error_message
                              }
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                },
              )
            )}
          </div>
        </section>

        <p className="px-3 text-center text-[10px] leading-4 text-muted-foreground">
          Reports use your entered portfolio data and available market prices. Market data may be delayed. StockPulse does not provide financial advice.
        </p>
      </main>
    </div>
  );
}
