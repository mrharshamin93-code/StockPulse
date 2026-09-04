import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "./supabase";
import { unregisterPushDevice } from "./pushNotifications";

import {
  DEFAULT_USER_PREFERENCES,
  cacheUserPreferences,
  getCachedUserPreferences,
  normalizeCurrency,
  normalizeTheme,
  normalizeUserPreferences,
  normalizeWatchlistSort,
  removeLegacySharedPreferences,
  setCachedUserPreference,
} from "./userPreferences";

const AuthContext = createContext(null);

function areUsersEqual(currentUser, nextUser) {
  if (!currentUser && !nextUser) return true;
  if (!currentUser || !nextUser) return false;

  return (
    currentUser.id === nextUser.id &&
    currentUser.email === nextUser.email
  );
}

function normalizePreferenceValue(preference, value) {
  switch (preference) {
    case "theme":
      return normalizeTheme(value);
    case "currency":
      return normalizeCurrency(value);
    case "watchlist_sort":
      return normalizeWatchlistSort(value);
    default:
      return value;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [preferences, setPreferences] = useState(
    DEFAULT_USER_PREFERENCES,
  );
  const [isLoadingPreferences, setIsLoadingPreferences] =
    useState(true);
  const [preferencesError, setPreferencesError] = useState(null);

  const currentUserIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const preferenceRequestRef = useRef(0);

  const loadUserPreferences = useCallback(async (userId) => {
    const requestId = ++preferenceRequestRef.current;

    if (!userId) {
      setPreferences(DEFAULT_USER_PREFERENCES);
      setPreferencesError(null);
      setIsLoadingPreferences(false);
      return DEFAULT_USER_PREFERENCES;
    }

    setIsLoadingPreferences(true);
    setPreferencesError(null);

    const cached = getCachedUserPreferences(userId);
    setPreferences(cached);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          theme,
          currency,
          watchlist_sort,
          monthly_report_opt_in,
          report_timezone,
          report_currency
        `)
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      let profile = data;

      if (!profile) {
        const activeUser = currentUserRef.current;

        const { data: createdProfile, error: createError } =
          await supabase
            .from("profiles")
            .upsert(
              {
                id: userId,
                email: activeUser?.email || null,
                full_name:
                  activeUser?.user_metadata?.full_name ||
                  activeUser?.user_metadata?.name ||
                  "",
                theme: DEFAULT_USER_PREFERENCES.theme,
                currency: DEFAULT_USER_PREFERENCES.currency,
                watchlist_sort:
                  DEFAULT_USER_PREFERENCES.watchlist_sort,
              },
              {
                onConflict: "id",
              },
            )
            .select(`
              id,
              theme,
              currency,
              watchlist_sort,
              monthly_report_opt_in,
              report_timezone,
              report_currency
            `)
            .single();

        if (createError) throw createError;
        profile = createdProfile;
      }

      const normalized = normalizeUserPreferences(profile);

      if (
        currentUserIdRef.current === userId &&
        preferenceRequestRef.current === requestId
      ) {
        setPreferences(normalized);
        cacheUserPreferences(userId, normalized);
      }

      return normalized;
    } catch (error) {
      console.error("Unable to load user preferences:", error);

      if (
        currentUserIdRef.current === userId &&
        preferenceRequestRef.current === requestId
      ) {
        setPreferencesError(error);
        setPreferences(cached);
      }

      return cached;
    } finally {
      if (
        currentUserIdRef.current === userId &&
        preferenceRequestRef.current === requestId
      ) {
        setIsLoadingPreferences(false);
      }
    }
  }, []);

  const updatePreference = useCallback(
    async (preference, value) => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to update settings.",
        );
      }

      const normalizedValue = normalizePreferenceValue(
        preference,
        value,
      );
      const previousValue = preferences[preference];

      setPreferences((current) => ({
        ...current,
        [preference]: normalizedValue,
      }));

      setCachedUserPreference(
        user.id,
        preference,
        normalizedValue,
      );

      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            [preference]: normalizedValue,
          })
          .eq("id", user.id);

        if (error) throw error;

        setPreferencesError(null);
        return normalizedValue;
      } catch (error) {
        console.error(
          `Unable to update ${preference}:`,
          error,
        );

        setPreferences((current) => ({
          ...current,
          [preference]: previousValue,
        }));

        setCachedUserPreference(
          user.id,
          preference,
          previousValue,
        );

        setPreferencesError(error);
        throw error;
      }
    },
    [user?.id, preferences],
  );

  const refreshPreferences = useCallback(async () => {
    if (!user?.id) {
      return DEFAULT_USER_PREFERENCES;
    }

    return loadUserPreferences(user.id);
  }, [user?.id, loadUserPreferences]);

  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    function finishInitialization() {
      if (initializationComplete) return;
      initializationComplete = true;
      setIsLoadingAuth(false);
    }

    function applySession(session) {
      const nextUser = session?.user ?? null;
      const previousUserId = currentUserIdRef.current;
      const nextUserId = nextUser?.id || null;

      currentUserRef.current = nextUser;
      currentUserIdRef.current = nextUserId;

      setUser((currentUser) => {
        if (areUsersEqual(currentUser, nextUser)) {
          return currentUser;
        }

        return nextUser;
      });

      setAuthError(null);

      if (nextUserId && previousUserId !== nextUserId) {
        removeLegacySharedPreferences();
        void loadUserPreferences(nextUserId);
      } else if (!nextUserId) {
        preferenceRequestRef.current += 1;

        setPreferences(DEFAULT_USER_PREFERENCES);
        setPreferencesError(null);
        setIsLoadingPreferences(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      switch (event) {
        case "INITIAL_SESSION":
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
        case "USER_UPDATED":
        case "PASSWORD_RECOVERY":
          applySession(session);
          finishInitialization();
          break;

        case "SIGNED_OUT":
          applySession(null);
          finishInitialization();
          break;

        default:
          break;
      }
    });

    /*
     * Deterministic native-shell initialization. If the initial auth event is
     * delayed, getSession() still restores and confirms the persisted session.
     */
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted || initializationComplete) return;

        if (error) {
          throw error;
        }

        applySession(data?.session ?? null);
        finishInitialization();
      })
      .catch((error) => {
        if (!mounted || initializationComplete) return;

        console.error(
          "Unable to initialize Supabase auth:",
          error,
        );

        setAuthError(error);
        setIsLoadingPreferences(false);
        applySession(null);
        finishInitialization();
      });

    const timeoutId = window.setTimeout(() => {
      if (!mounted || initializationComplete) return;

      const timeoutError = new Error(
        "Authentication initialization timed out.",
      );

      console.error(
        "Supabase auth initialization timed out:",
        timeoutError,
      );

      setAuthError(timeoutError);
      setIsLoadingPreferences(false);
      applySession(null);
      finishInitialization();
    }, 15000);

    return () => {
      mounted = false;

      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadUserPreferences]);

  const logout = useCallback(async () => {
    try {
      await unregisterPushDevice();
    } catch (error) {
      console.error("Could not unregister this device before sign out:", error);
    }

    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    currentUserRef.current = null;
    currentUserIdRef.current = null;
    preferenceRequestRef.current += 1;

    setUser(null);
    setAuthError(null);
    setPreferences(DEFAULT_USER_PREFERENCES);
    setPreferencesError(null);
    setIsLoadingPreferences(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      authError,
      logout,
      preferences,
      isLoadingPreferences,
      preferencesError,
      updatePreference,
      refreshPreferences,

      /*
       * Kept because App.jsx currently expects it.
       */
      isLoadingPublicSettings: false,
    }),
    [
      user,
      isLoadingAuth,
      authError,
      logout,
      preferences,
      isLoadingPreferences,
      preferencesError,
      updatePreference,
      refreshPreferences,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider",
    );
  }

  return context;
}
