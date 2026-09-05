import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  persistAppleAuthorizationFromSession,
  supabase,
} from "@/lib/supabase";

let callbackPromise = null;
const AUTH_STEP_TIMEOUT_MS = 20000;

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

function getSafeNextPath() {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedPath = searchParams.get("next") || "/";

  if (
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//") ||
    requestedPath.startsWith("/auth/callback")
  ) {
    return "/";
  }

  return requestedPath;
}

function hasProviderError(searchParams) {
  return Boolean(
    searchParams.get("error_description") ||
      searchParams.get("error") ||
      searchParams.get("error_code"),
  );
}

async function completeOAuthCallback(reportStage) {
  const searchParams = new URLSearchParams(window.location.search);

  if (hasProviderError(searchParams)) {
    throw new Error("provider_error");
  }

  const nextPath = getSafeNextPath();

  reportStage("Checking browser session…");

  const {
    data: existingData,
    error: existingError,
  } = await runWithTimeout(
    supabase.auth.getSession(),
    "session_check_timeout",
  );

  if (existingError) {
    console.warn("Existing OAuth session check failed:", existingError);
  }

  if (existingData?.session?.user) {
    persistAppleAuthorizationFromSession(existingData.session);
    return nextPath;
  }

  const code = searchParams.get("code");

  if (!code) {
    throw new Error("missing_code");
  }

  reportStage("Completing secure sign-in…");

  const { data, error } = await runWithTimeout(
    supabase.auth.exchangeCodeForSession(code),
    "code_exchange_timeout",
  );

  if (error) {
    console.error("OAuth code exchange failed:", error);

    reportStage("Recovering saved session…");

    const { data: recoveredData } = await runWithTimeout(
      supabase.auth.getSession(),
      "session_recovery_timeout",
    );

    if (recoveredData?.session?.user) {
      persistAppleAuthorizationFromSession(recoveredData.session);
      return nextPath;
    }

    throw new Error("code_exchange_failed");
  }

  if (!data?.session?.user) {
    throw new Error("missing_session");
  }

  persistAppleAuthorizationFromSession(data.session);

  reportStage("Saving your login session…");

  const {
    data: verifiedData,
    error: verificationError,
  } = await runWithTimeout(
    supabase.auth.getSession(),
    "session_verification_timeout",
  );

  if (verificationError) {
    console.error("OAuth session verification failed:", verificationError);
    throw new Error("session_verification_failed");
  }

  if (!verifiedData?.session?.user) {
    throw new Error("session_not_saved");
  }

  persistAppleAuthorizationFromSession(verifiedData.session);

  return nextPath;
}

function runCallbackOnce(reportStage) {
  if (!callbackPromise) {
    callbackPromise = completeOAuthCallback(reportStage);
  }

  return callbackPromise;
}

export default function AuthCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Completing your sign-in…");
  const nextPath = useMemo(() => getSafeNextPath(), []);

  useEffect(() => {
    let active = true;

    runCallbackOnce(setMessage)
      .then(() => {
        if (!active) return;
        window.location.replace(nextPath);
      })
      .catch((error) => {
        if (!active) return;

        console.error("OAuth callback failed:", error);

        setStatus("error");
        setMessage(
          "Sign-in could not be completed. Please return to the login page and try again.",
        );
      });

    return () => {
      active = false;
    };
  }, [nextPath]);

  function returnToLogin() {
    window.location.replace("/login");
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            Couldn&apos;t sign you in
          </h1>

          <p role="alert" className="mt-2 text-sm leading-6 text-gray-500">
            {message}
          </p>

          <Button
            type="button"
            className="mt-5 w-full"
            onClick={returnToLogin}
          >
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />

        <h1 className="mt-4 text-lg font-semibold text-gray-900">
          Signing you in
        </h1>

        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
