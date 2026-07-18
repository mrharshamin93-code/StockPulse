import React from "react";
import { useSearchParams } from "react-router-dom";
import SubPageHeader from "@/components/SubPageHeader";

const CONTENT = {
  privacy: {
    title: "Privacy Policy",
    body: `Last updated: July 2026

StockPulse ("we", "our", or "us") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights as a user.

**Information We Collect**
- Account information: your email address, collected when you register.
- Portfolio data you voluntarily enter: stock tickers, share quantities, and purchase prices.
- Watchlist items and price alert preferences you configure.
- Anonymous usage data (e.g. feature interactions) used solely to improve app performance.

**How We Use Your Data**
- To provide, maintain, and improve the StockPulse service.
- To fetch real-time and historical market data relevant to your portfolio from our data provider, Finnhub (finnhub.io).
- To deliver price alert notifications you have explicitly configured.
- To generate optional portfolio performance reports you request.
- We do not sell, rent, or share your personal data with third parties for advertising or marketing purposes.

**Third-Party Data Providers**
Market data (prices, company profiles, historical charts) is sourced from Finnhub. By using StockPulse you acknowledge that your stock ticker queries are transmitted to Finnhub's servers to retrieve this data. Finnhub's privacy policy is available at finnhub.io/privacy-policy.

**Data Storage & Security**
Your account and portfolio data is stored securely using industry-standard encryption in transit (TLS) and at rest. We retain your data for as long as your account is active.

**Data Retention & Deletion**
You may permanently delete your account and all associated data at any time via Settings → Danger Zone → Delete Account. Deletion is immediate and irreversible.

**Children's Privacy**
StockPulse is not directed at children under 13. We do not knowingly collect personal information from children under 13.

**Changes to This Policy**
We may update this Privacy Policy from time to time. We will notify you of significant changes via the app. Continued use constitutes acceptance of the updated policy.

**Contact**
For privacy-related questions or data requests, please contact us via Settings → Contact Us.`,
  },
  terms: {
    title: "Terms of Service",
    body: `Last updated: July 2026

Please read these Terms of Service carefully before using StockPulse. By creating an account or using the app, you agree to be bound by these terms.

**Not Financial Advice**
StockPulse is a personal portfolio tracking and informational tool only. Nothing in this app — including prices, charts, AI-generated analysis, screener results, or any other content — constitutes financial advice, investment advice, tax advice, or a recommendation to buy, hold, or sell any security or financial instrument. Always consult a qualified financial advisor before making investment decisions.

**Accuracy of Market Data**
Real-time and historical market data is provided by Finnhub (finnhub.io) and may be delayed, incomplete, or inaccurate. StockPulse makes no representations or warranties regarding the accuracy, completeness, or timeliness of any data displayed in the app. Do not rely solely on data shown in StockPulse for investment decisions.

**Eligibility**
You must be at least 13 years old to use StockPulse. By using the app you represent that you meet this requirement.

**User Responsibilities**
- You are solely responsible for the accuracy of data you manually enter (share quantities, purchase prices, etc.).
- You agree not to use StockPulse for any unlawful purpose or in violation of any applicable laws or regulations.
- You agree not to attempt to gain unauthorized access to the service, its servers, or related systems.
- You agree not to reverse-engineer, scrape, or redistribute data or content from the app without our written permission.

**AI-Generated Content**
StockPulse uses AI to generate stock analysis summaries and screener results. This content is generated automatically and may contain errors or omissions. It is provided for informational purposes only and must not be relied upon as financial advice.

**Limitation of Liability**
To the fullest extent permitted by law, StockPulse and its operators shall not be liable for any direct, indirect, incidental, special, or consequential damages — including any financial losses — arising from your use of or reliance on the app or any data it displays.

**Intellectual Property**
All app content, design, and code is the property of StockPulse. You are granted a limited, non-exclusive, non-transferable licence to use the app for personal, non-commercial purposes.

**Termination**
We reserve the right to suspend or terminate your access if you violate these terms.

**Changes to Terms**
We may update these Terms from time to time. Continued use of the app after changes are posted constitutes acceptance of the revised terms.

**Governing Law**
These Terms are governed by the laws of the Province of Ontario, Canada, without regard to conflict-of-law principles.

**Contact**
For questions about these Terms, please contact us via Settings → Contact Us.`,
  },
};

export default function Legal() {
  const [params] = useSearchParams();
  const page = params.get("page") === "terms" ? "terms" : "privacy";
  const { title, body } = CONTENT[page];

  return (
    <div
      className="min-h-screen bg-gray-50/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}
    >
      <SubPageHeader title={title} backPath="/settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          {body.split("\n\n").map((para, i) => {
            if (para.startsWith("**") && para.endsWith("**")) {
              return <h2 key={i} className="font-heading font-semibold text-base mt-5 mb-2 first:mt-0">{para.replace(/\*\*/g, "")}</h2>;
            }
            if (para.startsWith("- ")) {
              return (
                <ul key={i} className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-3">
                  {para.split("\n").map((line, j) => (
                    <li key={j}>{line.replace(/^- /, "")}</li>
                  ))}
                </ul>
              );
            }
            // Check if paragraph contains bold sections inline
            if (para.includes("**")) {
              const parts = para.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {parts.map((part, j) =>
                    part.startsWith("**") ? <strong key={j} className="text-foreground font-semibold">{part.replace(/\*\*/g, "")}</strong> : part
                  )}
                </p>
              );
            }
            return <p key={i} className="text-sm text-muted-foreground mb-3 leading-relaxed">{para}</p>;
          })}
        </div>
      </main>
    </div>
  );
}