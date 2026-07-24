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

const LAST_UPDATED = "July 24, 2026";

function Section({
  title,
  children,
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-bold text-gray-900">
        {title}
      </h2>

      <div className="space-y-3 text-sm leading-7 text-gray-600">
        {children}
      </div>
    </section>
  );
}

function BulletList({ children }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {children}
    </ul>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <p>
        StockPulse (&ldquo;StockPulse,&rdquo;
        &ldquo;we,&rdquo; &ldquo;our,&rdquo; or
        &ldquo;us&rdquo;) provides stock-price
        information, portfolio tracking, watchlists,
        alerts, stock-screening tools, reports, and
        informational AI-generated stock analysis.
      </p>

      <p>
        This Privacy Policy explains what information
        StockPulse collects, why it is collected, how
        it is handled, and the choices available to
        users.
      </p>

      <Section title="1. Information We Collect">
        <h3 className="font-semibold text-gray-900">
          Account information
        </h3>

        <p>
          When you create or use a StockPulse account,
          we may collect:
        </p>

        <BulletList>
          <li>Your email address.</li>
          <li>A unique account identifier.</li>
          <li>
            Your selected sign-in provider, such as
            email, Google, or Apple.
          </li>
          <li>
            Authentication and session information
            needed to keep you signed in.
          </li>
        </BulletList>

        <p>
          Passwords entered for email-based accounts
          are handled by Supabase Auth. StockPulse does
          not receive or store your password in
          readable form.
        </p>

        <h3 className="pt-2 font-semibold text-gray-900">
          Portfolio and financial information you enter
        </h3>

        <p>
          StockPulse stores information you voluntarily
          enter to provide portfolio-tracking features,
          including:
        </p>

        <BulletList>
          <li>Stock symbols and company names.</li>
          <li>Share quantities and purchase prices.</li>
          <li>Purchase or transaction dates.</li>
          <li>Manually recorded purchases and sales.</li>
          <li>Watchlist entries.</li>
          <li>Price-alert settings.</li>
          <li>Saved stock screens.</li>
          <li>Portfolio and report preferences.</li>
          <li>Generated portfolio reports.</li>
        </BulletList>

        <p>
          This information is used only to provide
          StockPulse features. StockPulse does not
          connect to your bank or brokerage account,
          hold money, or execute securities
          transactions.
        </p>

        <h3 className="pt-2 font-semibold text-gray-900">
          Referral and premium information
        </h3>

        <p>
          If you participate in the referral program or
          use premium features, we may store your
          referral code, referral attribution,
          promotional eligibility, premium entitlement,
          and applicable expiration information.
        </p>

        <h3 className="pt-2 font-semibold text-gray-900">
          Support communications
        </h3>

        <p>
          When you contact StockPulse, we may collect
          your email address, the subject and contents
          of your message, and any additional
          information you voluntarily include.
        </p>

        <h3 className="pt-2 font-semibold text-gray-900">
          Technical and operational information
        </h3>

        <p>
          StockPulse does not use third-party
          behavioural analytics or advertising
          trackers.
        </p>

        <p>
          Our hosting, authentication, security,
          email-delivery, and infrastructure providers
          may process limited technical information
          needed to operate and protect the service,
          such as:
        </p>

        <BulletList>
          <li>IP address.</li>
          <li>Browser or device type.</li>
          <li>Request timestamps.</li>
          <li>Authentication events.</li>
          <li>Error and security logs.</li>
          <li>Application performance information.</li>
        </BulletList>

        <p>
          StockPulse may use essential browser storage
          or authentication tokens to keep you signed
          in and save selected settings. These
          technologies are not used for third-party
          advertising.
        </p>
      </Section>

      <Section title="2. Information We Do Not Collect">
        <p>
          StockPulse does not intentionally collect:
        </p>

        <BulletList>
          <li>Bank-account credentials.</li>
          <li>Brokerage login credentials.</li>
          <li>Credit-card numbers directly.</li>
          <li>Government identification numbers.</li>
          <li>Precise location.</li>
          <li>Contacts from your device.</li>
          <li>Photos or videos from your device.</li>
          <li>Health information.</li>
          <li>Advertising identifiers.</li>
          <li>
            Data used to track you across unrelated
            apps or websites.
          </li>
        </BulletList>
      </Section>

      <Section title="3. How We Use Information">
        <p>We use collected information to:</p>

        <BulletList>
          <li>Create and authenticate your account.</li>
          <li>Save and display your portfolio.</li>
          <li>
            Calculate manually tracked portfolio values
            and returns.
          </li>
          <li>
            Provide stock prices, charts, company
            information, news, and screening data.
          </li>
          <li>
            Create watchlists, alerts, and reports.
          </li>
          <li>
            Generate informational AI-assisted stock
            analysis.
          </li>
          <li>
            Manage referrals and premium access.
          </li>
          <li>Respond to support requests.</li>
          <li>
            Maintain security and prevent misuse.
          </li>
          <li>Diagnose technical problems.</li>
          <li>Comply with legal obligations.</li>
          <li>Enforce our Terms of Service.</li>
        </BulletList>
      </Section>

      <Section title="4. Service Providers">
        <p>
          StockPulse relies on third-party service
          providers to operate the service. These may
          include:
        </p>

        <BulletList>
          <li>
            <strong>Supabase</strong>, for
            authentication, databases, server
            functions, and file storage.
          </li>
          <li>
            <strong>Finnhub</strong>, for stock prices,
            historical market data, company
            information, financial metrics, news, and
            symbols.
          </li>
          <li>
            <strong>xAI</strong>, for informational
            AI-generated stock analysis.
          </li>
          <li>
            <strong>Vercel</strong>, for website
            hosting, delivery, and operational
            services.
          </li>
          <li>
            <strong>Apple and Google</strong>, when you
            choose their authentication services.
          </li>
          <li>
            <strong>Resend or another email provider</strong>,
            for transmitting support messages.
          </li>
          <li>
            <strong>
              Apple or another authorized payment
              provider
            </strong>
            , if paid features are offered through an
            applicable platform.
          </li>
        </BulletList>

        <p>
          When StockPulse requests market data or AI
          analysis, relevant stock symbols, company
          names, or prompts may be transmitted to the
          applicable provider.
        </p>

        <p>
          Each provider processes information under its
          own terms and privacy practices.
        </p>
      </Section>

      <Section title="5. Data Sharing">
        <p>
          StockPulse does not sell or rent personal
          information.
        </p>

        <p>Information may be shared only:</p>

        <BulletList>
          <li>
            With service providers needed to operate
            StockPulse.
          </li>
          <li>When you direct us to share it.</li>
          <li>
            To investigate fraud, abuse, security
            incidents, or Terms violations.
          </li>
          <li>
            When required by law, legal process, or a
            valid government request.
          </li>
          <li>
            In connection with a merger, acquisition,
            financing, reorganization, or sale of the
            service, subject to appropriate
            protections.
          </li>
        </BulletList>
      </Section>

      <Section title="6. Advertising and Tracking">
        <p>StockPulse does not:</p>

        <BulletList>
          <li>
            Display third-party behavioural
            advertising.
          </li>
          <li>Sell information to advertisers.</li>
          <li>
            Track you across unrelated apps or
            websites.
          </li>
          <li>Use third-party advertising SDKs.</li>
          <li>
            Use third-party behavioural
            product-analytics SDKs.
          </li>
        </BulletList>

        <p>
          If these practices change, this policy and
          the applicable store disclosures will be
          updated before the change is introduced.
        </p>
      </Section>

      <Section title="7. Data Storage and Security">
        <p>
          StockPulse uses reasonable administrative,
          technical, and organizational safeguards
          designed to protect information.
        </p>

        <p>These safeguards may include:</p>

        <BulletList>
          <li>Encrypted network connections.</li>
          <li>Access controls.</li>
          <li>Row-level database security.</li>
          <li>
            Restricted administrative credentials.
          </li>
          <li>
            Server-side storage of private API keys.
          </li>
          <li>Authentication and session controls.</li>
        </BulletList>

        <p>
          No online service can guarantee absolute
          security. You are responsible for maintaining
          the confidentiality of your credentials and
          promptly notifying us if you suspect
          unauthorized access.
        </p>
      </Section>

      <Section title="8. Data Retention">
        <p>
          We generally retain account and portfolio
          information while your account remains active
          or as needed to provide StockPulse.
        </p>

        <p>
          Support communications and limited
          operational records may be retained for a
          reasonable period to respond to requests,
          maintain security, diagnose problems, and
          comply with legal obligations.
        </p>

        <p>
          Service-provider backups or security logs may
          remain for a limited period after deletion
          before being overwritten according to the
          provider&rsquo;s normal retention cycle.
        </p>
      </Section>

      <Section title="9. Account and Data Deletion">
        <p>
          You may initiate permanent account deletion
          from:
        </p>

        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-900">
          Settings → Danger Zone → Delete Account
        </p>

        <p>Account deletion is intended to remove:</p>

        <BulletList>
          <li>Your StockPulse account.</li>
          <li>Portfolio holdings and transactions.</li>
          <li>Watchlists and price alerts.</li>
          <li>Saved screens.</li>
          <li>Reports and related files.</li>
          <li>
            Referral and profile information associated
            with your account.
          </li>
        </BulletList>

        <p>
          If you use Sign in with Apple, StockPulse also
          attempts to revoke the applicable Apple
          authorization as part of deletion.
        </p>

        <p>
          You may also use the{" "}
          <Link
            to="/contact-us"
            className="font-semibold text-gray-900 underline"
          >
            Contact Us
          </Link>{" "}
          page for assistance.
        </p>
      </Section>

      <Section title="10. International Processing">
        <p>
          StockPulse and its service providers may
          process information in Canada, the United
          States, or other countries in which they
          operate.
        </p>

        <p>
          Privacy laws in those locations may differ
          from those in your country.
        </p>
      </Section>

      <Section title="11. Children’s Privacy">
        <p>
          StockPulse is not intended for children under
          13.
        </p>

        <p>
          We do not knowingly collect personal
          information from children under 13. If we
          learn that such information was collected, we
          will take reasonable steps to delete it.
        </p>
      </Section>

      <Section title="12. Your Choices">
        <p>
          Depending on your location, you may have
          rights to:
        </p>

        <BulletList>
          <li>
            Request access to information associated
            with your account.
          </li>
          <li>Correct inaccurate information.</li>
          <li>
            Delete your account and associated
            information.
          </li>
          <li>
            Withdraw consent where processing is based
            on consent.
          </li>
          <li>
            Ask questions about how information is
            handled.
          </li>
        </BulletList>

        <p>
          Requests may be submitted through the{" "}
          <Link
            to="/contact-us"
            className="font-semibold text-gray-900 underline"
          >
            Contact Us
          </Link>{" "}
          page.
        </p>
      </Section>

      <Section title="13. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy to reflect
          changes to StockPulse, its service providers,
          or applicable requirements.
        </p>

        <p>
          The revised policy will display a new
          &ldquo;Last updated&rdquo; date. Material
          changes may also be communicated through
          StockPulse or another appropriate method.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          For privacy questions, data requests, or
          account-deletion assistance, use the public{" "}
          <Link
            to="/contact-us"
            className="font-semibold text-gray-900 underline"
          >
            Contact Us
          </Link>{" "}
          page.
        </p>
      </Section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;)
        govern your access to and use of StockPulse.
      </p>

      <p>
        By creating an account, accessing StockPulse,
        or using any StockPulse feature, you agree to
        these Terms and the{" "}
        <Link
          to="/privacy"
          className="font-semibold text-gray-900 underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <Section title="1. The StockPulse Service">
        <p>
          StockPulse is an informational stock-price
          and portfolio-tracking service.
        </p>

        <p>Features may include:</p>

        <BulletList>
          <li>Stock-price information.</li>
          <li>Historical charts.</li>
          <li>
            Company profiles and financial metrics.
          </li>
          <li>News and watchlists.</li>
          <li>
            Manually entered portfolio holdings and
            transactions.
          </li>
          <li>Portfolio calculations.</li>
          <li>Price alerts.</li>
          <li>Stock-screening tools.</li>
          <li>Reports.</li>
          <li>Referral and premium features.</li>
          <li>AI-generated stock analysis.</li>
        </BulletList>

        <p>
          Features may be added, changed, suspended, or
          removed over time.
        </p>
      </
