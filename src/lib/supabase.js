import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      /*
       * Preserve login across reloads and mobile
       * browser restarts.
       */
      persistSession: true,

      /*
       * Automatically renew expired access tokens.
       */
      autoRefreshToken: true,

      /*
       * The dedicated callback page manually exchanges
       * the returned authorization code.
       */
      detectSessionInUrl: false,

      /*
       * signInWithOAuth will create a PKCE verifier,
       * and /auth/callback will exchange the returned code.
       */
      flowType: "pkce",
    },
  }
);
