import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

Deno.serve(
  async (request) => {
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
            "Method not allowed",
        },
        405,
      );
    }

    try {
      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      const anonKey =
        Deno.env.get(
          "SUPABASE_ANON_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey ||
        !anonKey
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Supabase environment is not configured.",
          },
          500,
        );
      }

      const authorization =
        request.headers.get(
          "Authorization",
        );

      if (
        !authorization?.startsWith(
          "Bearer ",
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      const body =
        await request
          .json()
          .catch(
            () => ({}),
          );

      if (
        body?.confirmation !==
        "DELETE_ACCOUNT"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Account deletion was not confirmed.",
          },
          400,
        );
      }

      /*
       * Client scoped to the signed-in user.
       * This verifies that the caller owns a
       * legitimate Supabase session.
       */
      const userClient =
        createClient(
          supabaseUrl,
          anonKey,
          {
            global: {
              headers: {
                Authorization:
                  authorization,
              },
            },
            auth: {
              persistSession:
                false,
              autoRefreshToken:
                false,
            },
          },
        );

      const {
        data: userData,
        error: userError,
      } =
        await userClient.auth.getUser();

      if (
        userError ||
        !userData?.user?.id
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Your session is invalid or has expired.",
          },
          401,
        );
      }

      const userId =
        userData.user.id;

      /*
       * Admin client.
       *
       * Never expose SUPABASE_SERVICE_ROLE_KEY
       * in the browser or Capacitor app.
       */
      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,
              autoRefreshToken:
                false,
            },
          },
        );

      /*
       * Delete public user-owned data first.
       *
       * These correspond to StockPulse features.
       * Each delete is user-scoped.
       *
       * A table that doesn't exist is ignored so
       * future schema differences don't prevent
       * the user's auth account from being removed.
       */
      const tables = [
        "price_alerts",
        "transactions",
        "saved_screens",
        "watchlist_items",
        "watchlists",
        "stocks",
        "profiles",
      ];

      for (
        const table of tables
      ) {
        try {
          const {
            error,
          } =
            await adminClient
              .from(table)
              .delete()
              .eq(
                "user_id",
                userId,
              );

          if (error) {
            /*
             * Some StockPulse installations may
             * not have every optional table.
             */
            console.warn(
              `Could not clear ${table}:`,
              error.message,
            );
          }
        } catch (
          error
        ) {
          console.warn(
            `Could not clear ${table}:`,
            error,
          );
        }
      }

      /*
       * Finally remove the Supabase Auth account.
       */
      const {
        error:
          deleteUserError,
      } =
        await adminClient
          .auth
          .admin
          .deleteUser(
            userId,
          );

      if (
        deleteUserError
      ) {
        console.error(
          "Failed to delete auth user:",
          deleteUserError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "The account could not be deleted.",
          },
          500,
        );
      }

      return jsonResponse({
        success: true,
      });
    } catch (
      error
    ) {
      console.error(
        "Delete account function error:",
        error,
      );

      return jsonResponse(
        {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "The account could not be deleted.",
        },
        500,
      );
    }
  },
);
