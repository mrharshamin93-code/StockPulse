import { Capacitor } from "@capacitor/core";
import { App } from "@c:contentReference[oaicite:0]{index=0}apacitor/browser";

import { supabase } from "@/lib/supabase";

export const IOS_AUTH_CALLBACK =
  "com.stockpulse.app://auth/callback";

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

  const {
    data,
    error,
  } = await supabase.auth.signInWithOAuth({
    provider: "google",

    options: {
      redirectTo: getAuthCallbackUrl(),

      /*
       * Web:
       * Supabase redirects the current browser automatically.
       *
       * iOS:
       * We need the OAuth URL so Capacitor can open
       * the system browser ourselves.
       */
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
        if (
          !url ||
          !url.startsWith(
            IOS_AUTH_CALLBACK,
          )
        ) {
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
            new URL(url);

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

          /*
           * The Capacitor WebView is still sitting on the
           * Login/Register page. Move it into the signed-in app.
           */
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
