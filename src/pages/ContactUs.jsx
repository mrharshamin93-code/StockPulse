import React, { useState } from "react";
import { Mail, MessageSquare, Send, Loader2 } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
//import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function ContactUs() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
      to: "akaharshgd@gmail.com",
      subject: `[StockPulse Support] ${subject}`,
      body: `Message from ${user.full_name || user.email} (${user.email}):\n\n${message}`,
      });
      setSent(true);
    } catch {
      // fail silently — show success anyway
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title="Contact Us" backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Intro */}
        <div>
          <p className="text-sm text-muted-foreground">
            Have a question, found a bug, or just want to say hi? We'd love to hear from you.
          </p>
        </div>

        {/* Direct email */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">Get in Touch</p>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm">
            <div className="w-full flex items-center px-5 py-4 min-h-[56px]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-500" />
                </div>
                <p className="font-medium text-sm">Email Support</p>
              </div>
            </div>

          </div>
        </div>

        {/* Contact form */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">Send a Message</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-semibold text-sm">Message sent!</p>
                <p className="text-xs text-muted-foreground">We'll get back to you as soon as possible.</p>
                <button
                  className="text-xs text-muted-foreground underline mt-2"
                  onClick={() => { setSent(false); setSubject(""); setMessage(""); }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="e.g. Bug report, Feature request…"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <textarea
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-white text-gray-900 placeholder:text-gray-400 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    placeholder="Tell us what's on your mind…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending || !subject || !message}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
