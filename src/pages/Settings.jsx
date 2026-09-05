// src/pages/Settings.jsx

import React, { useEffect, useState } from "react";
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
import { useAuth } from "@/lib/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const savedCurrency =
    localStorage.getItem("stockpulse_currency") || "USD";

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);

      await logout();

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

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;

    try {
      setIsDeletingAccount(true);

      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "delete-account",
        {
          body: {
            confirmation: "DELETE_ACCOUNT",
          },
        }
      );

      if (error) {
        let detailedMessage = "";

        try {
          if (error?.context?.json) {
            const contextBody = await error.context.json();
            detailedMessage =
              contextBody?.diagnostic ||
              contextBody?.error ||
              "";
          }
        } catch {
          // Best-effort diagnostic extraction only.
        }

        throw new Error(
          detailedMessage ||
            error?.message ||
            "The account could not be deleted."
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.diagnostic ||
            data?.error ||
            "The account could not be deleted."
        );
      }

      try {
        await supabase.auth.signOut({
          scope: "local",
        });
      } catch (signOutError) {
        console.warn(
          "Local sign-out after account deletion failed:",
          signOutError
        );
      }

      try {
        localStorage.removeItem(
          "stockpulse_currency"
        );
      } catch {
        // Local storage cleanup is best-effort.
      }

      setShowDeleteModal(false);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Unable to delete account:",
        error
      );

      window.alert(
        error?.message ||
          "Unable to delete your account right now. Please try again."
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto w-full max-w-[390px] px-6 pb-7">
        {/* PAGE TITLE */}
        <header className="flex h-[70px] items-end justify-center pb-3">
          <h1 className="text-[24px] font-bold tracking-[-0.5px] text-foreground">
            Settings
          </h1>
        </header>

        {/* GENERAL */}
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

        {/* APPEARANCE */}
        <SettingsSection title="APPEARANCE">
          <SettingsRow
            icon={Palette}
            label="Colour Theme"
            onClick={() => navigate("/settings/theme")}
            isLast
          />
        </SettingsSection>

        {/* SUPPORT */}
        <SettingsSection title="SUPPORT">
          <SettingsRow
            icon={Headphones}
            label="Contact Us"
            onClick={() => navigate("/contact-us")}
            isLast
          />
        </SettingsSection>

        {/* LEGAL */}
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

        {/* ACCOUNT */}
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

        {/* DANGER ZONE */}
        <section className="mb-4">
          <SectionHeading>
            DANGER ZONE
          </SectionHeading>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="
              flex
              min-h-[72px]
              w-full
              items-center
              rounded-[20px]
              border
              border-red-300
              bg-card
              px-4
              text-left
              shadow-[0_4px_10px_rgba(0,0,0,0.04)]
              transition-[transform,background-color,border-color]
              duration-150
              ease-out
              active:scale-[0.995]
              active:bg-red-50
              dark:border-red-900/70
              dark:active:bg-red-950/30
            "
          >
            <div className="flex w-[40px] shrink-0 items-center">
              <Trash2
                size={21}
                strokeWidth={2.15}
                className="text-red-600"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[16px] font-medium tracking-[-0.1px] text-red-600">
                Delete Account
              </div>

              <div className="mt-0.5 text-[12px] leading-[1.35] text-muted-foreground">
                Permanently remove your account and all data
              </div>
            </div>

            <ChevronRight
              size={18}
              strokeWidth={2}
              className="shrink-0 text-red-500"
              aria-hidden="true"
            />
          </button>
        </section>

        {/* FOOTER */}
        <p className="pb-1 pt-1 text-center text-[12px] font-medium text-muted-foreground">
          StockPulse · Stock Portfolio
        </p>
      </main>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        deleting={isDeletingAccount}
      />
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <section className="mb-4">
      <SectionHeading>{title}</SectionHeading>
      <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_4px_10px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </section>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="mb-2 px-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
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
        "flex h-[58px] w-full items-center px-4 text-left text-foreground transition-[transform,background-color,opacity] duration-150 ease-out",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "active:scale-[0.995] active:bg-muted/70",
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
          !isLast ? "border-b border-border" : "",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate pr-3 text-[16px] font-medium tracking-[-0.15px] text-foreground">
          {label}
        </span>

        {rightText ? (
          <span className="mr-1.5 shrink-0 text-[15px] font-normal text-muted-foreground">
            {rightText}
          </span>
        ) : null}

        <ChevronRight
          size={18}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground/80"
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
  deleting = false,
}) {
  const [confirmationText, setConfirmationText] = useState("");
  const [viewport, setViewport] = useState(() => ({
    height:
      typeof window !== "undefined"
        ? window.innerHeight
        : 800,
    offsetTop: 0,
    keyboardOpen: false,
  }));

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const updateViewport = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height || window.innerHeight;
      const offsetTop = visualViewport?.offsetTop || 0;
      const keyboardOpen = window.innerHeight - height > 120;

      setViewport({
        height,
        offsetTop,
        keyboardOpen,
      });
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, [open]);

  if (!open) return null;

  const canDelete =
    confirmationText.trim().toUpperCase() === "DELETE";

  const handleClose = () => {
    if (deleting) return;
    setConfirmationText("");
    onClose();
  };

  const handleConfirm = () => {
    if (!canDelete || deleting) return;
    onConfirm();
  };

  const tabBarClearance = viewport.keyboardOpen ? 12 : 84;

  return (
    <div
      className="fixed left-0 right-0 z-[100] flex justify-center bg-black/40 px-3 backdrop-blur-[2px]"
      style={{
        top: `${viewport.offsetTop}px`,
        height: `${viewport.height}px`,
        alignItems: viewport.keyboardOpen ? "center" : "flex-end",
        paddingBottom: `${tabBarClearance}px`,
        paddingTop: "12px",
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm overflow-y-auto rounded-[22px] border border-border bg-card p-5 text-foreground shadow-2xl"
        style={{
          maxHeight: `${Math.max(
            280,
            viewport.height - tabBarClearance - 24
          )}px`,
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
          <Trash2
            size={21}
            strokeWidth={2.1}
            className="text-red-600"
            aria-hidden="true"
          />
        </div>

        <h3 className="text-[20px] font-bold tracking-[-0.3px] text-red-600">
          Delete Account
        </h3>

        <p className="mt-2 text-[14px] leading-5 text-muted-foreground">
          This permanently removes your account and associated StockPulse data. This cannot be undone.
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
          onChange={(event) => setConfirmationText(event.target.value)}
          disabled={deleting}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          placeholder="DELETE"
          className="h-[46px] w-full rounded-[13px] border border-input bg-background px-4 text-[15px] text-foreground outline-none transition-[border-color,box-shadow,opacity] duration-150 placeholder:text-muted-foreground focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-red-950/40"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={deleting}
            className="h-[46px] rounded-[13px] bg-muted text-[15px] font-semibold text-foreground transition-[transform,background-color,opacity] duration-150 active:scale-[0.98] active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canDelete || deleting}
            onClick={handleConfirm}
            className={[
              "h-[46px] rounded-[13px] text-[15px] font-semibold text-white transition-[transform,background-color,opacity] duration-150",
              canDelete && !deleting
                ? "bg-red-600 active:scale-[0.98] active:bg-red-700"
                : "cursor-not-allowed bg-red-300 opacity-70 dark:bg-red-900/60",
            ].join(" ")}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
