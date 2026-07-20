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
import { supabase } from "@/lib/supabase";

/*
 * OAuth authorization codes can only be exchanged once.
 * Keep one promise across component re-renders so a slow
 * mobile browser cannot start a duplicate exchange.
 */
let callbackPromise = null;

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

function getProviderError(
  searchParams
) {
  const rawError =
    searchParams.get(
      "error_description"
    ) ||
    searchParams.get("error") ||
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

async function completeOAuthCallback() {
  const searchParams =
    new URLSearchParams(
      window.location.search
    );

  const providerError =
    getProviderError(
      searchParams
    );

  if (providerError) {
    throw new Error(
      providerError
    );
  }

  const nextPath =
    getSafeNextPath();

  /*
   * A refreshed callback may already have a persisted
   * session even though its one-use code is still visible.
   */
  const {
    data: existingData,
    error: existingError,
  } = await supabase.auth.getSession();

  if (existingError) {
    console.warn(
      "Existing session check failed:",
      existingError
    );
  }

  if (existingData?.session?.user) {
    return nextPath;
  }

  const code =
    searchParams.get("code");

  if (!code) {
    throw new Error(
      "Google did not return an authorization code. " +
        "Please begin the sign-in process again."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.auth.exchangeCodeForSession(
      code
    );

  if (error) {
    /*
     * If another render completed first, recover its
     * persisted session before displaying an error.
     */
    const {
      data: recoveredData,
    } =
      await supabase.auth.getSession();

    if (recoveredData?.session?.user) {
      return nextPath;
    }

    throw error;
  }

  if (!data?.session?.user) {
    throw new Error(
      "Google sign-in completed, but no session was created."
    );
  }

  const {
    data: verifiedData,
    error: verificationError,
  } = await supabase.auth.getSession();

  if (verificationError) {
    throw verificationError;
  }

  if (!verifiedData?.session?.user) {
    throw new Error(
      "The login session could not be saved in this browser."
    );
  }

  return nextPath;
}

function runCallbackOnce() {
  if (!callbackPromise) {
    callbackPromise =
      completeOAuthCallback();
  }

  return callbackPromise;
}

export default function AuthCallback() {
  const [status, setStatus] =
    useState("processing");

  const [message, setMessage] =
    useState(
      "Completing your Google sign-in…"
    );

  const nextPath = useMemo(
    () => getSafeNextPath(),
    []
  );

  useEffect(() => {
    let active = true;

    const slowTimer =
      window.setTimeout(() => {
        if (active) {
          setMessage(
            "Still completing your sign-in…"
          );
        }
      }, 8000);

    runCallbackOnce()
      .then(() => {
        if (!active) {
          return;
        }

        window.clearTimeout(
          slowTimer
        );

        setStatus("success");
        setMessage(
          "Opening your watchlist…"
        );

        window.location.replace(
          nextPath
        );
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        window.clearTimeout(
          slowTimer
        );

        console.error(
          "OAuth callback failed:",
          error
        );

        setStatus("error");
        setMessage(
          error?.message ||
            "Google sign-in failed."
        );
      });

    return () => {
      active = false;

      window.clearTimeout(
        slowTimer
      );
    };
  }, [nextPath]);

  function returnToLogin() {
    window.location.replace(
      "/login"
    );
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

          <p className="mt-2 break-words text-sm leading-6 text-gray-500">
            {message}
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
        {status === "success" ? (
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        ) : (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />
        )}

        <h1 className="mt-4 text-lg font-semibold text-gray-900">
          {status === "success"
            ? "Signed in"
            : "Signing you in"}
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          {message}
        </p>
      </div>
    </div>
  );
}
exchangeCodeForSession
