import React, { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { isNativeApp, signInWithGoogle } from "@/lib/mobileAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function friendlyLoginError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }

  return "Unable to sign in right now. Please try again.";
}

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const nativeApp = isNativeApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("error")) {
      setError("Google sign-in could not be completed. Please try again.");
    }
  }, [searchParams]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading || oauthLoading) return;

    setLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      /*
       * Do not navigate here.
       * Supabase emits SIGNED_IN, AuthContext commits the session,
       * and this component redirects only after that state is stable.
       */
    } catch (submitError) {
      console.error("Email sign-in failed:", submitError);
      setError(friendlyLoginError(submitError));
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading || oauthLoading) return;

    setError("");
    setOauthLoading("google");

    try {
      await signInWithGoogle();

      if (nativeApp) {
        setOauthLoading("");
      }
    } catch (oauthError) {
      console.error("Google sign-in failed:", oauthError);
      setError("Google sign-in could not be completed. Please try again.");
      setOauthLoading("");
    }
  }

  async function handleAppleLogin() {
    if (nativeApp || loading || oauthLoading) return;

    setError("");
    setOauthLoading("apple");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error("Apple sign-in failed:", oauthError);
      setError("Apple sign-in could not be completed. Please try again.");
      setOauthLoading("");
    }
  }

  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/watchlist" replace />;
  }

  const busy = loading || oauthLoading !== "";

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 shadow-sm">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>

          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Welcome back
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Sign in to your portfolio
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </p>
          ) : null}

          <Button
            variant="outline"
            className="flex h-11 w-full items-center justify-center gap-3 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            onClick={handleGoogleLogin}
            type="button"
            disabled={busy}
          >
            {oauthLoading === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Continue with Google
          </Button>

          {!nativeApp ? (
            <Button
              variant="outline"
              className="flex h-11 w-full items-center justify-center gap-3 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
              onClick={handleAppleLogin}
              type="button"
              disabled={busy}
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Continue with Apple
            </Button>
          ) : null}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
              disabled={busy}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/forgot-password"
              className="text-gray-500 transition-colors hover:text-gray-900"
            >
              Forgot password?
            </Link>

            <Link
              to="/register"
              className="text-gray-500 transition-colors hover:text-gray-900"
            >
              Create account
            </Link>
          </div>

          <p className="text-center text-xs leading-relaxed text-gray-400">
            By continuing, you agree to the{" "}
            <Link to="/terms" className="underline hover:text-gray-600">
              Terms
            </Link>{" "}
            and acknowledge the{" "}
            <Link to="/privacy" className="underline hover:text-gray-600">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <nav
          aria-label="Legal and support"
          className="mt-5 flex items-center justify-center gap-3 text-[11px] text-gray-500"
        >
          <Link to="/privacy" className="hover:text-gray-900 hover:underline">
            Privacy
          </Link>
          <span aria-hidden="true" className="text-gray-300">•</span>
          <Link to="/terms" className="hover:text-gray-900 hover:underline">
            Terms
          </Link>
          <span aria-hidden="true" className="text-gray-300">•</span>
          <Link to="/contact-us" className="hover:text-gray-900 hover:underline">
            Contact Us
          </Link>
        </nav>
      </div>
    </div>
  );
}
