import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart2,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { isNativeApp, signInWithGoogle } from "@/lib/mobileAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEATURES = [
  {
    icon: BarChart2,
    label: "Track your portfolio",
    desc: "Monitor all your holdings in one place",
  },
  {
    icon: TrendingUp,
    label: "Market insights",
    desc: "AI-powered stock analysis and news",
  },
  {
    icon: Zap,
    label: "Stock screener",
    desc: "Filter stocks by fundamentals and metrics",
  },
  {
    icon: ShieldCheck,
    label: "Secure & private",
    desc: "Your account and portfolio data are protected",
  },
];

function friendlyRegistrationError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already")
  ) {
    return "An account may already exist for this email. Try signing in or resetting your password.";
  }

  if (message.includes("password") && message.includes("characters")) {
    return "Please choose a password that meets the password requirements.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many account creation attempts. Please wait a few minutes and try again.";
  }

  if (message.includes("invalid") && message.includes("email")) {
    return "Enter a valid email address.";
  }

  return "Unable to create your account right now. Please try again.";
}

export default function Register() {
  const navigate = useNavigate();
  const nativeApp = isNativeApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState("");
  const [error, setError] = useState("");

  async function handleRegister(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (loading || oauthLoading) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signUpError) throw signUpError;

      if (!data?.session?.user) {
        setError(
          "Your account was created. Check your email for any required verification, then sign in.",
        );
        return;
      }

      navigate("/", { replace: true });
    } catch (registerError) {
      console.error("Registration failed:", registerError);
      setError(friendlyRegistrationError(registerError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading || oauthLoading) return;

    setError("");
    setOauthLoading("google");

    try {
      await signInWithGoogle();
      if (nativeApp) setOauthLoading("");
    } catch (oauthError) {
      console.error("Google registration failed:", oauthError);
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
      console.error("Apple registration failed:", oauthError);
      setError("Apple sign-in could not be completed. Please try again.");
      setOauthLoading("");
    }
  }

  const busy = loading || oauthLoading !== "";

  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50 lg:flex-row"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
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
            Track your portfolio, follow market activity, and access intelligent
            investing tools in one place.
          </p>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">
          © 2026 StockPulse. All rights reserved.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-gray-900">
              Create Your Account
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Start tracking your portfolio in minutes
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

            <div className={nativeApp ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
              {!nativeApp ? (
                <Button
                  variant="outline"
                  className="h-11 w-full gap-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                  onClick={handleAppleLogin}
                  type="button"
                  disabled={busy}
                >
                  {oauthLoading === "apple" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Apple
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="h-11 w-full gap-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                onClick={handleGoogleLogin}
                type="button"
                disabled={busy}
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-50 px-2 text-gray-400">or</span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="Create a password (min 6 characters)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-confirm-password">Confirm Password</Label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
                disabled={busy}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
            </form>

            <p className="text-center text-xs leading-relaxed text-gray-400">
              By creating an account, you agree to the{" "}
              <Link to="/terms" className="underline hover:text-gray-600">
                Terms
              </Link>{" "}
              and acknowledge the{" "}
              <Link to="/privacy" className="underline hover:text-gray-600">
                Privacy Policy
              </Link>
              .
            </p>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
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
      </div>
    </div>
  );
}
