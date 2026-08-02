// src/pages/Settings.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  FileText,
  Headphones,
  LogOut,
  Palette,
  ShieldCheck,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function Settings() {
  const navigate = useNavigate();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const savedCurrency =
    localStorage.getItem("stockpulse_currency") || "USD";

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Unable to sign out:", error);

      window.alert(
        error?.message ||
          "Unable to sign out. Please try again."
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    /*
      Connect this to your secure server-side
      account-deletion endpoint.

      Never expose the Supabase service-role key
      in frontend code.
    */

    window.alert(
      "Account deletion still needs to be connected to the secure server endpoint."
    );

    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto w-full max-w-lg px-4 pb-7">
        <header className="flex h-[72px] items-end justify-center pb-3">
          <h1 className="text-[24px] font-bold tracking-[-0.5px] text-foreground">
            Settings
          </h1>
        </header>

        <SettingsSection title="GENERAL">
          <SettingsRow
            icon={Bell}
            label="Price Alerts"
            onClick={() => navigate("/price-alerts")}
          />

          <SettingsRow
            icon={TrendingUp}
            label="Performance Report"
            onClick={() => navigate("/monthly-report")}
          />

          <SettingsRow
            icon={WalletCards}
            label="Currency"
            rightText={savedCurrency}
            onClick={() => navigate("/settings/currency")}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="APPEARANCE">
          <SettingsRow
            icon={Palette}
            label="Colour Theme"
            onClick={() => navigate("/settings/theme")}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="SUPPORT">
          <SettingsRow
            icon={Headphones}
            label="Contact Us"
            onClick={() => navigate("/contact-us")}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="LEGAL">
          <SettingsRow
            icon={ShieldCheck}
            label="Privacy Policy"
            onClick={() => navigate("/privacy")}
          />

          <SettingsRow
            icon={FileText}
            label="Terms of Service"
            onClick={() => navigate("/terms")}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="ACCOUNT">
          <SettingsRow
            icon={LogOut}
            label={
              isSigningOut
                ? "Signing Out..."
                : "Sign Out"
            }
            onClick={handleSignOut}
            disabled={isSigningOut}
            isLast
          />
        </SettingsSection>

        <section className="mb-5">
          <h2 className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
            DANGER ZONE
          </h2>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex min-h-[74px] w-full items-center rounded-[18px] border border-red-300 bg-card px-4 text-left shadow-[0_2px_7px_rgba(0,0,0,0.035)] transition-colors active:bg-red-50 dark:border-red-900/70 dark:active:bg-red-950/30"
          >
            <div className="flex w-[40px] shrink-0 items-center">
              <Trash2
                size={21}
                strokeWidth={2.15}
                className="text-red-600"
              />
            </div>

            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[16px] font-medium text-red-600">
                Delete Account
              </div>

              <div className="mt-0.5 text-[12px] leading-[1.35] text-muted-foreground">
                Permanently remove your account and all
                data
              </div>
            </div>

            <ChevronRight
              size={18}
              strokeWidth={2.1}
              className="shrink-0 text-red-500"
            />
          </button>
        </section>

        <p className="pb-1 text-center text-[12px] font-medium text-muted-foreground">
          StockPulse · Stock Portfolio
        </p>
      </main>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_2px_7px_rgba(0,0,0,0.035)]">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  rightText,
  onClick,
  isLast = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-[58px] w-full items-center px-4 text-left text-foreground transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "active:bg-muted/70",
      ].join(" ")}
    >
      <div className="flex w-[40px] shrink-0 items-center">
        <Icon
          size={20}
          strokeWidth={2.1}
          className="text-foreground"
          aria-hidden="true"
        />
      </div>

      <div
        className={[
          "flex h-[58px] min-w-0 flex-1 items-center",
          !isLast
            ? "border-b border-border"
            : "",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate pr-3 text-[16px] font-medium tracking-[-0.15px] text-foreground">
          {label}
        </span>

        {rightText ? (
          <span className="mr-1.5 text-[15px] font-normal text-muted-foreground">
            {rightText}
          </span>
        ) : null}

        <ChevronRight
          size={18}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

function DeleteAccountModal({
  open,
  onClose,
  onConfirm,
}) {
  const [confirmationText, setConfirmationText] =
    useState("");

  if (!open) return null;

  const canDelete =
    confirmationText.trim().toUpperCase() ===
    "DELETE";

  const handleClose = () => {
    setConfirmationText("");
    onClose();
  };

  const handleConfirm = () => {
    if (!canDelete) return;

    setConfirmationText("");
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-[22px] border border-border bg-card p-5 text-foreground shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <Trash2
            size={21}
            strokeWidth={2.1}
            className="text-red-600"
          />
        </div>

        <h3 className="text-[20px] font-bold text-red-600">
          Delete Account
        </h3>

        <p className="mt-2 text-[14px] leading-5 text-muted-foreground">
          This permanently removes your account and
          associated StockPulse data. This cannot be
          undone.
        </p>

        <label
          htmlFor="delete-confirmation"
          className="mb-2 mt-4 block text-[13px] font-semibold text-foreground"
        >
          Type DELETE to confirm
        </label>

        <input
          id="delete-confirmation"
          type="text"
          value={confirmationText}
          onChange={(event) =>
            setConfirmationText(event.target.value)
          }
          autoComplete="off"
          placeholder="DELETE"
          className="h-[46px] w-full rounded-[13px] border border-input bg-background px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950/40"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-[46px] rounded-[13px] bg-muted text-[15px] font-semibold text-foreground transition-colors active:bg-muted/70"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canDelete}
            onClick={handleConfirm}
            className={[
              "h-[46px] rounded-[13px] text-[15px] font-semibold text-white transition-colors",
              canDelete
                ? "bg-red-600 active:bg-red-700"
                : "cursor-not-allowed bg-red-300 dark:bg-red-900/50",
            ].join(" ")}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
