import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

function getSafeNextPath(searchParams) {
  const next =
    searchParams.get("next") || "/";

  /*
   * Only allow internal application paths.
   */
  if (
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return "/";
  }

  return next;
}

function getProviderError(searchParams) {
  const description =
    searchParams.get(
      "error_description"
    );

  const error =
    searchParams.get("error");

  if (description) {
    try {
      return decodeURIComponent(
        description.replace(/\+/g, " ")
      );
    } catch {
      return description;
    }
  }

  return error || "";
}

export default function AuthCallback() {
  const callbackStartedRef =
    useRef(false);

  const [status, setStatus] =
    useState("processing");

  const [message, setMessage] =
    useState(
      "Completing your Google sign-in…"
    );

  useEffect(() => {
    /*
     * Prevent the one-time OAuth code from
     * being exchanged more than once.
     */
    if (callbackStartedRef.current) {
      return undefined;
    }

    callbackStartedRef.current = true;

    let cancelled = false;
    let timeoutId;

    async function completeSignIn() {
      try {
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
         * Handle a refreshed callback page after
         * the session was already saved.
         */
        const {
          data: existingSessionData,
          error: existingSessionError,
        } =
          await supabase.auth.getSession();

        if (existingSessionError) {
          console.warn(
            "Existing session check failed:",
            existingSessionError
          );
        }

        if (
          existingSessionData?.session?.user
        ) {
          window.clearTimeout(
            timeoutId
          );

          window.location.replace(
            nextPath
          );

          return;
        }

        const code =
          searchParams.get("code");

        if (!code) {
          throw new Error(
            "Google did not return an authorization code. " +
              "Please start the sign-in process again."
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
          throw error;
        }

        if (!data?.session?.user) {
          throw new Error(
            "Google sign-in completed, but no session was created."
          );
        }

        /*
         * Confirm that Supabase persisted the session
         * before entering protected routes.
         */
        const {
          data: verifiedSessionData,
          error: verificationError,
        } =
          await supabase.auth.getSession();

        if (verificationError) {
          throw verificationError;
        }

        if (
          !verifiedSessionData?.session?.user
        ) {
          throw new Error(
            "The session could not be saved in this browser."
          );
        }

        if (cancelled) {
          return;
        }

        window.clearTimeout(
          timeoutId
        );

        setStatus("success");
        setMessage(
          "Signed in successfully."
        );

        /*
         * Perform a full reload after the session is
         * stored. This avoids a race between AuthContext,
         * React Router, and ProtectedRoute on slower
         * mobile devices.
         */
        window.location.replace(
          nextPath
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        window.clearTimeout(
          timeoutId
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
      }
    }

    timeoutId =
      window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        setStatus("error");

        setMessage(
          "The sign-in request took too long. " +
            "Please try again in Safari or Chrome."
        );
      }, 30000);

    completeSignIn();

    return () => {
      cancelled = true;

      window.clearTimeout(
        timeoutId
      );
    };
  }, []);

  function returnToLogin() {
    window.location.replace(
      "/login"
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
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
              onClick={
                returnToLogin
              }
              className="mt-5 w-full"
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
