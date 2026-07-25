import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { supabase } from "@/lib/supabase";

export const IOS_AUTH_CALLBACK =
  "com.stockpulse.app://auth/callback";

export const IOS_CONFIRM_EMAIL_URL =
  "com.stockpulse.app://auth/confirm";

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

export function getEmailConfirmationUrl() {
  if (isNativeApp()) {
    return IOS_CONFIRM_EMAIL_URL;
  }

  return `${window.location.origin}/auth/confirm`;
}

export async function signInWithGoogle() {
  const native = isNativeApp();

  const {
    data,
    error,
  } = await supabase.auth.signInWithOAuth({
    provider: "google",

    options: {
      redirectTo:
        getAuthCallbackUrl(),

      skipBrowserRedirect:
        native,
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

function decodeError(
  rawValue,
) {
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

function getUrlParts(
  incomingUrl,
) {
  const parsed =
    new URL(incomingUrl);

  return {
    search:
      parsed.search || "",

    hash:
      parsed.hash || "",
  };
}

let nativeAuthListener = null;
let handlingOAuth = false;
let lastHandledUrl = "";

async function handleNativeUrl(
  url,
) {
  if (!url) {
    return;
  }

  /*
   * Prevent the same cold-start URL from being
   * handled by both getLaunchUrl() and appUrlOpen.
   */
  if (url === lastHandledUrl) {
    return;
  }

  lastHandledUrl = url;

  if (
    url.startsWith(
      IOS_RESET_PASSWORD_URL,
    )
  ) {
    const {
      search,
      hash,
    } =
      getUrlParts(url);

    window.location.replace(
      `/reset-password${search}${hash}`,
    );

    return;
  }

  if (
    url.startsWith(
      IOS_CONFIRM_EMAIL_URL,
    )
  ) {
    const {
      search,
      hash,
    } =
      getUrlParts(url);

    window.location.replace(
      `/auth/confirm${search}${hash}`,
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

    const code =
      callbackUrl.searchParams.get(
        "code",
      );

    if (!code) {
      throw new Error(
        "No authentication code was returned.",
      );
    }

    const {
      data,
      error,
    } =
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

    window.location.replace(
      "/",
    );
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
        await handleNativeUrl(
          url,
        );
      },
    );

  /*
   * appUrlOpen handles links received while
   * StockPulse is running.
   *
   * getLaunchUrl handles the case where the
   * app was completely closed when the user
   * tapped the email/OAuth link.
   */
  const launchData =
    await App.getLaunchUrl();

  if (launchData?.url) {
    await handleNativeUrl(
      launchData.url,
    );
  }
}
