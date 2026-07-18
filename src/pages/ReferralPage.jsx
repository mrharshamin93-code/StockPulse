import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Gift, Copy, Check, Users, Crown } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";

export default function ReferralPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${user?.id?.slice(0, 8) || ""}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join StockPulse",
        text: "Track your portfolio smarter. Join me on StockPulse!",
        url: referralLink,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title="Refer & Unlock" backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Gift className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="font-heading text-2xl font-bold text-center mb-2">Refer Friends, Get Premium</h2>
          <p className="text-white/80 text-sm text-center leading-relaxed">
            For every friend who installs StockPulse using your link, you unlock <span className="font-semibold text-white">1 month of Premium</span> access — free.
          </p>
        </div>

        {/* How it works */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">How it works</p>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Share your link</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send your unique referral link to friends</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Friend installs the app</p>
                <p className="text-xs text-muted-foreground mt-0.5">They sign up using your referral link</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-sm">You get 1 month of Premium</p>
                <p className="text-xs text-muted-foreground mt-0.5">Every referral adds another month — no cap</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral link */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3 px-1">Your Referral Link</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 gap-3">
              <span className="text-sm font-mono text-muted-foreground truncate">{referralLink}</span>
              <button onClick={handleCopy} className="shrink-0 p-1">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 text-center font-medium">Link copied!</p>}
            <button
              onClick={handleShare}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors"
            >
              Share with Friends
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}