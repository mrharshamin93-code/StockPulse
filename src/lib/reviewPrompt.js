import { Capacitor, registerPlugin } from "@capacitor/core";

const InAppReview = registerPlugin("InAppReview");

const STORAGE_KEY = "stockpulse:review-engagement:v1";
const MIN_SESSIONS = 10;
const MIN_ACTIVE_DAYS = 4;
const SESSION_GAP_MS = 20 * 60 * 1000;
const REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

function getLocalDayKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readState() {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return {
      sessions: Number(parsed?.sessions) || 0,
      activeDays: Array.isArray(parsed?.activeDays) ? parsed.activeDays : [],
      lastSessionAt: Number(parsed?.lastSessionAt) || 0,
      lastReviewRequestAt: Number(parsed?.lastReviewRequestAt) || 0,
    };
  } catch {
    return {
      sessions: 0,
      activeDays: [],
      lastSessionAt: 0,
      lastReviewRequestAt: 0,
    };
  }
}

function writeState(state) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Engagement tracking should never interfere with normal app use.
  }
}

function isEligibleForReview(state, now) {
  const cooldownComplete =
    !state.lastReviewRequestAt ||
    now - state.lastReviewRequestAt >= REVIEW_COOLDOWN_MS;

  return (
    state.sessions >= MIN_SESSIONS &&
    state.activeDays.length >= MIN_ACTIVE_DAYS &&
    cooldownComplete
  );
}

export async function recordReviewSession() {
  if (
    !Capacitor.isNativePlatform() ||
    Capacitor.getPlatform() !== "ios" ||
    typeof window === "undefined"
  ) {
    return false;
  }

  const now = Date.now();
  const state = readState();
  if (!state) return false;

  if (state.lastSessionAt && now - state.lastSessionAt < SESSION_GAP_MS) {
    return false;
  }

  const today = getLocalDayKey(now);
  const activeDays = Array.from(new Set([...state.activeDays, today])).slice(-365);
  const nextState = {
    ...state,
    sessions: state.sessions + 1,
    activeDays,
    lastSessionAt: now,
  };

  writeState(nextState);

  if (!isEligibleForReview(nextState, now)) {
    return false;
  }

  try {
    await InAppReview.requestReview();

    writeState({
      sessions: 0,
      activeDays: [],
      lastSessionAt: now,
      lastReviewRequestAt: now,
    });

    return true;
  } catch (error) {
    console.warn("Unable to request App Store review:", error);
    return false;
  }
}
