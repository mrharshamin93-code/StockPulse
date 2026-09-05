import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPORT_BUCKET = "monthly-reports";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function userUsesApple(user: any) {
  const identities = Array.isArray(user?.identities)
    ? user.identities
    : [];
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];

  return (
    user?.app_metadata?.provider === "apple" ||
    providers.includes("apple") ||
    identities.some((identity: any) => identity?.provider === "apple")
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

class AppleRevocationError extends Error {
  diagnostic: string;

  constructor(message: string, diagnostic: string) {
    super(message);
    this.name = "AppleRevocationError";
    this.diagnostic = diagnostic;
  }
}

function parseAppleErrorBody(rawBody: string) {
  const trimmed = rawBody.trim();

  if (!trimmed) {
    return "empty_response";
  }

  try {
    const parsed = JSON.parse(trimmed);
    const code = String(parsed?.error || "").trim();
    const description = String(parsed?.error_description || "").trim();

    if (code && description) {
      return `${code}: ${description}`;
    }

    if (code) {
      return code;
    }
  } catch {
    // Fall through to a conservative plain-text diagnostic.
  }

  return trimmed.replace(/[^a-zA-Z0-9_ .:-]/g, "").slice(0, 240) || "unknown_error";
}

async function revokeAppleAuthorization(
  token: string,
  tokenType: "refresh_token" | "access_token",
) {
  const clientId = Deno.env.get("APPLE_CLIENT_ID");
  const clientSecret = Deno.env.get("APPLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error(
      "Apple revocation configuration missing:",
      JSON.stringify({
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      }),
    );

    throw new AppleRevocationError(
      "Apple account deletion is not fully configured.",
      "missing_apple_configuration",
    );
  }

  const clientSecretClaims = decodeJwtPayload(clientSecret);
  console.log(
    "Apple revocation attempt:",
    JSON.stringify({
      tokenType,
      clientId,
      tokenLength: token.length,
      tokenLooksJwt: token.split(".").length === 3,
      clientSecretIssuer: clientSecretClaims?.iss ?? null,
      clientSecretSubject: clientSecretClaims?.sub ?? null,
      clientSecretAudience: clientSecretClaims?.aud ?? null,
      clientSecretExpiresAt: clientSecretClaims?.exp ?? null,
    }),
  );

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenType,
  });

  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const appleError = parseAppleErrorBody(responseText);
    const diagnostic = `Apple revoke HTTP ${response.status}: ${appleError}`;

    console.error(
      "Apple authorization revocation failed:",
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        appleError,
        tokenType,
        clientId,
        tokenLength: token.length,
      }),
    );

    throw new AppleRevocationError(
      "Apple authorization could not be revoked.",
      diagnostic,
    );
  }

  console.log(
    "Apple authorization revoked successfully:",
    JSON.stringify({ tokenType, status: response.status }),
  );
}

async function deleteRows(
  adminClient: ReturnType<typeof createClient>,
  table: string,
  column: string,
  userId: string,
) {
  const { error } = await adminClient
    .from(table)
    .delete()
    .eq(column, userId);

  if (error) {
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

async function collectReportStoragePaths(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string[]> {
  const paths = new Set<string>();

  const { data: deliveries, error: deliveryError } = await adminClient
    .from("monthly_report_deliveries")
    .select("storage_path")
    .eq("user_id", userId)
    .not("storage_path", "is", null);

  if (deliveryError) {
    throw new Error(
      `Failed to load monthly report files: ${deliveryError.message}`,
    );
  }

  for (const delivery of deliveries || []) {
    const path = String(delivery?.storage_path || "").trim();
    if (path) paths.add(path);
  }

  const { data: monthEntries, error: monthError } = await adminClient.storage
    .from(REPORT_BUCKET)
    .list(userId, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (monthError) {
    throw new Error(
      `Failed to inspect monthly report storage: ${monthError.message}`,
    );
  }

  for (const monthEntry of monthEntries || []) {
    const monthName = String(monthEntry?.name || "").trim();
    if (!monthName) continue;

    const monthPrefix = `${userId}/${monthName}`;
    const { data: files, error: filesError } = await adminClient.storage
      .from(REPORT_BUCKET)
      .list(monthPrefix, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (filesError) {
      throw new Error(
        `Failed to inspect monthly report folder: ${filesError.message}`,
      );
    }

    for (const file of files || []) {
      const fileName = String(file?.name || "").trim();
      if (fileName) paths.add(`${monthPrefix}/${fileName}`);
    }
  }

  return [...paths];
}

async function removeReportFiles(
  adminClient: ReturnType<typeof createClient>,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    if (!batch.length) continue;

    const { error } = await adminClient.storage
      .from(REPORT_BUCKET)
      .remove(batch);

    if (error) {
      throw new Error(
        `Failed to delete monthly report files: ${error.message}`,
      );
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed" },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Delete account environment is incomplete.");
      return jsonResponse(
        { success: false, error: "The account could not be deleted." },
        500,
      );
    }

    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { success: false, error: "Authentication required." },
        401,
      );
    }

    const body = await request.json().catch(() => ({}));

    if (body?.confirmation !== "DELETE_ACCOUNT") {
      return jsonResponse(
        {
          success: false,
          error: "Account deletion was not confirmed.",
        },
        400,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } =
      await userClient.auth.getUser();

    if (userError || !userData?.user?.id) {
      return jsonResponse(
        {
          success: false,
          error: "Your session is invalid or has expired.",
        },
        401,
      );
    }

    const userId = userData.user.id;

    if (userUsesApple(userData.user)) {
      const appleProviderToken = String(
        body?.appleProviderToken || "",
      ).trim();
      const appleProviderTokenType: "refresh_token" | "access_token" =
        body?.appleProviderTokenType === "access_token"
          ? "access_token"
          : "refresh_token";

      if (!appleProviderToken) {
        return jsonResponse(
          {
            success: false,
            code: "APPLE_REAUTH_REQUIRED",
            error:
              "Please sign in with Apple again, then retry account deletion.",
          },
          409,
        );
      }

      try {
        await revokeAppleAuthorization(
          appleProviderToken,
          appleProviderTokenType,
        );
      } catch (error) {
        console.error(
          "Apple revocation failed before account deletion:",
          error,
        );

        const diagnostic =
          error instanceof AppleRevocationError
            ? error.diagnostic
            : "apple_revocation_unknown_error";

        return jsonResponse(
          {
            success: false,
            code: "APPLE_REVOCATION_FAILED",
            error:
              "Apple authorization could not be revoked. Please try again.",
            diagnostic,
          },
          502,
        );
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const reportPaths = await collectReportStoragePaths(
      adminClient,
      userId,
    );

    await removeReportFiles(adminClient, reportPaths);

    await deleteRows(adminClient, "app_notifications", "user_id", userId);
    await deleteRows(
      adminClient,
      "monthly_report_deliveries",
      "user_id",
      userId,
    );
    await deleteRows(adminClient, "stock_alerts", "user_id", userId);
    await deleteRows(adminClient, "stock_transactions", "user_id", userId);
    await deleteRows(adminClient, "saved_screens", "user_id", userId);
    await deleteRows(adminClient, "watchlist_items", "user_id", userId);
    await deleteRows(adminClient, "watchlists", "user_id", userId);
    await deleteRows(adminClient, "stocks", "user_id", userId);
    await deleteRows(adminClient, "profiles", "id", userId);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      userId,
    );

    if (deleteUserError) {
      throw new Error(
        `Failed to delete auth user: ${deleteUserError.message}`,
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete account function error:", error);

    return jsonResponse(
      {
        success: false,
        error: "The account could not be deleted. Please try again.",
      },
      500,
    );
  }
});
