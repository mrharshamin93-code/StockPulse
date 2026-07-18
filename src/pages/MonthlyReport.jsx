import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { generateReportPDF } from "@/lib/generateReportPDF";

const getCurrency = () => localStorage.getItem("currency") || "USD";

function downloadPdf(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function MonthlyReport() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("");
  const [autoReport, setAutoReport] = useState(
    () => user?.monthly_report_opt_in ?? (localStorage.getItem("monthlyReport") === "true")
  );

  useEffect(() => {
    if (typeof user?.monthly_report_opt_in === "boolean") {
      setAutoReport(user.monthly_report_opt_in);
    }
  }, [user?.monthly_report_opt_in]);

  const toggleAutoReport = async (val) => {
    setAutoReport(val);
    localStorage.setItem("monthlyReport", String(val));

    if (!user?.id) return;

    await supabase
      .from("profiles")
      .update({ monthly_report_opt_in: val })
      .eq("id", user.id);
  };

  const handleSend = async () => {
    if (!user?.id) return;

    setSending(true);
    setSent(false);

    try {
      setStatus("Loading portfolio data…");

      const [{ data: stocks = [], error: stocksError }, { data: transactions = [], error: txError }] =
        await Promise.all([
          supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id),
          supabase
            .from("stock_transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

      if (stocksError) throw stocksError;
      if (txError) throw txError;

      const currency = getCurrency();

      setStatus("Generating PDF…");
      const pdfBuffer = await generateReportPDF({
        user,
        stocks,
        transactions,
        currency,
      });

      setStatus("Preparing download…");
      downloadPdf(pdfBuffer, "StockPulse-Performance-Report.pdf");

      setSent(true);
      setStatus("");
      setTimeout(() => setSent(false), 5000);
    } catch (e) {
      setStatus("Something went wrong. Please try again.");
      setTimeout(() => setStatus(""), 4000);
    }

    setSending(false);
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title="Performance Report" backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sent ? "bg-emerald-50" : "bg-blue-50"}`}>
                {sent ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : sending ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <div>
                <span className="font-medium text-sm">
                  {sent ? "Report Ready!" : "Download my portfolio performance"}
                </span>
                {status && !sent && (
                  <p className="text-xs text-muted-foreground mt-0.5">{status}</p>
                )}
              </div>
            </div>
          </button>

          <div className="w-full flex items-center justify-between px-5 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="font-medium text-sm">Auto Performance Report</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive a PDF report on the 1st of each month
                </p>
              </div>
            </div>
            <Switch checked={autoReport} onCheckedChange={toggleAutoReport} />
          </div>
        </div>
      </main>
    </div>
  );
}
