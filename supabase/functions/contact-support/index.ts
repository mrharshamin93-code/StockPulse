const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const MAX_SUBJECT_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 5000;

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function cleanText(
  value: unknown,
  maximumLength: number,
) {
  return String(value ?? "")
    .trim()
    .slice(0, maximumLength);
}

function isValidEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          success: false,

          error:
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const body =
        await request
          .json()
          .catch(() => null) as {
            email?: unknown;
            subject?: unknown;
            message?: unknown;
            website?: unknown;
          } | null;

      /*
       * Honeypot:
       * Bots frequently fill hidden fields.
       * Return success without sending.
       */
      const website =
        cleanText(
          body?.website,
          250,
        );

      if (website) {
        return jsonResponse({
          success: true,
        });
      }

      const email =
        cleanText(
          body?.email,
          320,
        );

      const subject =
        cleanText(
          body?.subject,
          MAX_SUBJECT_LENGTH,
        );

      const message =
        cleanText(
          body?.message,
          MAX_MESSAGE_LENGTH,
        );

      if (!isValidEmail(email)) {
        return jsonResponse(
          {
            success: false,

            error:
              "Enter a valid email address.",
          },
          400,
        );
      }

      if (
        subject.length < 3
      ) {
        return jsonResponse(
          {
            success: false,

            error:
              "Enter a subject.",
          },
          400,
        );
      }

      if (
        message.length < 10
      ) {
        return jsonResponse(
          {
            success: false,

            error:
              "Enter a more detailed message.",
          },
          400,
        );
      }

      const resendApiKey =
        Deno.env.get(
          "RESEND_API_KEY",
        );

      const supportEmail =
        Deno.env.get(
          "SUPPORT_EMAIL",
        );

      const supportFromEmail =
        Deno.env.get(
          "SUPPORT_FROM_EMAIL",
        );

      if (
        !resendApiKey ||
        !supportEmail ||
        !supportFromEmail
      ) {
        console.error(
          "Contact support secrets are missing.",
        );

        return jsonResponse(
          {
            success: false,

            error:
              "Support messaging is temporarily unavailable.",
          },
          503,
        );
      }

      const safeEmail =
        escapeHtml(email);

      const safeSubject =
        escapeHtml(subject);

      const safeMessage =
        escapeHtml(message)
          .replaceAll(
            "\n",
            "<br />",
          );

      const submittedAt =
        new Date()
          .toISOString();

      const userAgent =
        cleanText(
          request.headers.get(
            "user-agent",
          ),
          500,
        );

      const resendResponse =
        await fetch(
          "https://api.resend.com/emails",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${resendApiKey}`,

              "Content-Type":
                "application/json",

              "Idempotency-Key":
                crypto.randomUUID(),
            },

            body:
              JSON.stringify({
                from:
                  supportFromEmail,

                to: [
                  supportEmail,
                ],

                reply_to:
                  email,

                subject:
                  `[StockPulse Support] ${subject}`,

                text: [
                  `From: ${email}`,
                  `Subject: ${subject}`,
                  `Submitted: ${submittedAt}`,
                  `User agent: ${userAgent || "Not provided"}`,
                  "",
                  message,
                ].join("\n"),

                html: `
                  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
                    <h2 style="margin-bottom:16px">StockPulse Support Message</h2>

                    <p>
                      <strong>From:</strong>
                      ${safeEmail}
                    </p>

                    <p>
                      <strong>Subject:</strong>
                      ${safeSubject}
                    </p>

                    <p>
                      <strong>Submitted:</strong>
                      ${submittedAt}
                    </p>

                    <hr style="margin:24px 0;border:0;border-top:1px solid #e5e7eb" />

                    <p>${safeMessage}</p>
                  </div>
                `,
              }),
          },
        );

      const resendResult =
        await resendResponse
          .json()
          .catch(() => null);

      if (
        !resendResponse.ok
      ) {
        console.error(
          "Resend support email failed:",
          resendResponse.status,
          resendResult,
        );

        return jsonResponse(
          {
            success: false,

            error:
              "Your message could not be sent.",
          },
          502,
        );
      }

      return jsonResponse({
        success: true,
      });
    } catch (error) {
      console.error(
        "Unexpected contact-support error:",
        error,
      );

      return jsonResponse(
        {
          success: false,

          error:
            "Your message could not be sent.",
        },
        500,
      );
    }
  },
);
