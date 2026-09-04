import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { supabase } from "@/lib/supabase";

const APP_ID = "com.harshamin.stockpulse";
const APNS_ENVIRONMENT = import.meta.env.DEV ? "sandbox" : "production";

let initializationPromise = null;
let registeredToken = null;
let currentUserId = null;

function safeInternalRoute(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

function openNotificationRoute(notification) {
  const route = safeInternalRoute(notification?.data?.route);
  if (!route) return;

  window.history.pushState({}, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function saveToken(token, userId = currentUserId) {
  if (!token || !userId) return;

  const now = new Date().toISOString();
  const { error } = await supabase.from("push_devices").upsert(
    {
      user_id: userId,
      token,
      platform: "ios",
      environment: APNS_ENVIRONMENT,
      app_id: APP_ID,
      enabled: true,
      last_registered_at: now,
      last_error: null,
      invalidated_at: null,
      updated_at: now,
    },
    { onConflict: "token" },
  );

  if (error) throw error;
}

async function registerWithApple() {
  const status = await PushNotifications.checkPermissions();
  let permission = status.receive;

  if (permission === "prompt") {
    permission = (await PushNotifications.requestPermissions()).receive;
  }

  if (permission === "granted") await PushNotifications.register();
}

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    currentUserId = (await supabase.auth.getSession()).data.session?.user?.id || null;

    await PushNotifications.addListener("registration", async ({ value }) => {
      registeredToken = value;
      try {
        await saveToken(value);
      } catch (error) {
        console.error("Could not save push notification token:", error);
      }
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Native push registration failed:", error);
    });

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      ({ notification }) => openNotificationRoute(notification),
    );

    supabase.auth.onAuthStateChange(async (event, session) => {
      currentUserId = session?.user?.id || null;

      if (event === "SIGNED_IN" && currentUserId) {
        if (registeredToken) await saveToken(registeredToken);
        else await registerWithApple();
      }
    });

    if (currentUserId) await registerWithApple();
  })();

  return initializationPromise;
}

export async function unregisterPushDevice() {
  if (!Capacitor.isNativePlatform() || !registeredToken || !currentUserId) return;

  const { error } = await supabase
    .from("push_devices")
    .delete()
    .eq("user_id", currentUserId)
    .eq("token", registeredToken);

  if (error) throw error;
}
