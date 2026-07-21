import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (
  !supabaseUrl ||
  !supabaseAnonKey
) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Check VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY.",
  );
}

/*
 * Password recovery intentionally uses Supabase's
 * implicit browser flow instead of the app's normal
 * PKCE client.
 *
 * Supabase's default recovery email redirects back with
 * access_token and refresh_token in the URL hash. This
 * avoids the PKCE code-verifier mismatch that can occur
 * when the reset email opens in a different browser or
 * email-app browser.
 *
 * Keep this client isolated from the main application
 * session. It is used only to request recovery emails.
 */
export const passwordRecoverySupabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        flowType:
          "implicit",

        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,

        storageKey:
          "stockpulse-password-recovery-request",
      },
    },
  );
