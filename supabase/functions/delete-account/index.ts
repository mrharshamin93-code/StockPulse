import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.110.7";

const REPORT_BUCKET = "monthly-reports";
const STORAGE_PAGE_SIZE = 100;
const STORAGE_DELETE_BATCH_SIZE = 100;

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

type DeleteStep = {
  table: string;
  column: string;
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.code,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.trim());

    if (parts.length > 0) {
      return [...new Set(parts)].join(" — ");
    }
  }

  return "Unknown error";
}

function isMissingBucketError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("bucket not found") ||
    message.includes("not found") ||
    message.includes("404")
  );
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

async function listStorageFilesRecursively(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const filePaths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await adminClient.storage
      .from(bucket)
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw error;
    }

    const entries = data || [];

    for (const entry of entries) {
      const path = prefix
        ? `${prefix}/${entry.name}`
        : entry.name;

      const isFolder =
        !entry.id &&
        !entry.metadata;

      if (isFolder) {
        const nestedPaths = await listStorageFilesRecursively(
          adminClient,
          bucket,
          path,
        );

        filePaths.push(...nestedPaths);
      } else {
        filePaths.push(path);
      }
    }

    if (entries.length < STORAGE_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_PAGE_SIZE;
  }

  return filePaths;
}

async function deleteUserReportFiles(
  adminClient: SupabaseClient,
  userId: string,
): Promise<number> {
  let filePaths: string[];

  try {
    filePaths = await listStorageFilesRecursively(
      adminClient,
      REPORT_BUCKET,
      userId,
    );
  } catch (error) {
    if (isMissingBucketError(error)) {
      console.warn(
        `Storage bucket "${REPORT_BUCKET}" was not found; continuing account deletion.`,
      );
      return 0;
    }

    throw new Error(
      `Unable to list monthly report files: ${getErrorMessage(error)}`,
    );
  }

  for (
    let index = 0;
    index < filePaths.length;
    index += STORAGE_DELETE_BATCH_SIZE
  ) {
    const batch = filePaths.slice(
      index,
      index + STORAGE_DELETE_BATCH_SIZE,
    );

    const { error } = await adminClient.storage
      .from(REPORT_BUCKET)
      .remove(batch);

    if (error) {
      throw new Error(
        `Unable to delete monthly report files: ${getErrorMessage(error)}`,
      );
    }
  }

  return filePaths.length;
}

async function deleteTableRows(
  adminClient: SupabaseClient,
  userId: string,
  step: DeleteStep,
): Promise<void> {
  const { error } = await adminClient
    .from(step.table)
    .delete()
    .eq(step.column, userId);

  if (error) {
    throw new Error(
      `Account deletion failed while removing ${step.table}: ${getErrorMessage(
        error,
      )}`,
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
    const requestBody = await request
      .json()
      .catch(() => null) as {
        confirmation?: unknown;
      } | null;

    if (requestBody?.confirmation !== "DELETE_ACCOUNT") {
      return jsonResponse(
        {
          success: false,
          error:
            "Account deletion confirmation is missing or invalid.",
        },
        400,
      );
    }

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
     * Verify the caller through Supabase Auth. Never trust a user ID
     * supplied by the browser.
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
     * Service-role client. The service key remains server-side and
     * must never be exposed through Vite or committed to GitHub.
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
     * Apple requires token revocation when the app supports native
     * Sign in with Apple. The native authorization-code flow must save
     * the refresh token in private.apple_oauth_tokens.
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
     * Delete private report files before deleting their database rows.
     * Supabase Storage objects are not removed by Postgres cascades.
     */
    const deletedReportFiles =
      await deleteUserReportFiles(
        adminClient,
        user.id,
      );

    /*
     * Delete child rows before parent rows. Every step is checked.
     * The Auth identity is retained if any application cleanup fails.
     */
    const deletionSteps: DeleteStep[] = [
      {
        table: "monthly_report_deliveries",
        column: "user_id",
      },
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
      {
        table: "watchlists",
        column: "user_id",
      },
      {
        table: "profiles",
        column: "id",
      },
    ];

    const deletedTables: string[] = [];

    for (const step of deletionSteps) {
      await deleteTableRows(
        adminClient,
        user.id,
        step,
      );

      deletedTables.push(step.table);
    }

    /*
     * Delete the Supabase Auth identity last. Once this succeeds, the
     * user's refresh token can no longer create a new session.
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
      cleanup: {
        deleted_report_files: deletedReportFiles,
        deleted_tables: deletedTables,
        auth_user_deleted: true,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error(
      "Unexpected account deletion error:",
      message,
      error,
    );

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500,
    );
  }
});
