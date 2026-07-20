import React, {
  useEffect,
  useState,
} from "react";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

/*
 * Prevent multiple component mounts or re-renders from
 * exchanging the same one-use OAuth code more than once.
 */
let callbackPromise = null;

function getSafeNextPath(
  searchParams
) {
  const requestedPath =
    searchParams.get("next") ||
    "/";

  /*
   * Only allow internal routes.
   */
  if (
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//")
  ) {
    return "/";
  }

  return requestedPath;
}

function getProviderError(
  searchParams
) {
  return (
    searchParams.get(
      "error_description"
    ) ||
    searchParams.get("error") ||
    ""
  );
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
    getSafeNextPath(
      searchParams
    );

  /*
   * A session may already exist when:
   *
   * 1. The callback page was refreshed.
   * 2. A previous callback render completed the exchange.
   * 3. The auth event finished before this component mounted.
   */
  const {
    data: existingData,
    error: existingError,
  } =
    await supabase.auth.getSession();

  if (existingError) {
    console.warn(
      "Existing session check failed:",
      existingError
    );
  }

  if (
    existingData?.session?.user
  ) {
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
     * A second render may attempt to use a code that
     * the first render has already exchanged. Check
     * for the resulting session before showing an error.
     */
    const {
      data: recoveredData,
    } =
      await supabase.auth.getSession();

    if (
      recoveredData?.session?.user
    ) {
      return nextPath;
    }

    throw error;
  }

  if (!data?.session?.user) {
    throw new Error(
      "Google sign-in completed, but no session was created."
    );
  }

  /*
   * Confirm that the browser persisted the session
   * before loading a protected route.
   */
  const {
    data: verifiedData,
    error: verificationError,
  } =
    await supabase.auth.getSession();

  if (verificationError) {
    throw verificationError;
  }

  if (
    !verifiedData?.session?.user
  ) {
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

  useEffect(() => {
    let active = true;

    /*
     * This updates the message on a slower connection,
     * but deliberately does not redirect back to login.
     */
    const slowTimer =
      window.setTimeout(() => {
        if (active) {
          setMessage(
            "Still completing your sign-in…"
          );
        }
      }, 8000);

    runCallbackOnce()
      .then((nextPath) => {
        if (!active) {
          return;
        }

        window.clearTimeout(
          slowTimer
        );

        setStatus("success");

        setMessage(
          "Signed in successfully."
        );

        /*
         * Do not wait for AuthContext to re-render.
         * A full navigation initializes the application
         * directly from the persisted session.
         */
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
  }, []);

  function returnToLogin() {
    /*
     * Use a full navigation so this module's
     * one-use callback promise is reset.
     */
    window.location.replace(
      "/login"
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {status === "error" ? (
          <>
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
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-900" />

            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              Signing you in
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {message}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
