// src/pages/Settings.jsx

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  Headphones,
  LineChart,
  LogOut,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

const APP_ACCENT = "#c73659";

export default function Settings() {
  const navigate = useNavigate();

  const [currency, setCurrency] = useState("USD");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const currencyOptions = useMemo(
    () => [
      { code: "USD", label: "US Dollar" },
      { code: "CAD", label: "Canadian Dollar" },
      { code: "EUR", label: "Euro" },
      { code: "GBP", label: "British Pound" },
    ],
    []
  );

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Unable to sign out:", error);
      window.alert(
        error?.message || "Unable to sign out. Please try again."
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    /*
      Connect this to your secure server-side account-deletion endpoint.

      Do not delete the Supabase Auth user directly from the browser.
      The service-role key must never be exposed in frontend code.

      Example:

      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to delete account");
      }
    */

    window.alert(
      "Connect this button to your secure account-deletion API endpoint."
    );

    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-dvh bg-[#f7f7f7] text-[#111111]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <main className="flex-1 px-4 pb-32">
          <header className="flex h-[116px] items-end justify-center pb-6">
            <h1 className="text-[30px] font-bold tracking-[-0.9px]">
              Settings
            </h1>
          </header>

          <SettingsSection title="GENERAL">
            <SettingsRow
              icon={Bell}
              label="Price Alerts"
              onClick={() => navigate("/settings/price-alerts")}
            />

            <SettingsRow
              icon={TrendingUp}
              label="Performance Report"
              onClick={() => navigate("/settings/performance-report")}
            />

            <SettingsRow
              icon={WalletCards}
              label="Currency"
              rightText={currency}
              onClick={() => setShowCurrencyModal(true)}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="APPEARANCE">
            <SettingsRow
              icon={Palette}
              label="Colour Theme"
              onClick={() => navigate("/settings/colour-theme")}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="SUPPORT">
            <SettingsRow
              icon={Headphones}
              label="Contact Us"
              onClick={() => navigate("/contact")}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="LEGAL">
            <SettingsRow
              icon={ShieldCheck}
              label="Privacy Policy"
              onClick={() => navigate("/privacy-policy")}
            />

            <SettingsRow
              icon={FileText}
              label="Terms of Service"
              onClick={() => navigate("/terms-of-service")}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="ACCOUNT">
            <SettingsRow
              icon={LogOut}
              label={isSigningOut ? "Signing Out..." : "Sign Out"}
              disabled={isSigningOut}
              onClick={handleSignOut}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="DANGER ZONE">
            <DangerRow
              icon={Trash2}
              label="Delete Account"
              description="Permanently remove your account and all data"
              onClick={() => setShowDeleteModal(true)}
            />
          </SettingsSection>

          <p className="pb-4 pt-2 text-center text-[16px] font-medium text-[#858585]">
            StockPulse · Stock Portfolio
          </p>
        </main>

        <BottomNavigation
          activeItem="settings"
          onNavigate={(path) => navigate(path)}
        />
      </div>

      <CurrencyModal
        open={showCurrencyModal}
        currentCurrency={currency}
        currencies={currencyOptions}
        onClose={() => setShowCurrencyModal(false)}
        onSelect={(selectedCurrency) => {
          setCurrency(selectedCurrency);
          localStorage.setItem(
            "stockpulse_currency",
            selectedCurrency
          );
          setShowCurrencyModal(false);
        }}
      />

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
    <section className="mb-8">
      <h2 className="mb-3 px-2 text-[14px] font-semibold tracking-[1.1px] text-[#656565]">
        {title}
      </h2>

      <div className="overflow-hidden rounded-[22px] border border-[#e3e3e3] bg-white shadow-[0_3px_10px_rgba(0,0,0,0.055)]">
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
        "group relative flex min-h-[86px] w-full items-center px-5 text-left",
        "transition-colors duration-150",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "active:bg-[#f2f2f2]",
      ].join(" ")}
    >
      <div className="flex w-[58px] shrink-0 items-center justify-start">
        <Icon
          size={31}
          strokeWidth={2.15}
          className="text-black"
          aria-hidden="true"
        />
      </div>

      <div
        className={[
          "flex min-h-[86px] flex-1 items-center",
          !isLast ? "border-b border-[#e2e2e2]" : "",
        ].join(" ")}
      >
        <span className="flex-1 pr-4 text-[20px] font-semibold tracking-[-0.35px] text-[#151515]">
          {label}
        </span>

        {rightText ? (
          <span className="mr-2 text-[18px] font-semibold text-[#777777]">
            {rightText}
          </span>
        ) : null}

        <ChevronRight
          size={25}
          strokeWidth={2.25}
          className="shrink-0 text-[#666666]"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

function DangerRow({
  icon: Icon,
  label,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[112px] w-full items-center rounded-[22px] border border-[#ff8787] bg-white px-5 text-left shadow-[0_3px_10px_rgba(0,0,0,0.035)] active:bg-red-50"
    >
      <div className="flex w-[58px] shrink-0 items-center justify-start">
        <Icon
          size={32}
          strokeWidth={2.2}
          className="text-red-600"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1 pr-3">
        <div className="text-[20px] font-semibold tracking-[-0.3px] text-red-600">
          {label}
        </div>

        <div className="mt-1 text-[15px] font-medium leading-[1.35] text-[#757575]">
          {description}
        </div>
      </div>

      <ChevronRight
        size={26}
        strokeWidth={2.3}
        className="shrink-0 text-red-500"
        aria-hidden="true"
      />
    </button>
  );
}

function BottomNavigation({ activeItem, onNavigate }) {
  const navItems = [
    {
      id: "watchlist",
      label: "Watchlist",
      icon: Star,
      path: "/watchlist",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: BriefcaseBusiness,
      path: "/portfolio",
    },
    {
      id: "analysis",
      label: "Analysis",
      icon: LineChart,
      path: "/analysis",
    },
    {
      id: "screener",
      label: "Screener",
      icon: SlidersHorizontal,
      path: "/screener",
    },
    {
      id: "settings",
      label: "Settings",
      icon: SettingsIcon,
      path: "/settings",
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dddddd] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid h-[88px] w-full max-w-[430px] grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className="relative flex min-w-0 flex-col items-center justify-center gap-1 px-1"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={28}
                strokeWidth={isActive ? 2.3 : 2}
                style={{
                  color: isActive ? APP_ACCENT : "#666666",
                }}
                aria-hidden="true"
              />

              <span
                className="max-w-full truncate text-[12px] font-semibold"
                style={{
                  color: isActive ? APP_ACCENT : "#666666",
                }}
              >
                {item.label}
              </span>

              {isActive ? (
                <span
                  className="absolute bottom-[7px] h-[3px] w-8 rounded-full"
                  style={{ backgroundColor: APP_ACCENT }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CurrencyModal({
  open,
  currentCurrency,
  currencies,
  onClose,
  onSelect,
}) {
  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="w-full rounded-[26px] bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-[23px] font-bold tracking-[-0.5px]">
            Select Currency
          </h3>

          <p className="mt-1 text-[15px] text-[#777777]">
            Choose how monetary values appear in StockPulse.
          </p>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#e5e5e5]">
          {currencies.map((currencyOption, index) => {
            const isSelected =
              currentCurrency === currencyOption.code;

            return (
              <button
                key={currencyOption.code}
                type="button"
                onClick={() => onSelect(currencyOption.code)}
                className={[
                  "flex min-h-[66px] w-full items-center px-4 text-left active:bg-[#f2f2f2]",
                  index !== currencies.length - 1
                    ? "border-b border-[#e5e5e5]"
                    : "",
                ].join(" ")}
              >
                <div className="flex-1">
                  <div className="text-[17px] font-semibold">
                    {currencyOption.code}
                  </div>

                  <div className="text-[14px] text-[#777777]">
                    {currencyOption.label}
                  </div>
                </div>

                <div
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border-2",
                    isSelected
                      ? "border-[#c73659]"
                      : "border-[#bdbdbd]",
                  ].join(" ")}
                >
                  {isSelected ? (
                    <div className="h-3 w-3 rounded-full bg-[#c73659]" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[52px] w-full rounded-[16px] bg-[#eeeeee] text-[17px] font-semibold active:bg-[#e2e2e2]"
        >
          Cancel
        </button>
      </div>
    </ModalOverlay>
  );
}

function DeleteAccountModal({ open, onClose, onConfirm }) {
  const [confirmationText, setConfirmationText] = useState("");

  if (!open) return null;

  const canDelete =
    confirmationText.trim().toUpperCase() === "DELETE";

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="w-full rounded-[26px] bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2
              size={25}
              strokeWidth={2.2}
              className="text-red-600"
            />
          </div>

          <h3 className="text-[23px] font-bold tracking-[-0.5px] text-red-600">
            Delete Account
          </h3>

          <p className="mt-2 text-[15px] leading-6 text-[#686868]">
            This permanently removes your account and associated
            StockPulse data. This action cannot be undone.
          </p>
        </div>

        <label
          htmlFor="delete-confirmation"
          className="mb-2 block text-[14px] font-semibold text-[#555555]"
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
          className="h-[54px] w-full rounded-[15px] border border-[#d4d4d4] bg-white px-4 text-[17px] outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          placeholder="DELETE"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] rounded-[16px] bg-[#eeeeee] text-[17px] font-semibold active:bg-[#e2e2e2]"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canDelete}
            onClick={onConfirm}
            className={[
              "min-h-[52px] rounded-[16px] text-[17px] font-semibold text-white",
              canDelete
                ? "bg-red-600 active:bg-red-700"
                : "cursor-not-allowed bg-red-300",
            ].join(" ")}
          >
            Delete
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:pb-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
