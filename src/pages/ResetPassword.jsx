import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 6;
const AUTH_STEP_TIMEOUT_MS = 20000;
const RECOVERY_MARKER_KEY = "stockpulse:password-recovery";
const RECOVERY_MARKER_MAX_AGE_MS = 60 * 60 * 1000;

let recoveryInitializationPromise = null;

function runWithTimeout(operation, timeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, AUTH_STEP_TIMEOUT_MS);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function getUrlParameters() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  return {
    tokenHash:
      url.searchParams.get("token_hash") ||
      hashParams.get("token_hash") ||
      "",
    type:
      url.searchParams.get("type") ||
      hashParams.get("type") ||
      "",
    code: url.searchParams.get("code") || "",
    accessToken: hashParams.get("access_token") || "",
    refreshToken: hashParams.get("refresh_token") || "",
    error:
      url.searchParams.get("error_description") ||
      url.searchParams.get("error") ||
      hashParams.get("error_description") ||
      hashParams.get("error") ||
      "",
  };
}

function cleanRecoveryUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  window.history.replaceState({}, document.title, url.pathname);
}

function saveRecoveryMarker(session) {
  try {
    window.sessionStorage.setItem(
      RECOVERY_MARKER_KEY,
      JSON.stringify({
        userId: session.user.id,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // The Supabase recovery session remains authoritative.
  }
}

function clearRecoveryMarker() {
  try {
    window.sessionStorage.removeItem(RECOVERY_MARKER_KEY);
  } catch {
    // Nothing else to clear.
  }
}

function readRecoveryMarker() {
  try {
    const rawValue = window.sessionStorage.getItem(RECOVERY_MARKER_KEY);

    if (!rawValue) return null;

    const marker = JSON.parse(rawValue);
    const valid =
      marker?.userId &&
      Number.isFinite(marker?.createdAt) &&
      Date.now() - marker.createdAt <= RECOVERY_MARKER_MAX_AGE_MS;

    if (!valid) {
      clearRecoveryMarker();
      return null;
    }

    return marker;
  } catch {
    clearRecoveryMarker();
    return null;
  }
}

function friendlyRecoveryError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (
    message.includes("expired") ||
    message.includes("invalid") ||
    message.includes("otp_expired") ||
    message.includes("token") ||
    message.includes("code verifier") ||
    message.includes("code challenge") ||
    message.includes("bad_code_verifier")
  ) {
    return "This password-reset link is invalid, expired, or has already been used. Please request a new link.";
  }

  if (message.includes("timed out")) {
    return "The password-reset link could not be verified in time. Please request a new link.";
  }

  return "The password-reset link could not be verified. Please request a new link.";
}

function friendlyUpdateError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("same password")) {
    return "Choose a password you have not used before.";
  }

  if (
    message.includes("expired") ||
    message.includes("session") ||
    message.includes("jwt")
  ) {
    return "Your password-reset session expired. Please request a new link.";
  }

  if (message.includes("password") && (message.includes("weak") || message.includes("short"))) {
    return "Please choose a stronger password that meets the password requirements.";
  }

  return "We could not update your password. Please try again.";
}

async function establishRecoverySession() {
  const {
    tokenHash,
    code,
    accessToken,
    refreshToken,
    error: urlError,
  } = getUrlParameters();

  if (urlError) {
    throw new Error("Password recovery provider error");
  }

  let session = null;

  if (tokenHash) {
    const { data, error } = await runWithTimeout(
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      }),
      "Password recovery verification timed out.",
    );

    if (error) throw error;
    session = data?.session || null;
  } else if (accessToken && refreshToken) {
    const { data, error } = await runWithTimeout(
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      "Password recovery session creation timed out.",
    );

    if (error) throw error;
    session = data?.session || null;
  } else if (code) {
    const { data, error } = await runWithTimeout(
      supabase.auth.exchangeCodeForSession(code),
      "Password recovery verification timed out.",
    );

    if (error) throw error;
    session = data?.session || null;
  } else {
    const marker = readRecoveryMarker();

    if (!marker) {
      throw new Error("Missing password recovery token");
    }

    const { data, error } = await runWithTimeout(
      supabase.auth.getSession(),
      "Password recovery session check timed out.",
    );

    if (error) throw error;

    session = data?.session || null;

    if (!session?.user || session.user.id !== marker.userId) {
      clearRecoveryMarker();
      throw new Error("Invalid password recovery session");
    }
  }

  if (!session?.user) {
    throw new Error("Password recovery session was not created");
  }

  saveRecoveryMarker(session);
  cleanRecoveryUrl();

  return session;
}

function initializeRecoveryOnce() {
  if (!recoveryInitializationPromise) {
    recoveryInitializationPromise = establishRecoverySession();
  }

  return recoveryInitializationPromise;
}

export default function ResetPassword() {
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    initializeRecoveryOnce()
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch((recoveryError) => {
        if (!active) return;

        console.error("Password recovery initialization failed:", recoveryError);
        clearRecoveryMarker();
        setError(friendlyRecoveryError(recoveryError));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await runWithTimeout(
        supabase.auth.updateUser({ password }),
        "Password update timed out.",
      );

      if (updateError) throw updateError;

      clearRecoveryMarker();

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        console.warn(
          "Password changed, but the temporary recovery session could not be cleared normally:",
          signOutError,
        );
      }

      setPassword("");
      setConfirmPassword("");
      setStatus("success");
    } catch (updateError) {
      console.error("Password update failed:", updateError);
      setError(friendlyUpdateError(updateError));
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <PageShell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />
        <h1 className="mt-4 font-heading text-lg font-semibold text-gray-900">
          Verifying reset link
        </h1>
        <p className="mt-2 text-sm text-gray-500">Please wait a moment…</p>
      </PageShell>
    );
  }

  if (status === "error") {
    return (
      <PageShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>

        <h1 className="mt-4 font-heading text-lg font-semibold text-gray-900">
          Reset link unavailable
        </h1>

        <p role="alert" className="mt-2 text-sm leading-6 text-gray-500">
          {error}
        </p>

        <Button asChild className="mt-5 w-full bg-gray-900 text-white hover:bg-gray-800">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>

        <Link
          to="/login"
          className="mt-4 block text-sm text-gray-500 hover:text-gray-900"
        >
          Back to Sign In
        </Link>
      </PageShell>
    );
  }

  if (status === "success") {
    return (
      <PageShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>

        <h1 className="mt-4 font-heading text-lg font-semibold text-gray-900">
          Password updated
        </h1>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Your password has been changed successfully. Sign in with your new password.
        </p>

        <Button asChild className="mt-5 w-full bg-gray-900 text-white hover:bg-gray-800">
          <Link to="/login">Sign In</Link>
        </Button>
      </PageShell>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <LockKeyhole className="h-6 w-6 text-gray-900" />
          </div>

          <h1 className="mt-4 font-heading text-xl font-semibold text-gray-900">
            Create a new password
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Enter a new password for your StockPulse account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error ? (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm Password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
