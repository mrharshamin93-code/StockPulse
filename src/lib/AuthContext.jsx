import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "./supabase";

const AuthContext = createContext(null);

function areUsersEqual(currentUser, nextUser) {
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [
    isLoadingAuth,
    setIsLoadingAuth,
  ] = useState(true);

  const [
    authError,
    setAuthError,
  ] = useState(null);

  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    function finishInitialization() {
      if (initializationComplete) {
        return;
      }

      initializationComplete = true;
      setIsLoadingAuth(false);
    }

    function applySession(session) {
      const nextUser =
        session?.user ?? null;

      setUser((currentUser) => {
        if (
          areUsersEqual(
            currentUser,
            nextUser
          )
        ) {
          return currentUser;
        }

        return nextUser;
      });

      setAuthError(null);
    }

    /*
     * The current Supabase client automatically processes
     * the OAuth code because detectSessionInUrl is enabled.
     *
     * INITIAL_SESSION fires after that initialization has
     * completed. Keep this callback synchronous.
     */
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
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
        }
      );

    /*
     * Never leave the application on an infinite loading
     * screen if browser storage or initialization fails.
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
            "Authentication initialization timed out."
          );

        console.error(
          "Supabase auth initialization timed out:",
          timeoutError
        );

        initializationComplete = true;
        setAuthError(timeoutError);
        setIsLoadingAuth(false);
      }, 15000);

    return () => {
      mounted = false;

      window.clearTimeout(
        timeoutId
      );

      subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(
    async () => {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      user,

      isAuthenticated:
        Boolean(user),

      isLoadingAuth,

      authError,

      logout,

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
    ]
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
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}
