import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function jsonResponse(
  body: Record<string, JsonValue>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getRequiredEnvironmentVariable(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function revokeAppleToken(options: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    token: options.refreshToken,
    token_type_hint: "refresh_token",
  });

  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Apple token revocation failed with status ${response.status}: ${
        responseText || "No response body"
      }`,
    );
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const supabaseUrl =
      getRequiredEnvironmentVariable("SUPABASE_URL");

    const supabaseAnonKey =
      getRequiredEnvironmentVariable("SUPABASE_ANON_KEY");

    const supabaseServiceRoleKey =
      getRequiredEnvironmentVariable(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    const authorizationHeader =
      request.headers.get("Authorization");

    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Missing authentication token.",
        },
        401,
      );
    }

    const accessToken =
      authorizationHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid authentication token.",
        },
        401,
      );
    }

    /*
     * User-scoped client.
     *
     * This verifies the JWT against Supabase Auth instead of
     * trusting a user ID supplied by the browser.
     */
    const authenticatedClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await authenticatedClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error(
        "Unable to verify account deletion user:",
        userError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Your session could not be verified. Sign in again and retry.",
        },
        401,
      );
    }

    /*
     * Administrative client.
     *
     * Never expose SUPABASE_SERVICE_ROLE_KEY in Vite or the
     * browser. It must remain an Edge Function secret.
     */
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const providers = Array.isArray(
      user.app_metadata?.providers,
    )
      ? user.app_metadata.providers
      : [];

    const primaryProvider =
      typeof user.app_metadata?.provider === "string"
        ? user.app_metadata.provider
        : null;

    const usesApple =
      primaryProvider === "apple" ||
      providers.includes("apple");

    /*
     * Apple token handling
     *
     * Supabase's normal browser OAuth session does not give the
     * application the Apple refresh token afterward.
     *
     * When native Sign in with Apple is added, securely save the
     * Apple refresh token in this server-only table during the
     * initial Apple authorization-code exchange:
     *
     * private.apple_oauth_tokens
     *   user_id uuid primary key
     *   refresh_token text not null
     *
     * The private schema must not be exposed through the API.
     */
    if (usesApple) {
      const {
        data: appleTokenRecord,
        error: appleTokenError,
      } = await adminClient
        .schema("private")
        .from("apple_oauth_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (appleTokenError) {
        console.error(
          "Unable to read Apple refresh token:",
          appleTokenError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Your Apple authorization could not be revoked. Your account was not deleted.",
          },
          500,
        );
      }

      if (!appleTokenRecord?.refresh_token) {
        return jsonResponse(
          {
            success: false,
            error:
              "The Apple authorization token required for account deletion is unavailable. Your account was not deleted.",
          },
          409,
        );
      }

      const appleClientId =
        getRequiredEnvironmentVariable("APPLE_CLIENT_ID");

      const appleClientSecret =
        getRequiredEnvironmentVariable(
          "APPLE_CLIENT_SECRET",
        );

      await revokeAppleToken({
        refreshToken: appleTokenRecord.refresh_token,
        clientId: appleClientId,
        clientSecret: appleClientSecret,
      });

      const { error: appleTokenDeleteError } =
        await adminClient
          .schema("private")
          .from("apple_oauth_tokens")
          .delete()
          .eq("user_id", user.id);

      if (appleTokenDeleteError) {
        console.error(
          "Apple token was revoked, but its stored record could not be deleted:",
          appleTokenDeleteError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Apple access was revoked, but account cleanup could not be completed.",
          },
          500,
        );
      }
    }

    /*
     * Delete child records before parent records.
     *
     * Every deletion is checked individually. A failed deletion
     * stops the operation and the Auth identity remains active.
     */
    const deletionSteps: Array<{
      table: string;
      column: string;
    }> = [
      {
        table: "stock_transactions",
        column: "user_id",
      },
      {
        table: "stock_alerts",
        column: "user_id",
      },
      {
        table: "watchlist_items",
        column: "user_id",
      },
      {
        table: "saved_screens",
        column: "user_id",
      },
      {
        table: "stocks",
        column: "user_id",
      },
    ];

    for (const step of deletionSteps) {
      const { error: deletionError } =
        await adminClient
          .from(step.table)
          .delete()
          .eq(step.column, user.id);

      if (deletionError) {
        console.error(
          `Failed to delete records from ${step.table}:`,
          deletionError,
        );

        return jsonResponse(
          {
            success: false,
            error: `Account deletion failed while removing ${step.table}. No success response was issued.`,
          },
          500,
        );
      }
    }

    /*
     * This must be the final server-side operation.
     *
     * Once it succeeds, the Supabase Auth identity is permanently
     * removed and its existing JWT can no longer be refreshed.
     */
    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(
        user.id,
        false,
      );

    if (deleteUserError) {
      console.error(
        "Failed to delete Supabase Auth user:",
        deleteUserError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Your application data was removed, but the login account could not be deleted. Contact support.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Account permanently deleted.",
    });
  } catch (error) {
    console.error("Unexpected account deletion error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected account deletion error occurred.",
      },
      500,
    );
  }
});
