import React, {
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  BarChart2,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

import {
  getEmailConfirmationUrl,
  isNativeApp,
  signInWithGoogle,
} from "@/lib/mobileAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEATURES = [
  {
    icon: BarChart2,
    label:
      "Track your portfolio",
    desc:
      "Monitor all your holdings in one place",
  },
  {
    icon: TrendingUp,
    label:
      "Market insights",
    desc:
      "AI-powered stock analysis and news",
  },
  {
    icon: Zap,
    label:
      "Stock screener",
    desc:
      "Filter stocks by fundamentals and metrics",
  },
  {
    icon: ShieldCheck,
    label:
      "Secure & private",
    desc:
      "Your account and portfolio data are protected",
  },
];

export default function Register() {
  const navigate =
    useNavigate();

  const nativeApp =
    isNativeApp();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    oauthLoading,
    setOauthLoading,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const handleRegister =
    async (event) => {
      event.preventDefault();

      if (
        password !==
        confirmPassword
      ) {
        setError(
          "Passwords do not match",
        );

        return;
      }

      if (
        password.length < 6
      ) {
        setError(
          "Password must be at least 6 characters",
        );

        return;
      }

      setLoading(true);
      setError("");

      try {
        const normalizedEmail =
          email
            .trim()
            .toLowerCase();

        const {
          error:
            signUpError,
        } =
          await supabase.auth
            .signUp({
              email:
                normalizedEmail,

              password,

              options: {
                emailRedirectTo:
                  getEmailConfirmationUrl(),
              },
            });

        if (signUpError) {
          throw signUpError;
        }

        window.alert(
          "Account created! Please check your email to confirm your account.",
        );

        navigate(
          "/login",
          {
            replace: true,
          },
        );
      } catch (
        registerError
      ) {
        console.error(
          "Registration failed:",
          registerError,
        );

        setError(
          registerError instanceof Error
            ? registerError.message
            : "Registration failed. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

  const handleGoogleLogin =
    async () => {
      if (oauthLoading) {
        return;
      }

      setError("");

      setOauthLoading(
        "google",
      );

      try {
        await signInWithGoogle();

        if (nativeApp) {
          setOauthLoading("");
        }
      } catch (
        oauthError
      ) {
        console.error(
          "Google registration failed:",
          oauthError,
        );

        setError(
          oauthError instanceof Error
            ? oauthError.message
            : "Google sign-in failed.",
        );

        setOauthLoading("");
      }
    };

  const handleAppleLogin =
    async () => {
      if (
        nativeApp ||
        oauthLoading
      ) {
        return;
      }

      setError("");

      setOauthLoading(
        "apple",
      );

      try {
        const {
          error:
            oauthError,
        } =
          await supabase.auth
            .signInWithOAuth({
              provider:
                "apple",

              options: {
                redirectTo:
                  `${window.location.origin}/auth/callback`,
              },
            });

        if (oauthError) {
          throw oauthError;
        }
      } catch (
        oauthError
      ) {
        setError(
          oauthError instanceof Error
            ? oauthError.message
            : "Apple sign-in failed.",
        );

        setOauthLoading("");
      }
    };

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50 lg:flex-row"
      style={{
        paddingTop:
          "env(safe-area-inset-top)",

        paddingBottom:
          "env(safe-area-inset-bottom)",
      }}
    >
      <div className="hidden bg-foreground p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>

          <span className="font-heading text-xl font-bold text-white">
            StockPulse
          </span>
        </div>

        <div>
          <h2 className="mb-4 font-heading text-4xl font-bold leading-tight text-white">
            Your portfolio,
            <br />
            intelligently tracked.
          </h2>

          <p className="mb-10 text-base text-white/60">
            Track your portfolio,
            follow market activity,
            and access intelligent
            investing tools in one
            place.
          </p>

          <div className="space-y-5">
            {FEATURES.map(
              ({
                icon: Icon,
                label,
                desc,
              }) => (
                <div
                  key={label}
                  className="flex items-start gap-4"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {label}
                    </p>

                    <p className="mt-0.5 text-xs text-white/50">
                      {desc}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <p className="text-xs text-white/30">
          © 2026 StockPulse. All
          rights reserved.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-gray-900">
              Create Your Account
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Start tracking your
              portfolio in minutes
            </p>
          </div>

          <div className="space-y-5">
            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </p>
            ) : null}

            <div
              className={
                nativeApp
                  ? "grid grid-cols-1 gap-3"
                  : "grid grid-cols-2 gap-3"
              }
            >
              {!nativeApp ? (
                <Button
                  variant="outline"
                  className="h-11 w-full gap-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                  onClick={
                    handleAppleLogin
                  }
                  type="button"
                  disabled={
                    loading ||
                    oauthLoading !==
                      ""
                  }
                >
                  {oauthLoading ===
                  "apple" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.3.07 2.2.73 2.98.75.82-.17 1.61-.87 2.99-.79 1.67.1 2.93.8 3.72 2.02-3.33 2.02-2.8 6.47.62 7.77-.62 1.52-1.44 3.04-2.31 3.13zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                  )}

                  Apple
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="h-11 w-full gap-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                onClick={
                  handleGoogleLogin
                }
                type="button"
                disabled={
                  loading ||
                  oauthLoading !==
                    ""
                }
              >
                {oauthLoading ===
                "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />

                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />

                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />

                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}

                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>

              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-50 px-2 text-gray-400">
                  or
                </span>
              </div>
            </div>

            <form
              onSubmit={
                handleRegister
              }
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="register-email">
                  Email
                </Label>

                <Input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(
                    event,
                  ) =>
                    setEmail(
                      event.target
                        .value,
                    )
                  }
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-password">
                  Password
                </Label>

                <Input
                  id="register-password"
                  type="password"
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target
                        .value,
                    )
                  }
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-confirm-password">
                  Confirm Password
                </Label>

                <Input
                  id="register-confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event,
                  ) =>
                    setConfirmPassword(
                      event.target
                        .value,
                    )
                  }
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
                disabled={
                  loading ||
                  oauthLoading !==
                    ""
                }
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}

                Create Account
              </Button>
            </form>

            <p className="text-center text-xs leading-relaxed text-gray-400">
              By creating an account,
              you agree to the{" "}
              <Link
                to="/terms"
                className="underline hover:text-gray-600"
              >
                Terms
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                to="/privacy"
                className="underline hover:text-gray-600"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <p className="text-center text-sm text-gray-500">
              Already have an
              account?{" "}
              <Link
                to="/login"
                className="font-semibold text-gray-900 hover:underline"
              >
                Sign in
              </Link>
            </p>

            <nav
              aria-label="Legal and support"
              className="flex items-center justify-center gap-3 text-[11px] text-gray-500"
            >
              <Link
                to="/privacy"
                className="hover:underline"
              >
                Privacy
              </Link>

              <span>•</span>

              <Link
                to="/terms"
                className="hover:underline"
              >
                Terms
              </Link>

              <span>•</span>

              <Link
                to="/contact-us"
                className="hover:underline"
              >
                Contact Us
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
