import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { supabase } from "@/lib/supabase";

export const IOS_AUTH_CALLBACK =
  "com.stockpulse.app://auth/callback";

export const IOS_RESET_PASSWORD_URL =
  "com.stockpulse.app://reset-password";

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

        /*
         * Explicitly request the Google identity/email scopes.
         * This improves compatibility with new Google accounts
         * and Google Workspace accounts where the email may not
         * otherwise be returned as expected.
         */
        scopes:
          "openid email profile https://www.googleapis.com/auth/userinfo.email",

        /*
         * On iOS/Capacitor we open the OAuth URL ourselves
         * using Capacitor Browser.
         *
         * On the web, Supabase performs the redirect normally.
         */
        skipBrowserRedirect: native,
      },
    });

  if (error) {
    throw error;
  }

  /*
   * Web:
   * Supabase redirects the browser to Google automatically.
   */
  if (!native) {
    return;
  }

  /*
   * Native:
   * Supabase returns the Google OAuth URL and we open it
   * in the system browser.
   */
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

let nativeAuthListener = null;
let handlingOAuth = false;
let lastHandledUrl = "";

async function handleNativeUrl(url) {
  if (!url) {
    return;
  }

  /*
   * Prevent the same deep link from being processed twice.
   */
  if (url === lastHandledUrl) {
    return;
  }

  lastHandledUrl = url;

  /*
   * Password-reset deep link.
   */
  if (
    url.startsWith(
      IOS_RESET_PASSWORD_URL,
    )
  ) {
    const { search, hash } =
      getUrlParts(url);

    window.location.replace(
      `/reset-password${search}${hash}`,
    );

    return;
  }

  /*
   * Ignore unrelated deep links.
   */
  if (
    !url.startsWith(
      IOS_AUTH_CALLBACK,
    )
  ) {
    return;
  }

  /*
   * Prevent multiple OAuth exchanges from running
   * simultaneously.
   */
  if (handlingOAuth) {
    return;
  }

  handlingOAuth = true;

  try {
    /*
     * Close the system OAuth browser after StockPulse
     * receives the callback.
     */
    await Browser.close().catch(
      () => {},
    );

    const callbackUrl =
      new URL(url);

    /*
     * Surface any error returned by Google/Supabase.
     */
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
     * Supabase PKCE OAuth returns a one-time code.
     */
    const code =
      callbackUrl.searchParams.get(
        "code",
      );

    if (!code) {
      throw new Error(
        "No authentication code was returned.",
      );
    }

    /*
     * Exchange the one-time OAuth code for the user's
     * persistent Supabase session.
     */
    const { data, error } =
      await supabase.auth
        .exchangeCodeForSession(
          code,
        );

    if (error) {
      throw error;
    }

    if (!data?.session?.user) {
      throw new Error(
        "Authentication completed but no session was created.",
      );
    }

    /*
     * Authentication succeeded.
     */
    window.location.replace("/");
  } catch (error) {
    console.error(
      "Native OAuth callback failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Google sign-in failed.";

    window.location.replace(
      `/login?error=${encodeURIComponent(
        message,
      )}`,
    );
  } finally {
    handlingOAuth = false;
  }
}

export async function initializeNativeAuth() {
  /*
   * Web OAuth is handled by /auth/callback.
   */
  if (!isNativeApp()) {
    return;
  }

  /*
   * Only register one native deep-link listener.
   */
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

  /*
   * Also handle the case where StockPulse was completely
   * closed when the OAuth/reset-password deep link opened it.
   */
  const launchData =
    await App.getLaunchUrl();

  if (launchData?.url) {
    await handleNativeUrl(
      launchData.url,
    );
  }
}
