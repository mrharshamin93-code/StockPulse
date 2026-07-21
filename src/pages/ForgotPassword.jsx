import React, {
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  MailCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getResetRedirectUrl() {
  return new URL(
    "/reset-password",
    window.location.origin,
  ).toString();
}

function getFriendlyErrorMessage(error) {
  const message = String(
    error?.message || "",
  ).toLowerCase();

  if (
    message.includes("rate limit") ||
    message.includes("too many")
  ) {
    return "Too many reset requests were made. Please wait a few minutes and try again.";
  }

  if (
    message.includes("email") &&
    message.includes("invalid")
  ) {
    return "Enter a valid email address.";
  }

  return "We could not send the reset email. Please try again.";
}

export default function ForgotPassword() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    sent,
    setSent,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    const normalizedEmail =
      email.trim().toLowerCase();

    if (
      !normalizedEmail ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo:
              getResetRedirectUrl(),
          },
        );

      if (resetError) {
        throw resetError;
      }

      /*
       * Keep this message generic so the page does not
       * reveal whether an email address is registered.
       */
      setSent(true);
    } catch (resetError) {
      console.error(
        "Password reset email failed:",
        resetError,
      );

      setError(
        getFriendlyErrorMessage(
          resetError,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSent(false);
    setError("");
  };

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
            <BarChart3 className="h-6 w-6 text-white" />
          </div>

          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Reset password
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            We&apos;ll email you a secure reset link
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {sent ? (
            <div className="py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <MailCheck className="h-6 w-6 text-emerald-600" />
              </div>

              <h2 className="mt-4 font-heading text-lg font-semibold text-gray-900">
                Check your email
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                If an account exists for{" "}
                <span className="font-medium text-gray-900">
                  {email.trim()}
                </span>
                , you&apos;ll receive a password reset link shortly.
              </p>

              <p className="mt-2 text-xs leading-5 text-gray-400">
                Check your spam folder if the email does not appear.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={resetForm}
              >
                Send another link
              </Button>
            </div>
          ) : (
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
                <Label htmlFor="reset-email">
                  Email
                </Label>

                <Input
                  id="reset-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(
                      event.target.value,
                    );

                    if (error) {
                      setError("");
                    }
                  }}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
                disabled={
                  loading ||
                  !email.trim()
                }
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}

                {loading
                  ? "Sending…"
                  : "Send Reset Link"}
              </Button>
            </form>
          )}

          <div className="text-center text-sm">
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
