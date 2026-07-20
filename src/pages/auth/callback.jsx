import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

function getSafeNextPath() {
  const searchParams =
    new URLSearchParams(
      window.location.search
    );

  const requestedPath =
    searchParams.get("next") ||
    "/";

  if (
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//") ||
    requestedPath.startsWith(
      "/auth/callback"
    )
  ) {
    return "/";
  }

  return requestedPath;
}

function getProviderError() {
  const searchParams =
    new URLSearchParams(
      window.location.search
    );

  const rawError =
    searchParams.get(
      "error_description"
    ) ||
    searchParams.get(
      "error"
    ) ||
    searchParams.get(
      "error_code"
    ) ||
    "";

  if (!rawError) {
    return "";
  }

  try {
    return decodeURIComponent(
      rawError.replace(
        /\+/g,
        " "
      )
    );
  } catch {
    return rawError;
  }
}

export default function AuthCallback() {
  const {
    isAuthenticated,
    isLoadingAuth,
    authError,
  } = useAuth();

  const [showFailure, setShowFailure] =
    useState(false);

  const nextPath = useMemo(
    () => getSafeNextPath(),
    []
  );

  const providerError = useMemo(
    () => getProviderError(),
    []
  );

  useEffect(() => {
    if (providerError) {
      setShowFailure(true);
      return undefined;
    }

    if (isAuthenticated) {
      /*
       * Replace removes the one-use OAuth callback URL
       * from browser history and starts the app using
       * the newly persisted session.
       */
      window.location.replace(
        nextPath
      );

      return undefined;
    }

    if (isLoadingAuth) {
      return undefined;
    }

    /*
     * Give a SIGNED_IN notification a brief chance to
     * follow INITIAL_SESSION on a slow mobile browser.
     */
    const failureTimer =
      window.setTimeout(() => {
        setShowFailure(true);
      }, 1500);

    return () => {
      window.clearTimeout(
        failureTimer
      );
    };
  }, [
    providerError,
    isAuthenticated,
    isLoadingAuth,
    nextPath,
  ]);

  function returnToLogin() {
    window.location.replace(
      "/login"
    );
  }

  const errorMessage =
    providerError ||
    authError?.message ||
    "Google sign-in did not create a session. Please start a new login attempt.";

  if (
    showFailure &&
    !isAuthenticated
  ) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            Couldn&apos;t sign you in
          </h1>

          <p className="mt-2 break-words text-sm leading-6 text-gray-500">
            {errorMessage}
          </p>

          <Button
            type="button"
            className="mt-5 w-full"
            onClick={
              returnToLogin
            }
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
        {isAuthenticated ? (
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        ) : (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />
        )}

        <h1 className="mt-4 text-lg font-semibold text-gray-900">
          {isAuthenticated
            ? "Signed in"
            : "Signing you in"}
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          {isAuthenticated
            ? "Opening your watchlist…"
            : "Completing your Google sign-in…"}
        </p>
      </div>
    </div>
  );
}
