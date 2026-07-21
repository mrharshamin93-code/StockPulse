import React, {
  useEffect,
  useState,
} from "react";
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
const RECOVERY_MARKER_KEY =
  "stockpulse:password-recovery";
const RECOVERY_MARKER_MAX_AGE_MS =
  60 * 60 * 1000;

let activeRecoveryAttempt = {
  key: "",
  promise: null,
};

function runWithTimeout(
  operation,
  timeoutMessage,
) {
  let timeoutId;

  const timeoutPromise =
    new Promise(
      (_, reject) => {
        timeoutId =
          window.setTimeout(
            () => {
              reject(
                new Error(
                  timeoutMessage,
                ),
              );
            },
            AUTH_STEP_TIMEOUT_MS,
          );
      },
    );

  return Promise.race([
    operation,
    timeoutPromise,
  ]).finally(() => {
    window.clearTimeout(
      timeoutId,
    );
  });
}

function getUrlError() {
  const url =
    new URL(
      window.location.href,
    );

  const hashParams =
    new URLSearchParams(
      url.hash.replace(
        /^#/,
        "",
      ),
    );

  const rawError =
    url.searchParams.get(
      "error_description",
    ) ||
    url.searchParams.get(
      "error",
    ) ||
    hashParams.get(
      "error_description",
    ) ||
    hashParams.get(
      "error",
    ) ||
    "";

  if (!rawError) {
    return "";
  }

  try {
    return decodeURIComponent(
      rawError.replace(
        /\+/g,
        " ",
      ),
    );
  } catch {
    return rawError;
  }
}

function getRecoveryInputs() {
  const url =
    new URL(
      window.location.href,
    );

  const hashParams =
    new URLSearchParams(
      url.hash.replace(
        /^#/,
        "",
      ),
    );

  return {
    code:
      url.searchParams.get(
        "code",
      ) || "",

    accessToken:
      hashParams.get(
        "access_token",
      ) || "",

    refreshToken:
      hashParams.get(
        "refresh_token",
      ) || "",
  };
}

function getRecoveryAttemptKey() {
  const {
    code,
    accessToken,
  } =
    getRecoveryInputs();

  if (code) {
    return `code:${code}`;
  }

  if (accessToken) {
    return `token:${accessToken}`;
  }

  return "saved-session";
}

function cleanRecoveryUrl() {
  const url =
    new URL(
      window.location.href,
    );

  [
    "code",
    "type",
    "error",
    "error_code",
    "error_description",
  ].forEach((key) => {
    url.searchParams.delete(
      key,
    );
  });

  url.hash = "";

  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}`,
  );
}

function saveRecoveryMarker(
  session,
) {
  try {
    window.sessionStorage.setItem(
      RECOVERY_MARKER_KEY,
      JSON.stringify({
        userId:
          session.user.id,
        createdAt:
          Date.now(),
      }),
    );
  } catch {
    /*
     * Session storage is only an additional guard.
     * Supabase's authenticated recovery session remains
     * the actual authorization mechanism.
     */
  }
}

function clearRecoveryMarker() {
  try {
    window.sessionStorage.removeItem(
      RECOVERY_MARKER_KEY,
    );
  } catch {
    // Nothing else is required.
  }
}

function readRecoveryMarker() {
  try {
    const rawValue =
      window.sessionStorage.getItem(
        RECOVERY_MARKER_KEY,
      );

    if (!rawValue) {
      return null;
    }

    const marker =
      JSON.parse(
        rawValue,
      );

    if (
      !marker?.userId ||
      !Number.isFinite(
        marker?.createdAt,
      ) ||
      Date.now() -
        marker.createdAt >
        RECOVERY_MARKER_MAX_AGE_MS
    ) {
      clearRecoveryMarker();
      return null;
    }

    return marker;
  } catch {
    clearRecoveryMarker();
    return null;
  }
}

async function establishRecoverySession() {
  const providerError =
    getUrlError();

  if (providerError) {
    throw new Error(
      providerError,
    );
  }

  const {
    code,
    accessToken,
    refreshToken,
  } =
    getRecoveryInputs();

  let session = null;

  if (code) {
    const {
      data,
      error,
    } =
      await runWithTimeout(
        supabase.auth.exchangeCodeForSession(
          code,
        ),
        "The password reset link took too long to verify. Please request a new link.",
      );

    if (error) {
      throw error;
    }

    session =
      data?.session ||
      null;
  } else if (
    accessToken &&
    refreshToken
  ) {
    /*
     * This supports older implicit-flow recovery links.
     * The app's current Supabase client uses PKCE, where
     * the recovery URL normally contains a `code`.
     */
    const {
      data,
      error,
    } =
      await runWithTimeout(
        supabase.auth.setSession({
          access_token:
            accessToken,
          refresh_token:
            refreshToken,
        }),
        "The password reset session took too long to verify. Please request a new link.",
      );

    if (error) {
      throw error;
    }

    session =
      data?.session ||
      null;
  } else {
    const marker =
      readRecoveryMarker();

    if (!marker) {
      throw new Error(
        "This password reset link is invalid or has expired. Please request a new one.",
      );
    }

    const {
      data,
      error,
    } =
      await runWithTimeout(
        supabase.auth.getSession(),
        "Checking the password reset session took too long. Please request a new link.",
      );

    if (error) {
      throw error;
    }

    session =
      data?.session ||
      null;

    if (
      !session?.user ||
      session.user.id !==
        marker.userId
    ) {
      clearRecoveryMarker();

      throw new Error(
        "This password reset session is no longer valid. Please request a new link.",
      );
    }
  }

  if (!session?.user) {
    throw new Error(
      "The password reset session could not be created. Please request a new link.",
    );
  }

  saveRecoveryMarker(
    session,
  );

  cleanRecoveryUrl();

  return session;
}

function initializeRecoveryOnce() {
  const attemptKey =
    getRecoveryAttemptKey();

  if (
    activeRecoveryAttempt.key !==
      attemptKey ||
    !activeRecoveryAttempt.promise
  ) {
    activeRecoveryAttempt = {
      key:
        attemptKey,
      promise:
        establishRecoverySession(),
    };
  }

  return activeRecoveryAttempt.promise;
}

function getUpdateErrorMessage(
  error,
) {
  const message =
    String(
      error?.message || "",
    );

  const lowerMessage =
    message.toLowerCase();

  if (
    lowerMessage.includes(
      "same password",
    )
  ) {
    return "Choose a password you have not used before.";
  }

  if (
    lowerMessage.includes(
      "password",
    ) &&
    (
      lowerMessage.includes(
        "short",
      ) ||
      lowerMessage.includes(
        "weak",
      ) ||
      lowerMessage.includes(
        "characters",
      )
    )
  ) {
    return message;
  }

  if (
    lowerMessage.includes(
      "expired",
    ) ||
    lowerMessage.includes(
      "session",
    )
  ) {
    return "Your password reset session expired. Please request a new link.";
  }

  return "We could not update your password. Please try again.";
}

export default function ResetPassword() {
  const [
    status,
    setStatus,
  ] = useState(
    "checking",
  );

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    initializeRecoveryOnce()
      .then(() => {
        if (!active) {
          return;
        }

        setStatus(
          "ready",
        );
      })
      .catch(
        (
          recoveryError,
        ) => {
          if (!active) {
            return;
          }

          console.error(
            "Password recovery initialization failed:",
            recoveryError,
          );

          clearRecoveryMarker();

          setError(
            recoveryError
              ?.message ||
              "This password reset link is invalid or has expired.",
          );

          setStatus(
            "error",
          );
        },
      );

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");

    if (
      password.length <
      MIN_PASSWORD_LENGTH
    ) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const {
        error: updateError,
      } =
        await runWithTimeout(
          supabase.auth.updateUser({
            password,
          }),
          "Updating the password took too long. Please try again.",
        );

      if (updateError) {
        throw updateError;
      }

      clearRecoveryMarker();

      /*
       * End the temporary recovery session so the user
       * signs in normally with the new password.
       */
      const {
        error: signOutError,
      } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (signOutError) {
        console.warn(
          "Password changed, but the temporary local recovery session could not be cleared normally:",
          signOutError,
        );
      }

      setPassword("");
      setConfirmPassword("");
      setStatus(
        "success",
      );
    } catch (updateError) {
      console.error(
        "Password update failed:",
        updateError,
      );

      setError(
        getUpdateErrorMessage(
          updateError,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (
    status ===
    "checking"
  ) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />

          <h1 className="mt-4 font-heading text-lg font-semibold text-gray-900">
            Verifying reset link
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Please wait a moment…
          </p>
        </div>
      </div>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>

          <h1 className="mt-4 font-heading text-lg font-semibold text-gray-900">
            Reset link unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {error}
          </p>

          <Link to="/forgot-password">
            <Button className="mt-5 h-11 w-full bg-gray-900 text-white hover:bg-gray-800">
              Request a New Link
            </Button>
          </Link>

          <Link
            to="/login"
            className="mt-4 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (
    status ===
    "success"
  ) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>

          <h1 className="mt-4 font-heading text-xl font-bold text-gray-900">
            Password updated
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your password was changed successfully. Sign in using your new password.
          </p>

          <Link to="/login">
            <Button className="mt-5 h-11 w-full bg-gray-900 text-white hover:bg-gray-800">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-gray-100 px-4"
      style={{
        paddingTop:
          "env(safe-area-inset-top)",
        paddingBottom:
          "env(safe-area-inset-bottom)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-sm">
            <LockKeyhole className="h-6 w-6 text-white" />
          </div>

          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Create a new password
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Enter and confirm your new password
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-4"
          >
            {error ? (
              <div
                role="alert"
                className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {error}
                </span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="new-password">
                New Password
              </Label>

              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={
                  MIN_PASSWORD_LENGTH
                }
                value={
                  password
                }
                onChange={(event) => {
                  setPassword(
                    event.target.value,
                  );

                  if (error) {
                    setError("");
                  }
                }}
                required
                autoFocus
              />

              <p className="text-xs text-gray-400">
                At least{" "}
                {MIN_PASSWORD_LENGTH}{" "}
                characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">
                Confirm New Password
              </Label>

              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={
                  MIN_PASSWORD_LENGTH
                }
                value={
                  confirmPassword
                }
                onChange={(event) => {
                  setConfirmPassword(
                    event.target.value,
                  );

                  if (error) {
                    setError("");
                  }
                }}
                required
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
              disabled={
                submitting ||
                !password ||
                !confirmPassword
              }
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              {submitting
                ? "Updating…"
                : "Update Password"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link
              to="/login"
              className="text-gray-500 transition-colors hover:text-gray-900"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
