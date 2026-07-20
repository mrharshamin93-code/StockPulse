import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Check VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY in Vercel."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      /*
       * Keep the user signed in across page reloads
       * and mobile browser restarts.
       */
      persistSession: true,

      /*
       * Refresh expired access tokens automatically.
       */
      autoRefreshToken: true,

      /*
       * Automatically detect ?code=... on the OAuth
       * callback and complete the PKCE exchange.
       *
       * Do not also call exchangeCodeForSession()
       * manually in callback.jsx.
       */
      detectSessionInUrl: true,

      /*
       * Use the OAuth authorization-code PKCE flow.
       */
      flowType: "pkce",
    },
  }
);
