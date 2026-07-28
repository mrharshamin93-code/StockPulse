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

function areUsersEqual(
  currentUser,
  nextUser,
) {
  if (!currentUser && !nextUser) {
    return true;
  }

  if (!currentUser || !nextUser) {
    return false;
  }

  return (
    currentUser.id === nextUser.id &&
    currentUser.email === nextUser.email
  );
}

function normalizePreferenceValue(
  preference,
  value,
) {
  switch (preference) {
    case "theme":
      return normalizeTheme(value);

    case "currency":
      return normalizeCurrency(value);

    case "watchlist_sort":
      return normalizeWatchlistSort(
        value,
      );

    default:
      return value;
  }
}

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(null);

  const [
    isLoadingAuth,
    setIsLoadingAuth,
  ] = useState(true);

  const [
    authError,
    setAuthError,
  ] = useState(null);

  const [
    preferences,
    setPreferences,
  ] = useState(
    DEFAULT_USER_PREFERENCES,
  );

  const [
    isLoadingPreferences,
    setIsLoadingPreferences,
  ] = useState(true);

  const [
    preferencesError,
    setPreferencesError,
  ] = useState(null);

  const currentUserIdRef =
    useRef(null);

  /*
   * Load the signed-in user's settings from
   * public.profiles.
   *
   * Supabase is the cross-device source of truth.
   * User-scoped localStorage is only used as a fast cache.
   */
  const loadUserPreferences =
    useCallback(async (userId) => {
      if (!userId) {
        setPreferences(
          DEFAULT_USER_PREFERENCES,
        );

        setPreferencesError(null);
        setIsLoadingPreferences(false);

        return DEFAULT_USER_PREFERENCES;
      }

      setIsLoadingPreferences(true);
      setPreferencesError(null);

      /*
       * Apply the account-specific cached values immediately
       * while Supabase loads.
       */
      const cached =
        getCachedUserPreferences(
          userId,
        );

      setPreferences(cached);

      try {
        const {
          data,
          error,
        } = await supabase
          .from("profiles")
          .select(
            `
              id,
              theme,
              currency,
              watchlist_sort,
              monthly_report_opt_in,
              report_timezone,
              report_currency
            `,
          )
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        /*
         * Existing legacy users may not have a profiles row.
         * Create one safely using the defaults.
         */
        if (!data) {
          const {
            data: createdProfile,
            error: createError,
          } = await supabase
            .from("profiles")
            .upsert(
              {
                id: userId,

                email:
                  user?.email || null,

                full_name:
                  user?.user_metadata
                    ?.full_name ||
                  user?.user_metadata
                    ?.name ||
                  "",

                theme:
                  DEFAULT_USER_PREFERENCES
                    .theme,

                currency:
                  DEFAULT_USER_PREFERENCES
                    .currency,

                watchlist_sort:
                  DEFAULT_USER_PREFERENCES
                    .watchlist_sort,
              },
              {
                onConflict: "id",
              },
            )
            .select(
              `
                id,
                theme,
                currency,
                watchlist_sort,
                monthly_report_opt_in,
                report_timezone,
                report_currency
              `,
            )
            .single();

          if (createError) {
            throw createError;
          }

          const normalized =
            normalizeUserPreferences(
              createdProfile,
            );

          if (
            currentUserIdRef.current ===
            userId
          ) {
            setPreferences(
              normalized,
            );

            cacheUserPreferences(
              userId,
              normalized,
            );
          }

          return normalized;
        }

        const normalized =
          normalizeUserPreferences(
            data,
          );

        if (
          currentUserIdRef.current ===
          userId
        ) {
          setPreferences(
            normalized,
          );

          cacheUserPreferences(
            userId,
            normalized,
          );
        }

        return normalized;
      } catch (error) {
        console.error(
          "Unable to load user preferences:",
          error,
        );

        if (
          currentUserIdRef.current ===
          userId
        ) {
          setPreferencesError(error);

          /*
           * Keep using the account-specific cache rather
           * than another user's shared preference.
           */
          setPreferences(cached);
        }

        return cached;
      } finally {
        if (
          currentUserIdRef.current ===
          userId
        ) {
          setIsLoadingPreferences(
            false,
          );
        }
      }
    }, [
      user?.email,
      user?.user_metadata,
    ]);

  /*
   * Update one account-specific preference.
   *
   * The UI updates immediately, then Supabase is updated.
   * If Supabase fails, the previous value is restored.
   */
  const updatePreference =
    useCallback(
      async (
        preference,
        value,
      ) => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to update settings.",
          );
        }

        const normalizedValue =
          normalizePreferenceValue(
            preference,
            value,
          );

        const previousValue =
          preferences[
            preference
          ];

        setPreferences(
          (current) => ({
            ...current,
            [preference]:
              normalizedValue,
          }),
        );

        setCachedUserPreference(
          user.id,
          preference,
          normalizedValue,
        );

        try {
          const { error } =
            await supabase
              .from("profiles")
              .update({
                [preference]:
                  normalizedValue,
              })
              .eq(
                "id",
                user.id,
              );

          if (error) {
            throw error;
          }

          setPreferencesError(null);

          return normalizedValue;
        } catch (error) {
          console.error(
            `Unable to update ${preference}:`,
            error,
          );

          setPreferences(
            (current) => ({
              ...current,
              [preference]:
                previousValue,
            }),
          );

          setCachedUserPreference(
            user.id,
            preference,
            previousValue,
          );

          setPreferencesError(error);

          throw error;
        }
      },
      [
        user?.id,
        preferences,
      ],
    );

  const refreshPreferences =
    useCallback(async () => {
      if (!user?.id) {
        return DEFAULT_USER_PREFERENCES;
      }

      return loadUserPreferences(
        user.id,
      );
    }, [
      user?.id,
      loadUserPreferences,
    ]);

  useEffect(() => {
    let mounted = true;

    let initializationComplete =
      false;

    function finishInitialization() {
      if (
        initializationComplete
      ) {
        return;
      }

      initializationComplete =
        true;

      setIsLoadingAuth(false);
    }

    function applySession(session) {
      const nextUser =
        session?.user ?? null;

      currentUserIdRef.current =
        nextUser?.id || null;

      setUser((currentUser) => {
        if (
          areUsersEqual(
            currentUser,
            nextUser,
          )
        ) {
          return currentUser;
        }

        return nextUser;
      });

      setAuthError(null);

      if (nextUser?.id) {
        /*
         * Remove old device-wide preference keys so they
         * can no longer affect another account.
         */
        removeLegacySharedPreferences();

        void loadUserPreferences(
          nextUser.id,
        );
      } else {
        setPreferences(
          DEFAULT_USER_PREFERENCES,
        );

        setPreferencesError(null);
        setIsLoadingPreferences(
          false,
        );
      }
    }

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (event, session) => {
            if (!mounted) {
              return;
            }

            switch (event) {
              case "INITIAL_SESSION":
              case "SIGNED_IN":
              case "TOKEN_REFRESHED":
              case "USER_UPDATED":
              case "PASSWORD_RECOVERY":
                applySession(
                  session,
                );

                finishInitialization();
                break;

              case "SIGNED_OUT":
                applySession(null);
                finishInitialization();
                break;

              default:
                break;
            }
          },
        );

    /*
     * Never leave the application on an infinite loading
     * screen if authentication initialization fails.
     */
    const timeoutId =
      window.setTimeout(() => {
        if (
          !mounted ||
          initializationComplete
        ) {
          return;
        }

        const timeoutError =
          new Error(
            "Authentication initialization timed out.",
          );

        console.error(
          "Supabase auth initialization timed out:",
          timeoutError,
        );

        initializationComplete =
          true;

        setAuthError(
          timeoutError,
        );

        setIsLoadingAuth(
          false,
        );

        setIsLoadingPreferences(
          false,
        );
      }, 15000);

    return () => {
      mounted = false;

      window.clearTimeout(
        timeoutId,
      );

      subscription.unsubscribe();
    };
  }, [loadUserPreferences]);

  const logout = useCallback(
    async () => {
      const { error } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }

      currentUserIdRef.current =
        null;

      setPreferences(
        DEFAULT_USER_PREFERENCES,
      );

      setPreferencesError(null);
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,

      isAuthenticated:
        Boolean(user),

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
      isLoadingPublicSettings:
        false,
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
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext,
    );

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider",
    );
  }

  return context;
}
