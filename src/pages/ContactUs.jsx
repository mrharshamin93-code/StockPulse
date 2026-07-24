import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

const MAX_SUBJECT_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 5000;

export default function ContactUs() {
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Hidden anti-spam honeypot field.
  const [website, setWebsite] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const backPath = user ? "/settings" : "/login";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (sending) {
      return;
    }

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanSubject || !cleanMessage) {
      setError(
        "Enter a subject and message.",
      );

      return;
    }

    setSending(true);
    setError("");

    try {
      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL;

      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Support is not configured correctly.",
        );
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn(
          "Unable to read the current session:",
          sessionError,
        );
      }

      const headers = {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      };

      const accessToken =
        sessionData?.session?.access_token;

      if (accessToken) {
        headers.Authorization =
          `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/contact-support`,
        {
          method: "POST",
          headers,

          body: JSON.stringify({
            subject: cleanSubject,
            message: cleanMessage,
            website,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            "Your message could not be sent.",
        );
      }

      setSent(true);
      setSubject("");
      setMessage("");
      setWebsite("");
    } catch (submitError) {
      console.error(
        "Support message failed:",
        submitError,
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSent(false);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex min-h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Link
            to={backPath}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-500" />

            <span className="font-heading text-sm font-bold text-gray-900">
              Contact Us
            </span>
          </div>

          <div className="w-[54px]" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>

              <h1 className="mt-5 font-heading text-2xl font-bold text-gray-900">
                Message sent
              </h1>

              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Thank you for contacting StockPulse.
                We will review your message as soon as
                possible.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6"
                onClick={resetForm}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  StockPulse Support
                </p>

                <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-gray-900">
                  How can we help?
                </h1>

                <p className="mt-3 text-sm leading-6 text-gray-500">
                  We’re here to help—send us a message and we’ll get back to you.
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <form
                onSubmit={handleSubmit}
                className="mt-7 space-y-5"
              >
                {/* Hidden spam-trap field */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
                >
                  <Label htmlFor="website">
                    Website
                  </Label>

                  <Input
                    id="website"
                    name="website"
                    type="text"
                    value={website}
                    onChange={(event) =>
                      setWebsite(
                        event.target.value,
                      )
                    }
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-subject">
                    Subject
                  </Label>

                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(event) => {
                      setSubject(
                        event.target.value,
                      );

                      if (error) {
                        setError("");
                      }
                    }}
                    maxLength={
                      MAX_SUBJECT_LENGTH
                    }
                    placeholder="How can we help?"
                    required
                  />

                  <p className="text-right text-[11px] text-gray-400">
                    {subject.length}/
                    {MAX_SUBJECT_LENGTH}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-message">
                    Message
                  </Label>

                  <textarea
                    id="support-message"
                    value={message}
                    onChange={(event) => {
                      setMessage(
                        event.target.value,
                      );

                      if (error) {
                        setError("");
                      }
                    }}
                    maxLength={
                      MAX_MESSAGE_LENGTH
                    }
                    placeholder="Describe your question or issue."
                    className="flex min-h-[180px] w-full resize-y rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  />

                  <p className="text-right text-[11px] text-gray-400">
                    {message.length}/
                    {MAX_MESSAGE_LENGTH}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-gray-900 text-white hover:bg-gray-800"
                  disabled={
                    sending ||
                    !subject.trim() ||
                    !message.trim()
                  }
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}

                  {sending
                    ? "Sending…"
                    : "Send Message"}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs leading-5 text-gray-400">
                Information submitted through this
                form is handled according to the{" "}
                <Link
                  to="/privacy"
                  className="underline hover:text-gray-600"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </>
          )}
        </section>

        <nav
          aria-label="Legal links"
          className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-500"
        >
          <Link
            to="/privacy"
            className="hover:text-gray-900 hover:underline"
          >
            Privacy
          </Link>

          <span aria-hidden="true">
            •
          </span>

          <Link
            to="/terms"
            className="hover:text-gray-900 hover:underline"
          >
            Terms
          </Link>
        </nav>
      </main>
    </div>
  );
}
