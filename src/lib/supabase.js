import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "in your Vercel project settings."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      /*
       * Save the user session in browser storage so the
       * user remains signed in after refreshes and redirects.
       */
      persistSession: true,

      /*
       * Automatically refresh expired access tokens.
       */
      autoRefreshToken: true,

      /*
       * AuthCallback manually exchanges the OAuth code.
       */
      detectSessionInUrl: false,

      /*
       * Google returns an authorization code that
       * /auth/callback exchanges for a session.
       */
      flowType: "pkce",
    },
  }
);
