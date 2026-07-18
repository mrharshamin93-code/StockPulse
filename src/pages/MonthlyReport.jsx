import React, { useState } from "react";
//import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { generateReportPDF } from "@/lib/generateReportPDF";

const getCurrency = () => localStorage.getItem("currency") || "USD";

export default function MonthlyReport() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("");
  const [autoReport, setAutoReport] = useState(() =>
    user?.monthly_report_opt_in ?? (localStorage.getItem("monthlyReport") === "true")
  );

  const toggleAutoReport = async (val) => {
    setAutoReport(val);
    localStorage.setItem("monthlyReport", String(val));
    await base44.auth.updateMe({ monthly_report_opt_in: val });
  };

  const handleSend = async () => {
    if (!user?.email) return;
    setSending(true);
    setSent(false);
    try {
      setStatus("Loading portfolio data…");
      const stocks = await base44.entities.Stock.filter({ created_by_id: user.id });
      const transactions = await base44.entities.StockTransaction.filter({ created_by_id: user.id }, "-created_date", 50);
      const currency = getCurrency();

      setStatus("Generating PDF…");
      const pdfBuffer = await generateReportPDF({ user, stocks, transactions, currency });

      setStatus("Uploading report…");
      const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
      const pdfFile = new File([pdfBlob], "StockPulse-Performance-Report.pdf", { type: "application/pdf" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

      setStatus("Sending email…");
      const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Your StockPulse Performance Report — ${month}`,
        body: file_url,
      });

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
          {/* Send now */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sent ? "bg-emerald-50" : "bg-blue-50"}`}>
                {sent
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : sending
                    ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    : <Mail className="w-4 h-4 text-blue-500" />
                }
              </div>
              <div>
                <span className="font-medium text-sm">{sent ? "Report Sent!" : "Email my portfolio performance"}</span>
                {status && !sent && (
                  <p className="text-xs text-muted-foreground mt-0.5">{status}</p>
                )}

              </div>
            </div>
          </button>

          {/* Auto send toggle */}
          <div className="w-full flex items-center justify-between px-5 py-4 min-h-[56px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="font-medium text-sm">Auto Performance Report</span>
                <p className="text-xs text-muted-foreground mt-0.5">Receive a PDF report on the 1st of each month</p>
              </div>
            </div>
            <Switch checked={autoReport} onCheckedChange={toggleAutoReport} />
          </div>
        </div>
      </main>
    </div>
  );
}
