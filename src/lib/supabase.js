import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const isOAuthCallback =
  typeof window !== "undefined" &&
  window.location.pathname ===
    "/auth/callback";

if (
  !supabaseUrl ||
  !supabaseAnonKey
) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY for this build.",
  );
}

export const supabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        /*
         * Keep the user signed in across
         * browser refreshes and native app
         * restarts.
         */
        persistSession: true,

        /*
         * Refresh expired access tokens
         * automatically.
         */
        autoRefreshToken: true,

        /*
         * OAuth callbacks are handled
         * explicitly by StockPulse.
         */
        detectSessionInUrl: false,

        /*
         * On the web OAuth callback page,
         * exchange the PKCE code before
         * recovering an older session.
         *
         * Normal web and Capacitor launches
         * initialize the saved session
         * automatically.
         */
        skipAutoInitialize:
          isOAuthCallback,

        /*
         * Use OAuth authorization-code
         * PKCE flow on web and native.
         */
        flowType: "pkce",
      },
    },
  );
