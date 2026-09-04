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

export async function signInWithGoogle() {
  const native = isNativeApp();

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",

      options: {
        redirectTo: getAuthCallbackUrl(),

        scopes:
          "openid email profile https://www.googleapis.com/auth/userinfo.email",

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
      "Google sign-in could not be started.",
    );
  }

  await Browser.open({
    url: data.url,
  });
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
     * If the callback is delivered again after the first exchange
     * already succeeded, use the persisted session instead of trying
     * to consume the one-time PKCE code a second time.
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
       * A duplicate callback can race with the successful first
       * exchange. Before showing an error, check whether that first
       * exchange already persisted a valid session.
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
     * IMPORTANT:
     *
     * Do not call window.location.replace("/") here.
     *
     * Reloading the Capacitor WebView destroys this module state.
     * On iOS, App.getLaunchUrl() can then surface the same custom
     * scheme callback again. Because the PKCE code is one-time use,
     * the second exchange fails and sends the app back to login even
     * though the first exchange already created and persisted a valid
     * session. That is what causes the flashing/login-error loop.
     *
     * exchangeCodeForSession() emits SIGNED_IN. AuthContext receives
     * the session and Login.jsx redirects to /watchlist without a
     * WebView reload.
     */
  } catch (error) {
    console.error(
      "Native OAuth callback failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Google sign-in failed.";

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
