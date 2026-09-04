import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { supabase } from "@/lib/supabase";

export const IOS_AUTH_CALLBACK =
  "com.harshamin.stockpulse://auth/callback";

export const IOS_RESET_PASSWORD_URL =
  "com.harshamin.stockpulse://reset-password";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getAuthCallbackUrl() {
  if (isNativeApp()) {
    return IOS_AUTH_CALLBACK;
  }

  return `${window.location.origin}/auth/callback`;
}

async function signInWithOAuthProvider(provider, scopes) {
  const native = isNativeApp();

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthCallbackUrl(),
        scopes,
        skipBrowserRedirect: native,
      },
    });

  if (error) {
    throw error;
  }

  if (!native) {
    return;
  }

  if (!data?.url) {
    throw new Error(
      `${provider} sign-in could not be started.`,
    );
  }

  await Browser.open({
    url: data.url,
  });
}

export async function signInWithGoogle() {
  return signInWithOAuthProvider(
    "google",
    "openid email profile https://www.googleapis.com/auth/userinfo.email",
  );
}

export async function signInWithApple() {
  return signInWithOAuthProvider(
    "apple",
    "name email",
  );
}

function decodeError(rawValue) {
  if (!rawValue) {
    return "";
  }

  try {
    return decodeURIComponent(
      String(rawValue).replace(
        /\+/g,
        " ",
      ),
    );
  } catch {
    return String(rawValue);
  }
}

function getUrlParts(incomingUrl) {
  const parsed =
    new URL(incomingUrl);

  return {
    search: parsed.search || "",
    hash: parsed.hash || "",
  };
}

function navigateWithoutReload(path) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.history.replaceState(
    {},
    "",
    path,
  );

  window.dispatchEvent(
    new PopStateEvent("popstate"),
  );
}

let nativeAuthListener = null;
let handlingOAuth = false;
let lastHandledUrl = "";

async function handleNativeUrl(url) {
  if (!url) {
    return;
  }

  if (url === lastHandledUrl) {
    return;
  }

  lastHandledUrl = url;

  if (
    url.startsWith(
      IOS_RESET_PASSWORD_URL,
    )
  ) {
    const { search, hash } =
      getUrlParts(url);

    navigateWithoutReload(
      `/reset-password${search}${hash}`,
    );

    return;
  }

  if (
    !url.startsWith(
      IOS_AUTH_CALLBACK,
    )
  ) {
    return;
  }

  if (handlingOAuth) {
    return;
  }

  handlingOAuth = true;

  try {
    await Browser.close().catch(
      () => {},
    );

    const callbackUrl =
      new URL(url);

    const rawError =
      callbackUrl.searchParams.get(
        "error_description",
      ) ||
      callbackUrl.searchParams.get(
        "error",
      );

    if (rawError) {
      throw new Error(
        decodeError(rawError),
      );
    }

    /*
     * The same custom-scheme callback can occasionally be delivered
     * more than once on iOS. If the first delivery already created
     * the session, do not consume the one-time PKCE code again.
     */
    const {
      data: existingSessionData,
      error: existingSessionError,
    } = await supabase.auth.getSession();

    if (existingSessionError) {
      console.warn(
        "Unable to check existing native session:",
        existingSessionError,
      );
    }

    if (
      existingSessionData?.session?.user
    ) {
      return;
    }

    const code =
      callbackUrl.searchParams.get(
        "code",
      );

    if (!code) {
      throw new Error(
        "No authentication code was returned.",
      );
    }

    const { data, error } =
      await supabase.auth
        .exchangeCodeForSession(
          code,
        );

    if (error) {
      /*
       * If another callback raced with this one, the first may have
       * already persisted a valid session. Recover that instead of
       * showing a false sign-in failure.
       */
      const {
        data: recoveredSessionData,
      } = await supabase.auth
        .getSession()
        .catch(() => ({
          data: null,
        }));

      if (
        recoveredSessionData?.session
          ?.user
      ) {
        return;
      }

      throw error;
    }

    if (!data?.session?.user) {
      throw new Error(
        "Authentication completed but no session was created.",
      );
    }

    /*
     * Do not reload the Capacitor WebView here.
     *
     * exchangeCodeForSession() emits SIGNED_IN. AuthContext receives
     * the session, and Login.jsx moves to /watchlist after the auth
     * state is stable. This avoids duplicate deep-link processing and
     * the flashing/login-error loop.
     */
  } catch (error) {
    console.error(
      "Native OAuth callback failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Social sign-in failed.";

    navigateWithoutReload(
      `/login?error=${encodeURIComponent(
        message,
      )}`,
    );
  } finally {
    handlingOAuth = false;
  }
}

export async function initializeNativeAuth() {
  if (!isNativeApp()) {
    return;
  }

  if (nativeAuthListener) {
    return;
  }

  nativeAuthListener =
    await App.addListener(
      "appUrlOpen",
      async ({ url }) => {
        await handleNativeUrl(url);
      },
    );

  const launchData =
    await App.getLaunchUrl();

  if (launchData?.url) {
    await handleNativeUrl(
      launchData.url,
    );
  }
}
