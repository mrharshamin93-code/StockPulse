import React, { useState } from "react";
//import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LogOut, Trash2, Bell, ChevronRight, Loader2, Palette, Banknote, Shield, FileText, Mail, Sparkles, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const getDefaultCurrency = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    const region = locale.split("-")[1]?.toUpperCase();
    const map = { US:"USD",CA:"CAD",GB:"GBP",DE:"EUR",FR:"EUR",IT:"EUR",ES:"EUR",JP:"JPY",AU:"AUD",CH:"CHF",IN:"INR",CN:"CNY",BR:"BRL",MX:"MXN",KR:"KRW",SG:"SGD",HK:"HKD",NO:"NOK",SE:"SEK",NZ:"NZD" };
    return map[region] || "USD";
  } catch { return "USD"; }
};
const getCurrency = () => localStorage.getItem("currency") || getDefaultCurrency();

export default function Settings() {
  const { user } = useAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [currency] = useState(getCurrency);


  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // Purge all user data before deleting account
      await Promise.allSettled([
        base44.entities.Stock.deleteMany({ created_by_id: user?.id }),
        base44.entities.StockTransaction.deleteMany({ created_by_id: user?.id }),
        base44.entities.WatchlistItem.deleteMany({ created_by_id: user?.id }),
        base44.entities.SavedScreen.deleteMany({ created_by_id: user?.id }),
        base44.entities.StockAlert.deleteMany({ created_by_id: user?.id }),
      ]);
      await base44.auth.deleteAccount?.();
    } catch {}
    base44.auth.logout("/register");
  };

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)", backgroundColor: "hsl(var(--background))" }}
    >
      {/* Header */}
      <header
        className="border-b border-gray-100"
        style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "hsl(var(--background))" }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Refer & Unlock */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Refer</p>
          <Link
            to="/referral"
            className="block rounded-2xl p-5 hover:opacity-90 hover:-translate-y-0.5 transition-all text-white shadow-md hover:shadow-lg"
            style={{ background: "hsl(var(--primary))" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-heading font-bold text-base leading-tight">Refer &amp; Unlock Premium</p>
                  <p className="text-xs text-white/70 mt-0.5">1 referral = 1 month free · unlimited referrals</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
            </div>
          </Link>
        </div>

        {/* General Section */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">General</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <Link
              to="/price-alerts"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-500" />
                </div>
                <span className="font-medium text-sm">Price Alerts</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              to="/monthly-report"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-500" />
                </div>
                <span className="font-medium text-sm">Performance Report</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              to="/currency"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-green-600" />
                </div>
                <span className="font-medium text-sm">Currency</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">{currency}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          </div>
        </div>

        {/* Appearance */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Appearance</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <Link
              to="/theme"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-violet-500" />
                </div>
                <span className="font-medium text-sm">Colour Theme</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Support */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Support</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <Link
              to="/contact"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                </div>
                <span className="font-medium text-sm">Contact Us</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Legal */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Legal</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <Link
              to="/legal?page=privacy"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-500" />
                </div>
                <span className="font-medium text-sm">Privacy Policy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              to="/legal?page=terms"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <span className="font-medium text-sm">Terms of Service</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Account Section */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Account</p>
          <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium text-sm text-gray-900">Sign Out</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Danger Zone</p>
          <div className="border border-red-200 rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-red-50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <span className="font-medium text-sm text-red-700">Delete Account</span>
                      <p className="text-xs text-gray-500 mt-0.5">Permanently remove your account and all data</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all portfolio data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pt-4">StockPulse · Stock Portfolio</p>
      </main>
    </div>
  );
}
