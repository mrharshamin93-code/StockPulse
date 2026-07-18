import React from "react";
import ThemeSection from "@/components/settings/ThemeSection";
import SubPageHeader from "@/components/SubPageHeader";

export default function ThemeSettings() {
  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title="Appearance" backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <ThemeSection />
      </main>
    </div>
  );
}