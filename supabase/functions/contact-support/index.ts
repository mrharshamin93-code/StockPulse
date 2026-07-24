import {
  createClient,
} from "npm:@supabase/supabase-js@2";

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

async function getAuthenticatedUser(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "Authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return {
      email: "",
      userId: "",
    };
  }

  const accessToken =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!accessToken) {
    return {
      email: "",
      userId: "",
    };
  }

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const supabaseAnonKey =
    Deno.env.get(
      "SUPABASE_ANON_KEY",
    );

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    console.error(
      "Supabase function environment is missing.",
    );

    return {
      email: "",
      userId: "",
    };
  }

  const supabase =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser(accessToken);

  if (error || !data.user) {
    console.warn(
      "Unable to identify support user:",
      error?.message,
    );

    return {
      email: "",
      userId: "",
    };
  }

  return {
    email:
      cleanText(
        data.user.email,
        320,
      ),

    userId:
      cleanText(
        data.user.id,
        100,
      ),
  };
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

      const authenticatedUser =
        await getAuthenticatedUser(
          request,
        );

      const senderEmail =
        isValidEmail(
          authenticatedUser.email,
        )
          ? authenticatedUser.email
          : "";

      const senderLabel =
        senderEmail ||
        "Anonymous visitor";

      const safeSender =
        escapeHtml(
          senderLabel,
        );

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

      const resendPayload:
        Record<
          string,
          unknown
        > = {
          from:
            supportFromEmail,

          to: [
            supportEmail,
          ],

          subject:
            `[StockPulse Support] ${subject}`,

          text: [
            `Sender: ${senderLabel}`,
            `User ID: ${authenticatedUser.userId || "Not signed in"}`,
            `Subject: ${subject}`,
            `Submitted: ${submittedAt}`,
            `User agent: ${userAgent || "Not provided"}`,
            "",
            message,
          ].join("\n"),

          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin-bottom:16px">
                StockPulse Support Message
              </h2>

              <p>
                <strong>Sender:</strong>
                ${safeSender}
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
        };

      /*
       * Replies go directly to the signed-in
       * user's email when one is available.
       */
      if (senderEmail) {
        resendPayload.reply_to =
          senderEmail;
      }

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
              JSON.stringify(
                resendPayload,
              ),
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
