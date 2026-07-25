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
        skipBrowserRedirect: native,
      },
    });

  if (error) {
    throw error;
  }

  if (native) {
    if (!data?.url) {
      throw new Error(
        "Google sign-in could not be started.",
      );
    }

    await Browser.open({
      url: data.url,
    });
  }
}

function getNativePath(url) {
  if (!url) {
    return null;
  }

  if (
    url.startsWith(
      IOS_RESET_PASSWORD_URL,
    )
  ) {
    const incomingUrl =
      new URL(url);

    return {
      type: "reset-password",
      search:
        incomingUrl.search || "",
      hash:
        incomingUrl.hash || "",
    };
  }

  if (
    url.startsWith(
      IOS_AUTH_CALLBACK,
    )
  ) {
    return {
      type: "auth-callback",
      url,
    };
  }

  return null;
}

let nativeAuthListener = null;
let handlingNativeCallback = false;

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
        const nativePath =
          getNativePath(url);

        if (!nativePath) {
          return;
        }

        if (
          nativePath.type ===
          "reset-password"
        ) {
          window.location.replace(
            `/reset-password${nativePath.search}${nativePath.hash}`,
          );

          return;
        }

        if (handlingNativeCallback) {
          return;
        }

        handlingNativeCallback = true;

        try {
          await Browser.close().catch(
            () => {},
          );

          const callbackUrl =
            new URL(
              nativePath.url,
            );

          const errorDescription =
            callbackUrl.searchParams.get(
              "error_description",
            ) ||
            callbackUrl.searchParams.get(
              "error",
            );

          if (errorDescription) {
            throw new Error(
              decodeURIComponent(
                errorDescription,
              ),
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

          if (!data?.session) {
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
          handlingNativeCallback = false;
        }
      },
    );
}
