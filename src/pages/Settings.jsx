import React, {
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  Banknote,
  Bell,
  ChevronRight,
  FileText,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Palette,
  Shield,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

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

function SettingsLink({
  to,
  icon: Icon,
  iconClassName,
  iconBackground,
  label,
  trailing,
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[56px] w-full items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBackground}`}
        >
          <Icon
            className={`h-4 w-4 ${iconClassName}`}
          />
        </div>

        <span className="text-sm font-medium">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {trailing}

        <ChevronRight className="h-4 w-4 text-gray-400" />
      </div>
    </Link>
  );
}

export default function Settings() {
  const navigate = useNavigate();

  const {
    user,
    logout,
    preferences,
    isLoadingPreferences,
  } = useAuth();

  const [
    deletingAccount,
    setDeletingAccount,
  ] = useState(false);

  const [
    deleteAccountError,
    setDeleteAccountError,
  ] = useState("");

  const currency =
    preferences?.currency ||
    "USD";

  const handleLogout =
    async () => {
      try {
        await logout();

        navigate(
          "/login",
          {
            replace: true,
          },
        );
      } catch (error) {
        console.error(
          "Failed to sign out:",
          error,
        );
      }
    };

  const handleDeleteAccount =
    async () => {
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
          await supabase.auth
            .getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken =
          sessionData.session
            ?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your session has expired. Sign in again and retry.",
          );
        }

        const supabaseUrl =
          import.meta.env
            .VITE_SUPABASE_URL;

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

        const response =
          await fetch(
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

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.error ||
              "The account could not be deleted.",
          );
        }

        const {
          error: signOutError,
        } =
          await supabase.auth
            .signOut({
              scope: "local",
            });

        if (signOutError) {
          console.error(
            "Account was deleted, but the local session could not be cleared normally:",
            signOutError,
          );
        }

        navigate(
          "/register",
          {
            replace: true,

            state: {
              accountDeleted:
                true,
            },
          },
        );
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
        setDeletingAccount(
          false,
        );
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
        <div className="mx-auto max-w-2xl px-4 py-5 text-center sm:px-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Settings
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            General
          </p>

          <div
            className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <SettingsLink
              to="/price-alerts"
              icon={Bell}
              iconBackground="bg-amber-100/75"
              iconClassName="text-amber-500"
              label="Price Alerts"
            />

            <SettingsLink
              to="/monthly-report"
              icon={Mail}
              iconBackground="bg-blue-100/75"
              iconClassName="text-blue-500"
              label="Performance Report"
            />

            <SettingsLink
              to="/settings/currency"
              icon={Banknote}
              iconBackground="bg-green-100/75"
              iconClassName="text-green-600"
              label="Currency"
              trailing={
                <span className="text-sm font-medium text-gray-500">
                  {isLoadingPreferences
                    ? "…"
                    : currency}
                </span>
              }
            />
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Appearance
          </p>

          <div
            className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <SettingsLink
              to="/settings/theme"
              icon={Palette}
              iconBackground="bg-violet-100/75"
              iconClassName="text-violet-500"
              label="Colour Theme"
            />
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Support
          </p>

          <div
            className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <SettingsLink
              to="/contact-us"
              icon={MessageSquare}
              iconBackground="bg-teal-100/75"
              iconClassName="text-teal-500"
              label="Contact Us"
            />
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Legal
          </p>

          <div
            className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <SettingsLink
              to="/privacy"
              icon={Shield}
              iconBackground="bg-blue-100/75"
              iconClassName="text-blue-500"
              label="Privacy Policy"
            />

            <SettingsLink
              to="/terms"
              icon={FileText}
              iconBackground="bg-blue-100/75"
              iconClassName="text-blue-500"
              label="Terms of Service"
            />
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Account
          </p>

          <div
            className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <button
              type="button"
              onClick={
                handleLogout
              }
              className="flex min-h-[56px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
                  <LogOut className="h-4 w-4 text-gray-500" />
                </div>

                <span className="text-sm font-medium text-gray-900">
                  Sign Out
                </span>
              </div>

              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            Danger Zone
          </p>

          <div
            className="overflow-hidden rounded-2xl border border-red-200 shadow-sm"
            style={{
              backgroundColor:
                "hsl(var(--card))",
            }}
          >
            <AlertDialog
              onOpenChange={(
                open,
              ) => {
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
                  className="flex min-h-[56px] w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100/75">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>

                    <div>
                      <span className="text-sm font-medium text-red-700">
                        Delete Account
                      </span>

                      <p className="mt-0.5 text-xs text-gray-500">
                        Permanently remove
                        your account and
                        all data
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-red-400" />
                </button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete your
                    account?
                  </AlertDialogTitle>

                  <AlertDialogDescription>
                    This will
                    permanently delete
                    your account,
                    portfolio,
                    watchlist, saved
                    screens, alerts,
                    transactions and
                    all associated
                    StockPulse data.
                    This action cannot
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
                    onClick={(
                      event,
                    ) => {
                      event.preventDefault();

                      void handleDeleteAccount();
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
        </section>

        <p className="pt-4 text-center text-xs text-gray-400">
          StockPulse · Stock
          Portfolio
        </p>
      </main>
    </div>
  );
}
