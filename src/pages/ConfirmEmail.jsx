import React, {
  useEffect,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

function getParameters() {
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
    tokenHash:
      url.searchParams.get(
        "token_hash",
      ) ||
      hashParams.get(
        "token_hash",
      ) ||
      "",

    type:
      url.searchParams.get(
        "type",
      ) ||
      hashParams.get(
        "type",
      ) ||
      "email",

    error:
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
      "",
  };
}

function decodeError(
  rawError,
) {
  if (!rawError) {
    return "";
  }

  try {
    return decodeURIComponent(
      String(rawError).replace(
        /\+/g,
        " ",
      ),
    );
  } catch {
    return String(rawError);
  }
}

export default function ConfirmEmail() {
  const [
    status,
    setStatus,
  ] = useState("checking");

  const [
    message,
    setMessage,
  ] = useState(
    "Confirming your email address…",
  );

  useEffect(() => {
    let active = true;

    async function confirmEmail() {
      try {
        const {
          tokenHash,
          type,
          error:
            urlError,
        } =
          getParameters();

        if (urlError) {
          throw new Error(
            decodeError(
              urlError,
            ),
          );
        }

        if (!tokenHash) {
          /*
           * A user might revisit this page after
           * the session was already established.
           */
          const {
            data,
          } =
            await supabase.auth
              .getSession();

          if (
            data?.session?.user
              ?.email_confirmed_at
          ) {
            if (!active) {
              return;
            }

            setStatus(
              "success",
            );

            setMessage(
              "Your email is already confirmed.",
            );

            return;
          }

          throw new Error(
            "This confirmation link is missing its verification token.",
          );
        }

        const verificationType =
          type === "email"
            ? "email"
            : "email";

        const {
          data,
          error:
            verificationError,
        } =
          await supabase.auth
            .verifyOtp({
              token_hash:
                tokenHash,

              type:
                verificationType,
            });

        if (
          verificationError
        ) {
          throw verificationError;
        }

        if (!data?.user) {
          throw new Error(
            "Your email could not be confirmed.",
          );
        }

        if (!active) {
          return;
        }

        setStatus(
          "success",
        );

        setMessage(
          "Your email has been confirmed successfully.",
        );
      } catch (error) {
        if (!active) {
          return;
        }

        console.error(
          "Email confirmation failed:",
          error,
        );

        const rawMessage =
          error instanceof Error
            ? error.message
            : "";

        const lowerMessage =
          rawMessage.toLowerCase();

        let friendlyMessage =
          rawMessage ||
          "Your email could not be confirmed.";

        if (
          lowerMessage.includes(
            "expired",
          ) ||
          lowerMessage.includes(
            "invalid",
          ) ||
          lowerMessage.includes(
            "token",
          )
        ) {
          friendlyMessage =
            "This confirmation link is invalid, expired, or has already been used.";
        }

        setStatus(
          "error",
        );

        setMessage(
          friendlyMessage,
        );
      }
    }

    confirmEmail();

    return () => {
      active = false;
    };
  }, []);

  const continueToApp =
    async () => {
      const {
        data,
      } =
        await supabase.auth
          .getSession();

      if (
        data?.session?.user
      ) {
        window.location.replace(
          "/",
        );

        return;
      }

      window.location.replace(
        "/login",
      );
    };

  if (
    status === "error"
  ) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            Couldn&apos;t confirm email
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {message}
          </p>

          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() =>
              window.location.replace(
                "/login",
              )
            }
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {status ===
        "success" ? (
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
        ) : (
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-gray-900" />
        )}

        <h1 className="mt-4 text-lg font-semibold text-gray-900">
          {status ===
          "success"
            ? "Email confirmed"
            : "Confirming email"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          {message}
        </p>

        {status ===
        "success" ? (
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={
              continueToApp
            }
          >
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
