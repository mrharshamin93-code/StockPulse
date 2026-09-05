import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const isOAuthCallback =
  typeof window !== "undefined" &&
  window.location.pathname ===
    "/auth/callback";

const APPLE_PROVIDER_TOKEN_KEY =
  "stockpulse:apple-provider-token";
const APPLE_PROVIDER_REFRESH_TOKEN_KEY =
  "stockpulse:apple-provider-refresh-token";

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

function sessionUsesApple(session) {
  const identities =
    Array.isArray(
      session?.user?.identities,
    )
      ? session.user.identities
      : [];

  const providers =
    Array.isArray(
      session?.user?.app_metadata
        ?.providers,
    )
      ? session.user.app_metadata
          .providers
      : [];

  return (
    session?.user?.app_metadata
      ?.provider === "apple" ||
    providers.includes("apple") ||
    identities.some(
      (identity) =>
        identity?.provider ===
        "apple",
    )
  );
}

function persistAppleProviderTokens(
  session,
) {
  if (
    typeof window === "undefined" ||
    !sessionUsesApple(session)
  ) {
    return;
  }

  try {
    if (
      session?.provider_refresh_token
    ) {
      window.localStorage.setItem(
        APPLE_PROVIDER_REFRESH_TOKEN_KEY,
        session.provider_refresh_token,
      );
    }

    if (session?.provider_token) {
      window.localStorage.setItem(
        APPLE_PROVIDER_TOKEN_KEY,
        session.provider_token,
      );
    }
  } catch (error) {
    console.warn(
      "Unable to preserve Apple authorization for account deletion:",
      error,
    );
  }
}

function clearAppleProviderTokens() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      APPLE_PROVIDER_REFRESH_TOKEN_KEY,
    );
    window.localStorage.removeItem(
      APPLE_PROVIDER_TOKEN_KEY,
    );
  } catch {
    // Local cleanup is best-effort.
  }
}

function getAppleRevocationToken() {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const refreshToken =
      window.localStorage.getItem(
        APPLE_PROVIDER_REFRESH_TOKEN_KEY,
      );

    if (refreshToken) {
      return {
        token: refreshToken,
        type: "refresh_token",
      };
    }

    const accessToken =
      window.localStorage.getItem(
        APPLE_PROVIDER_TOKEN_KEY,
      );

    if (accessToken) {
      return {
        token: accessToken,
        type: "access_token",
      };
    }
  } catch {
    // The Edge Function will request reauthentication if needed.
  }

  return null;
}

rawSupabase.auth.onAuthStateChange(
  (event, session) => {
    if (session) {
      persistAppleProviderTokens(
        session,
      );
    }

    if (event === "SIGNED_OUT") {
      clearAppleProviderTokens();
    }
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

function wrapFunctionsClient(client) {
  return new Proxy(client, {
    get(target, property) {
      if (property === "invoke") {
        return async (
          functionName,
          options = {},
        ) => {
          if (
            functionName !==
            "delete-account"
          ) {
            return target.invoke(
              functionName,
              options,
            );
          }

          const appleToken =
            getAppleRevocationToken();

          const body = {
            ...(options?.body || {}),
          };

          if (appleToken) {
            body.appleProviderToken =
              appleToken.token;
            body.appleProviderTokenType =
              appleToken.type;
          }

          const result =
            await target.invoke(
              functionName,
              {
                ...options,
                body,
              },
            );

          if (
            !result?.error &&
            result?.data?.success
          ) {
            clearAppleProviderTokens();
          }

          return result;
        };
      }

      const value = Reflect.get(
        target,
        property,
        target,
      );

      return typeof value ===
        "function"
        ? value.bind(target)
        : value;
    },
  });
}

const wrappedFunctions =
  wrapFunctionsClient(
    rawSupabase.functions,
  );

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

        if (
          property === "functions"
        ) {
          return wrappedFunctions;
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
