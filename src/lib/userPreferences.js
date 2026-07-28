export const DEFAULT_USER_PREFERENCES = {
  theme: "default",
  currency: "USD",
  watchlist_sort: "percentage",
};

export const VALID_THEME_IDS = [
  "default",
  "blue",
  "green",
  "purple",
  "rose",
  "orange",
];

export const VALID_CURRENCIES = [
  "USD",
  "CAD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CHF",
  "INR",
  "CNY",
  "BRL",
  "MXN",
  "KRW",
  "SGD",
  "HKD",
  "NOK",
  "SEK",
  "NZD",
];

export const VALID_WATCHLIST_SORT_MODES = [
  "percentage",
  "price",
];

export function normalizeTheme(value) {
  return VALID_THEME_IDS.includes(value)
    ? value
    : DEFAULT_USER_PREFERENCES.theme;
}

export function normalizeCurrency(value) {
  return VALID_CURRENCIES.includes(value)
    ? value
    : DEFAULT_USER_PREFERENCES.currency;
}

export function normalizeWatchlistSort(value) {
  return VALID_WATCHLIST_SORT_MODES.includes(
    value,
  )
    ? value
    : DEFAULT_USER_PREFERENCES.watchlist_sort;
}

export function normalizeUserPreferences(
  profile,
) {
  return {
    theme: normalizeTheme(
      profile?.theme,
    ),

    currency: normalizeCurrency(
      profile?.currency,
    ),

    watchlist_sort:
      normalizeWatchlistSort(
        profile?.watchlist_sort,
      ),
  };
}

function getUserPreferenceKey(
  userId,
  preference,
) {
  if (!userId || !preference) {
    return "";
  }

  return `stockpulse:user:${userId}:${preference}`;
}

export function getCachedUserPreference(
  userId,
  preference,
  fallback,
) {
  const key =
    getUserPreferenceKey(
      userId,
      preference,
    );

  if (!key) {
    return fallback;
  }

  try {
    const value =
      window.localStorage.getItem(
        key,
      );

    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function setCachedUserPreference(
  userId,
  preference,
  value,
) {
  const key =
    getUserPreferenceKey(
      userId,
      preference,
    );

  if (!key) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      String(value),
    );
  } catch {
    // Supabase remains the main source of truth.
  }
}

export function removeLegacySharedPreferences() {
  try {
    /*
     * These old keys were shared by every account using
     * the same browser/device.
     */
    window.localStorage.removeItem(
      "stockpulse-theme",
    );

    window.localStorage.removeItem(
      "currency",
    );

    window.localStorage.removeItem(
      "stockpulse:watchlist-sort",
    );
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function cacheUserPreferences(
  userId,
  preferences,
) {
  if (!userId) {
    return;
  }

  const normalized =
    normalizeUserPreferences(
      preferences,
    );

  setCachedUserPreference(
    userId,
    "theme",
    normalized.theme,
  );

  setCachedUserPreference(
    userId,
    "currency",
    normalized.currency,
  );

  setCachedUserPreference(
    userId,
    "watchlist_sort",
    normalized.watchlist_sort,
  );
}

export function getCachedUserPreferences(
  userId,
) {
  return {
    theme: normalizeTheme(
      getCachedUserPreference(
        userId,
        "theme",
        DEFAULT_USER_PREFERENCES.theme,
      ),
    ),

    currency: normalizeCurrency(
      getCachedUserPreference(
        userId,
        "currency",
        DEFAULT_USER_PREFERENCES.currency,
      ),
    ),

    watchlist_sort:
      normalizeWatchlistSort(
        getCachedUserPreference(
          userId,
          "watchlist_sort",
          DEFAULT_USER_PREFERENCES.watchlist_sort,
        ),
      ),
  };
}
