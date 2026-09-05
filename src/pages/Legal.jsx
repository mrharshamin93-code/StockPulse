import React from "react";
import {
  Link,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Shield,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";

const LAST_UPDATED = "September 5, 2026";

const PRIVACY_POLICY = `
StockPulse ("StockPulse," "we," "our," or "us") provides stock-price information, portfolio tracking, watchlists, alerts, stock-screening tools, reports, and informational AI-generated stock analysis.

This Privacy Policy explains what information StockPulse collects, why it is collected, how it is handled, and the choices available to users.

## 1. Information We Collect

### Account information

When you create or use a StockPulse account, we may collect your email address, a unique account identifier, your selected sign-in provider, and authentication or session information needed to keep you signed in.

Passwords for email-based accounts are handled by Supabase Auth. StockPulse does not receive or store your password in readable form.

### Portfolio and financial information you enter

StockPulse stores information you voluntarily enter to provide portfolio-tracking features, including:

- Stock symbols and company names.
- Share quantities and purchase prices.
- Purchase or transaction dates.
- Manually recorded purchases and sales.
- Watchlist entries.
- Price-alert settings.
- Saved stock screens.
- Portfolio and report preferences.
- Generated portfolio reports.

This information is used to provide StockPulse features. StockPulse does not connect to your bank or brokerage account, hold money, or execute securities transactions.

### Push notifications

If you enable push notifications, StockPulse may store an app- and device-specific push notification token associated with your account. We use this token to deliver notifications you request or enable, such as stock price alerts. Push notification delivery on Apple devices is provided through the Apple Push Notification service (APNs). You can control notification permissions through your device settings.

### Referral and premium information

If you participate in the referral program or use premium features, we may store your referral code, referral attribution, promotional eligibility, premium entitlement, and applicable expiration information.

### Support communications

When you contact StockPulse, we may collect your email address, the subject and contents of your message, and any additional information you voluntarily include.

### Technical and operational information

StockPulse does not use third-party behavioral analytics or advertising trackers.

Our hosting, authentication, security, email-delivery, notification-delivery, and infrastructure providers may process limited technical information needed to operate and protect the service, such as:

- IP address.
- Browser or device type.
- Push notification token, when notifications are enabled.
- Request timestamps.
- Authentication events.
- Error and security logs.
- Application performance information.

StockPulse may use essential browser storage or authentication tokens to keep you signed in and save selected settings. These technologies are not used for third-party advertising.

## 2. Information We Do Not Intentionally Collect

StockPulse does not intentionally collect:

- Bank-account credentials.
- Brokerage login credentials.
- Credit-card numbers directly.
- Government identification numbers.
- Precise location.
- Contacts from your device.
- Photos or videos from your device.
- Health information.
- Advertising identifiers.
- Data used to track you across unrelated apps or websites.

## 3. How We Use Information

We use collected information to:

- Create and authenticate your account.
- Save and display your portfolio.
- Calculate manually tracked portfolio values and returns.
- Provide stock prices, charts, company information, news, and screening data.
- Create watchlists, alerts, saved screens, and reports.
- Deliver enabled push notifications, including price alerts.
- Generate informational AI-assisted stock analysis.
- Manage referrals and premium access.
- Respond to support requests.
- Maintain security and prevent misuse.
- Diagnose technical problems.
- Comply with legal obligations and enforce our Terms of Service.

## 4. Service Providers

StockPulse relies on third-party service providers to operate the service. These may include:

- Supabase, for authentication, databases, server functions, and file storage.
- Financial Datasets, for stock prices, historical market data, company information, financial metrics, news, and symbol information.
- xAI, for informational AI-generated stock analysis.
- Vercel, for website hosting, delivery, and operational services.
- Apple and Google, when you choose their authentication services.
- Apple Push Notification service (APNs), for delivery of push notifications on Apple devices.
- An email-delivery provider, if enabled, for transmitting support messages.
- Apple or another authorized payment provider, if paid features are offered through an applicable platform.

When StockPulse requests market data or AI analysis, relevant stock symbols, company names, or prompts may be transmitted to the applicable provider. When push notifications are enabled, the applicable push notification token and notification payload are transmitted as necessary to deliver the notification. Each provider processes information under its own terms and privacy practices.

## 5. Data Sharing

StockPulse does not sell or rent personal information. Information may be shared only:

- With service providers needed to operate StockPulse.
- When you direct us to share it.
- To investigate fraud, abuse, security incidents, or violations of our Terms.
- When required by law, legal process, or a valid government request.
- In connection with a merger, acquisition, financing, reorganization, or sale of the service, subject to appropriate protections.

## 6. Advertising and Tracking

StockPulse does not:

- Display third-party behavioral advertising.
- Sell information to advertisers.
- Track you across unrelated apps or websites.
- Use third-party advertising SDKs.
- Use third-party behavioral product-analytics SDKs.

If these practices change, this Privacy Policy and the applicable store disclosures will be updated before the change is introduced.

## 7. Data Storage and Security

StockPulse uses reasonable administrative, technical, and organizational safeguards designed to protect information. These safeguards may include encrypted network connections, access controls, row-level database security, restricted administrative credentials, server-side storage of private API keys, and authentication and session controls.

No online service can guarantee absolute security. You are responsible for maintaining the confidentiality of your credentials and promptly notifying us if you suspect unauthorized access.

## 8. Data Retention

We generally retain account and portfolio information while your account remains active or as needed to provide StockPulse. Push notification tokens may be retained while notifications are enabled or as needed to provide notification functionality and may be replaced when the operating system issues a new token.

Support communications and limited operational records may be retained for a reasonable period to respond to requests, maintain security, diagnose problems, and comply with legal obligations.

Service-provider backups or security logs may remain for a limited period after deletion before being overwritten according to the provider's normal retention cycle.

## 9. Account and Data Deletion

You may initiate permanent account deletion from Settings → Danger Zone → Delete Account.

Account deletion is intended to remove:

- Your StockPulse account.
- Portfolio holdings and transactions.
- Watchlists and price alerts.
- Push notification registration information associated with your account.
- Saved screens.
- Reports and related files.
- Referral and profile information associated with your account.

If you use Sign in with Apple, StockPulse also attempts to revoke the applicable Apple authorization as part of deletion. You may also use the public Contact Us page for assistance.

## 10. International Processing

StockPulse and its service providers may process information in Canada, the United States, or other countries in which they operate. Privacy laws in those locations may differ from those in your country.

## 11. Children's Privacy

StockPulse is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we learn that such information was collected, we will take reasonable steps to delete it.

## 12. Your Choices

Depending on your location, you may have rights to request access to information associated with your account, correct inaccurate information, delete your account, withdraw consent where processing is based on consent, or ask questions about how information is handled.

Requests may be submitted through the public Contact Us page.

## 13. Changes to This Privacy Policy

We may update this Privacy Policy to reflect changes to StockPulse, its service providers, or applicable requirements. The revised policy will display a new Last updated date. Material changes may also be communicated through StockPulse or another appropriate method.

## 14. Contact

For privacy questions, data requests, or account-deletion assistance, use the public Contact Us page.
`;

const TERMS_OF_SERVICE = `
These Terms of Service ("Terms") govern your access to and use of StockPulse.

By creating an account, accessing StockPulse, or using any StockPulse feature, you agree to these Terms and the StockPulse Privacy Policy.

## 1. The StockPulse Service

StockPulse is an informational stock-price and portfolio-tracking service. Features may include stock prices, historical charts, company information, financial metrics, news, watchlists, manually entered holdings and transactions, portfolio calculations, price alerts, screening tools, saved screens, reports, referral rewards, premium features, and AI-generated stock analysis.

Features may be added, changed, suspended, or removed over time.

## 2. Eligibility

You must be at least 13 years old to use StockPulse. If the laws where you live require a higher minimum age, you may use StockPulse only with any authorization required by those laws.

## 3. Accounts

You agree to:

- Provide accurate account information.
- Maintain the security of your credentials.
- Use only an account you are authorized to use.
- Promptly notify StockPulse if you suspect unauthorized access.
- Accept responsibility for activity conducted through your account.

## 4. Portfolio Records Do Not Execute Trades

StockPulse allows you to manually record portfolio activity. Buttons or features labeled Buy, Sell, Add Shares, Record Sale, or similar terms only update your personal portfolio records within StockPulse.

StockPulse:

- Is not a brokerage.
- Does not execute securities transactions.
- Does not receive, hold, transfer, or invest user funds.
- Does not confirm that a trade occurred outside StockPulse.

You are solely responsible for ensuring that entered holdings, quantities, prices, and dates are accurate.

## 5. No Financial Advice

StockPulse is provided for informational and educational purposes only. Nothing in StockPulse constitutes investment, financial, tax, legal, accounting, or personalized advice; a recommendation or solicitation to buy, sell, or hold a security; a representation that an investment is suitable for you; or a promise of future performance.

You are responsible for your own investment decisions and should independently verify important information.

## 6. Market Data

Market prices, charts, company information, metrics, and news may be supplied by third-party providers such as Financial Datasets. Market information may be delayed, incomplete, incorrect, unavailable, adjusted, revised, or different from information displayed by a broker or exchange.

StockPulse does not guarantee the accuracy, completeness, availability, or timeliness of market information. You must not rely on StockPulse as your only source for an investment decision.

## 7. AI-Generated Content

StockPulse may use artificial intelligence to generate stock summaries, bullish considerations, bearish risks, or other analysis. AI-generated content may contain errors or omissions, may be outdated, may misunderstand a company or security, and may produce unsupported conclusions.

AI-generated content is not personalized financial advice and does not guarantee any investment result. You must independently verify important information before relying on it.

## 8. Premium Features and Referrals

StockPulse may offer premium functionality, promotional access, trials, subscriptions, or referral rewards.

Referral rewards:

- Have no cash value.
- Are not transferable unless expressly permitted.
- May require the referred user to satisfy stated eligibility conditions.
- May be withheld or revoked for duplicate, fraudulent, automated, or abusive referrals.
- May be modified or discontinued prospectively.

If paid subscriptions are offered, the price, billing period, renewal terms, and cancellation method will be displayed through the applicable authorized payment provider before purchase.

Deleting StockPulse does not necessarily cancel a subscription managed through an app marketplace. Marketplace subscriptions must be managed through the applicable marketplace account.

## 9. Acceptable Use

You agree not to:

- Use StockPulse for an unlawful or fraudulent purpose.
- Attempt unauthorized access to an account, database, server, or system.
- Circumvent security, access controls, rate limits, or premium restrictions.
- Scrape or extract StockPulse content without written permission.
- Redistribute licensed market data without authorization.
- Introduce malware or disruptive requests.
- Impersonate another person.
- Abuse the referral system.

## 10. Third-Party Services

StockPulse depends on third-party authentication, hosting, database, market-data, artificial-intelligence, email-delivery, and payment providers. Your use of certain third-party features may also be governed by those providers' terms.

StockPulse is not responsible for an external service's independent acts, outages, content, security practices, or policy changes.

## 11. Ownership and License

StockPulse and its original software, branding, design, text, and proprietary content are owned by StockPulse or its licensors. StockPulse grants you a limited, personal, revocable, non-exclusive, non-transferable license to use the service for its intended purpose.

Market data, company logos, news, and other third-party materials remain the property of their respective owners or licensors. These Terms do not grant you the right to commercially reproduce, redistribute, sublicense, or sell StockPulse content or market data.

## 12. User-Provided Information

You retain responsibility for information you submit to StockPulse. You grant StockPulse permission to host, process, display, and transmit that information only as reasonably necessary to operate the service, provide requested features, maintain security, respond to support requests, comply with law, and enforce these Terms.

## 13. Availability and Changes

StockPulse may experience interruptions caused by maintenance, updates, service-provider outages, data-provider restrictions, network problems, or events outside our control. We do not guarantee that every feature will always be available or error-free.

## 14. Account Suspension and Termination

You may stop using StockPulse or initiate account deletion at any time. StockPulse may suspend or terminate access because of Terms violations, fraud, abuse, security risks, legal requirements, non-payment, or discontinuation of the service.

## 15. Disclaimer of Warranties

To the maximum extent permitted by law, StockPulse is provided on an as-is and as-available basis. StockPulse disclaims warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, availability, and uninterrupted operation to the extent permitted by law.

Nothing in these Terms excludes a consumer right that cannot lawfully be excluded.

## 16. Limitation of Liability

To the maximum extent permitted by law, StockPulse and its operators, suppliers, and licensors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from or related to StockPulse.

This includes losses involving investment decisions, trading losses, lost profits or opportunities, data loss, service interruptions, reliance on inaccurate market data, reliance on AI-generated content, or unauthorized account access.

## 17. Governing Law

These Terms are governed by the laws of the Province of Ontario and the applicable federal laws of Canada, without regard to conflict-of-law principles. Nothing in this section prevents you from relying on mandatory consumer protections applicable in your place of residence.

## 18. Changes to These Terms

We may update these Terms to reflect changes to StockPulse, applicable laws, licensing arrangements, or business practices. The revised Terms will display an updated date.

## 19. Contact

Questions about these Terms may be submitted through the public Contact Us page.
`;

function parseDocument(documentText) {
  const lines = documentText
    .trim()
    .split("\n")
    .map((line) => line.trim());

  const blocks = [];

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line = lines[index];

    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading",
        text: line.slice(3),
      });

      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({
        type: "subheading",
        text: line.slice(4),
      });

      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];

      while (
        index < lines.length &&
        lines[index].startsWith("- ")
      ) {
        items.push(
          lines[index].slice(2),
        );

        index += 1;
      }

      index -= 1;

      blocks.push({
        type: "list",
        items,
      });

      continue;
    }

    blocks.push({
      type: "paragraph",
      text: line,
    });
  }

  return blocks;
}

const PRIVACY_BLOCKS =
  parseDocument(PRIVACY_POLICY);

const TERMS_BLOCKS =
  parseDocument(TERMS_OF_SERVICE);

function LegalContent({ blocks }) {
  return blocks.map(
    (block, index) => {
      const key =
        `${block.type}-${index}`;

      if (
        block.type ===
        "heading"
      ) {
        return (
          <h2
            key={key}
            className="font-heading text-lg font-bold text-gray-900"
          >
            {block.text}
          </h2>
        );
      }

      if (
        block.type ===
        "subheading"
      ) {
        return (
          <h3
            key={key}
            className="font-semibold text-gray-900"
          >
            {block.text}
          </h3>
        );
      }

      if (
        block.type ===
        "list"
      ) {
        return (
          <ul
            key={key}
            className="list-disc space-y-2 pl-5"
          >
            {block.items.map(
              (item) => (
                <li key={item}>
                  {item}
                </li>
              ),
            )}
          </ul>
        );
      }

      return (
        <p key={key}>
          {block.text}
        </p>
      );
    },
  );
}

export default function Legal({
  page: forcedPage,
}) {
  const { user } = useAuth();

  const location =
    useLocation();

  const [searchParams] =
    useSearchParams();

  const requestedPage =
    forcedPage ||
    (
      location.pathname ===
        "/terms" ||
      searchParams.get(
        "page",
      ) === "terms"
        ? "terms"
        : "privacy"
    );

  const isTerms =
    requestedPage === "terms";

  const title =
    isTerms
      ? "Terms of Service"
      : "Privacy Policy";

  const Icon =
    isTerms
      ? FileText
      : Shield;

  const blocks =
    isTerms
      ? TERMS_BLOCKS
      : PRIVACY_BLOCKS;

  const backPath =
    user
      ? "/settings"
      : "/login";

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur"
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            to={backPath}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-500" />

            <span className="font-heading text-sm font-bold text-gray-900">
              {title}
            </span>
          </div>

          <div className="w-[54px]" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="border-b border-gray-100 pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              StockPulse
            </p>

            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-gray-900">
              {title}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Last updated:{" "}
              {LAST_UPDATED}
            </p>
          </div>

          <div className="mt-8 space-y-5 text-sm leading-7 text-gray-600">
            <LegalContent
              blocks={blocks}
            />
          </div>
        </article>

        <nav
          aria-label="Legal links"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500"
        >
          <Link
            to="/privacy"
            className="hover:text-gray-900 hover:underline"
          >
            Privacy Policy
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

          <span aria-hidden="true">
            •
          </span>

          <Link
            to="/contact-us"
            className="hover:text-gray-900 hover:underline"
          >
            Contact Us
          </Link>
        </nav>

        <p className="mt-4 text-center text-xs text-gray-400">
          StockPulse · Stock
          Portfolio
        </p>
      </main>
    </div>
  );
}