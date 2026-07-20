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
       * The dedicated callback page exchanges the
       * one-use OAuth code exactly once. Keeping this
       * disabled avoids racing the callback component.
       */
      detectSessionInUrl: false,

      /*
       * Use the OAuth authorization-code PKCE flow.
       */
      flowType: "pkce",
    },
  }
);
