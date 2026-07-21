import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LogOut,
  Trash2,
  Bell,
  ChevronRight,
  Loader2,
  Palette,
  Banknote,
  Shield,
  FileText,
  Mail,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const getDefaultCurrency = () => {
  try {
    const locale =
      Intl.DateTimeFormat().resolvedOptions().locale || "";

    const region =
      locale.split("-")[1]?.toUpperCase();

    const map = {
      US: "USD",
      CA: "CAD",
      GB: "GBP",
      DE: "EUR",
      FR: "EUR",
      IT: "EUR",
      ES: "EUR",
      JP: "JPY",
      AU: "AUD",
      CH: "CHF",
      IN: "INR",
      CN: "CNY",
      BR: "BRL",
      MX: "MXN",
      KR: "KRW",
      SG: "SGD",
      HK: "HKD",
      NO: "NOK",
      SE: "SEK",
      NZ: "NZD",
    };

    return map[region] || "USD";
  } catch {
    return "USD";
  }
};

const getCurrency = () =>
  localStorage.getItem("currency") ||
  getDefaultCurrency();

export default function Settings() {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const [
    deletingAccount,
    setDeletingAccount,
  ] = useState(false);

  const [
    deleteAccountError,
    setDeleteAccountError,
  ] = useState("");

  const [currency] =
    useState(getCurrency);

  const handleLogout = async () => {
    try {
      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Failed to sign out:",
        error,
      );
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !user?.id ||
      deletingAccount
    ) {
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError("");

    try {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken =
        sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error(
          "Your session has expired. Sign in again and retry.",
        );
      }

      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL;

      const supabaseAnonKey =
        import.meta.env
          .VITE_SUPABASE_ANON_KEY;

      if (
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        throw new Error(
          "Supabase is not configured correctly.",
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-account`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            apikey:
              supabaseAnonKey,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            confirmation:
              "DELETE_ACCOUNT",
          }),
        },
      );

      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "The account could not be deleted.",
        );
      }

      /*
       * The server has now deleted:
       *
       * 1. The user's application data.
       * 2. The Supabase Auth identity.
       *
       * Only clear the browser's local session after the
       * Edge Function confirms success.
       */
      const {
        error: signOutError,
      } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (signOutError) {
        /*
         * Do not show deletion as failed here.
         *
         * The account has already been permanently deleted.
         * This error only means local session cleanup did not
         * complete normally.
         */
        console.error(
          "Account was deleted, but the local session could not be cleared normally:",
          signOutError,
        );
      }

      navigate("/register", {
        replace: true,

        state: {
          accountDeleted: true,
        },
      });
    } catch (error) {
      console.error(
        "Failed to delete account:",
        error,
      );

      setDeleteAccountError(
        error instanceof Error
          ? error.message
          : "The account could not be deleted.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + 64px)",

        backgroundColor:
          "hsl(var(--background))",
      }}
    >
      <header
        className="border-b border-gray-100"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",

          backgroundColor:
            "hsl(var(--background))",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Settings
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Refer
          </p>

          <Link
            to="/referrals"
            className="block rounded-2xl p-5 hover:opacity-90 hover:-translate-y-0.5 transition-all text-white shadow-md hover:shadow-lg"
            style={{
              background:
                "hsl(var(--primary))",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>

                <div>
                  <p className="font-heading font-bold text-base leading-tight">
                    Refer &amp; Unlock
                    Premium
                  </p>

                  <p className="text-xs text-white/70 mt-0.5">
                    1 referral = 1 month
                    free · unlimited
                    referrals
                  </p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
            </div>
          </Link>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            General
          </p>

          <div
            className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <Link
              to="/price-alerts"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-500" />
                </div>

                <span className="font-medium text-sm">
                  Price Alerts
                </span>
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

                <span className="font-medium text-sm">
                  Performance Report
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>

            <Link
              to="/settings/currency"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-green-600" />
                </div>

                <span className="font-medium text-sm">
                  Currency
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">
                  {currency}
                </span>

                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Appearance
          </p>

          <div
            className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <Link
              to="/settings/theme"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-violet-500" />
                </div>

                <span className="font-medium text-sm">
                  Colour Theme
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Support
          </p>

          <div
            className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <Link
              to="/contact-us"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                </div>

                <span className="font-medium text-sm">
                  Contact Us
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Legal
          </p>

          <div
            className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <Link
              to="/legal?page=privacy"
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-500" />
                </div>

                <span className="font-medium text-sm">
                  Privacy Policy
                </span>
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

                <span className="font-medium text-sm">
                  Terms of Service
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Account
          </p>

          <div
            className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-gray-500" />
                </div>

                <span className="font-medium text-sm text-gray-900">
                  Sign Out
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">
            Danger Zone
          </p>

          <div
            className="border border-red-200 rounded-2xl overflow-hidden shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <AlertDialog
              onOpenChange={(open) => {
                if (
                  open &&
                  !deletingAccount
                ) {
                  setDeleteAccountError(
                    "",
                  );
                }
              }}
            >
              <AlertDialogTrigger
                asChild
              >
                <button
                  type="button"
                  disabled={
                    deletingAccount
                  }
                  className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] hover:bg-red-50 transition-colors text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </div>

                    <div>
                      <span className="font-medium text-sm text-red-700">
                        Delete Account
                      </span>

                      <p className="text-xs text-gray-500 mt-0.5">
                        Permanently remove
                        your account and all
                        data
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete your account?
                  </AlertDialogTitle>

                  <AlertDialogDescription>
                    This will permanently
                    delete your account,
                    portfolio, watchlist,
                    saved screens, alerts,
                    transactions and all
                    associated StockPulse
                    data. This action cannot
                    be undone.
                  </AlertDialogDescription>

                  {deleteAccountError ? (
                    <div
                      role="alert"
                      className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-relaxed text-red-700"
                    >
                      {
                        deleteAccountError
                      }
                    </div>
                  ) : null}
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel
                    disabled={
                      deletingAccount
                    }
                  >
                    Cancel
                  </AlertDialogCancel>

                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();

                      handleDeleteAccount();
                    }}
                    disabled={
                      deletingAccount
                    }
                    className="bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deletingAccount ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      "Delete Account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pt-4">
          StockPulse · Stock
          Portfolio
        </p>
      </main>
    </div>
  );
}
