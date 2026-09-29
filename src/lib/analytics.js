import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/lib/supabase";

const SESSION_STORAGE_KEY = "stockpulse:analytics-session:v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

let appInfoPromise = null;

function makeSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `sp-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function readSessionState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      SESSION_STORAGE_KEY,
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      !Number.isFinite(
        Number(parsed.lastActivityAt),
      )
    ) {
      return null;
    }

    return {
      id: parsed.id,
      startedAt: Number(
        parsed.startedAt ||
          parsed.lastActivityAt,
      ),
      lastActivityAt: Number(
        parsed.lastActivityAt,
      ),
    };
  } catch {
    return null;
  }
}

function writeSessionState(state) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Analytics must never block app usage.
  }
}

function clearSessionState(
  expectedSessionId,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current =
      readSessionState();

    if (
      !expectedSessionId ||
      current?.id ===
        expectedSessionId
    ) {
      window.localStorage.removeItem(
        SESSION_STORAGE_KEY,
      );
    }
  } catch {
    // Analytics must never block app usage.
  }
}

function ensureSession() {
  const now = Date.now();
  const current =
    readSessionState();

  const expired =
    !current ||
    now - current.lastActivityAt >
      SESSION_TIMEOUT_MS;

  const next = expired
    ? {
        id: makeSessionId(),
        startedAt: now,
        lastActivityAt: now,
      }
    : {
        ...current,
        lastActivityAt: now,
      };

  writeSessionState(next);

  return {
    sessionId: next.id,
    isNewSession: expired,
  };
}

async function getRuntimeMetadata() {
  if (!appInfoPromise) {
    appInfoPromise =
      (async () => {
        const platform =
          Capacitor.getPlatform();

        let appVersion =
          import.meta.env
            .VITE_APP_VERSION ||
          null;
        let appBuild = null;

        if (
          Capacitor.isNativePlatform()
        ) {
          try {
            const info =
              await CapacitorApp.getInfo();

            appVersion =
              info?.version ||
              appVersion;
            appBuild =
              info?.build || null;
          } catch {
            // Version metadata is optional.
          }
        }

        return {
          platform,
          appVersion,
          appBuild,
        };
      })();
  }

  return appInfoPromise;
}

function cleanProperties(properties) {
  if (
    !properties ||
    typeof properties !==
      "object" ||
    Array.isArray(properties)
  ) {
    return {};
  }

  return properties;
}

export async function trackEvent(
  eventName,
  properties = {},
) {
  const normalizedEventName =
    String(eventName || "")
      .trim()
      .slice(0, 80);

  if (!normalizedEventName) {
    return false;
  }

  try {
    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      return false;
    }

    const userId =
      sessionData?.session?.user?.id;

    if (!userId) {
      return false;
    }

    const {
      sessionId,
      isNewSession,
    } = ensureSession();

    const {
      platform,
      appVersion,
      appBuild,
    } = await getRuntimeMetadata();

    const route =
      typeof window !== "undefined"
        ? window.location.pathname
        : null;

    const common = {
      user_id: userId,
      session_id: sessionId,
      route,
      platform,
      app_version: appVersion,
    };

    const rows = [];

    if (
      isNewSession &&
      normalizedEventName !==
        "session_start"
    ) {
      rows.push({
        ...common,
        event_name:
          "session_start",
        properties: {
          app_build: appBuild,
        },
      });
    }

    rows.push({
      ...common,
      event_name:
        normalizedEventName,
      properties: {
        ...cleanProperties(
          properties,
        ),
        app_build: appBuild,
      },
    });

    const { error } =
      await supabase
        .from(
          "analytics_events",
        )
        .insert(rows);

    if (error) {
      if (isNewSession) {
        clearSessionState(
          sessionId,
        );
      }

      console.warn(
        "Analytics event was not recorded:",
        error.message,
      );

      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "Analytics event was not recorded:",
      error,
    );

    return false;
  }
}
