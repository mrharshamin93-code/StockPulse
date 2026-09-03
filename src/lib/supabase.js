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

const rawSupabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        skipAutoInitialize:
          isOAuthCallback,
        flowType: "pkce",
      },
    },
  );

function sanitizeStockSingleResult(
  result,
) {
  if (!result?.error) {
    return result;
  }

  console.error(
    "Supabase stock lookup failed:",
    result.error,
  );

  return {
    ...result,
    error: {
      ...result.error,
      message:
        "Unable to load this stock. Please try again.",
    },
  };
}

function wrapStocksBuilder(
  builder,
) {
  if (
    !builder ||
    typeof builder !== "object"
  ) {
    return builder;
  }

  return new Proxy(
    builder,
    {
      get(
        target,
        property,
      ) {
        if (
          property === "single"
        ) {
          return (
            ...args
          ) =>
            Promise.resolve(
              target.single(
                ...args,
              ),
            ).then(
              sanitizeStockSingleResult,
            );
        }

        const value =
          Reflect.get(
            target,
            property,
            target,
          );

        if (
          typeof value !==
          "function"
        ) {
          return value;
        }

        return (
          ...args
        ) => {
          const next =
            value.apply(
              target,
              args,
            );

          if (
            next &&
            typeof next ===
              "object" &&
            typeof next.then ===
              "function"
          ) {
            return wrapStocksBuilder(
              next,
            );
          }

          return next;
        };
      },
    },
  );
}

export const supabase =
  new Proxy(
    rawSupabase,
    {
      get(
        target,
        property,
      ) {
        if (
          property === "from"
        ) {
          return (
            table,
          ) => {
            const builder =
              target.from(
                table,
              );

            return table ===
                "stocks"
              ? wrapStocksBuilder(
                  builder,
                )
              : builder;
          };
        }

        const value =
          Reflect.get(
            target,
            property,
            target,
          );

        return typeof value ===
          "function"
          ? value.bind(
              target,
            )
          : value;
      },
    },
  );
