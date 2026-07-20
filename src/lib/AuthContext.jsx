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

function usersAreEqual(currentUser, nextUser) {
  if (!currentUser && !nextUser) {
    return true;
  }

  if (!currentUser || !nextUser) {
    return false;
  }

  return (
    currentUser.id === nextUser.id &&
    currentUser.email === nextUser.email &&
    currentUser.updated_at === nextUser.updated_at
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

  const applySession = useCallback(
    (session) => {
      const nextUser =
        session?.user ?? null;

      /*
       * Supabase can emit TOKEN_REFRESHED and
       * SIGNED_IN more than once. Avoid updating
       * the entire application when the user
       * object has not actually changed.
       */
      setUser((currentUser) => {
        if (
          usersAreEqual(
            currentUser,
            nextUser
          )
        ) {
          return currentUser;
        }

        return nextUser;
      });
    },
    []
  );

  useEffect(() => {
    let active = true;

    /*
     * Register the listener before reading the
     * initial session so an auth event cannot be
     * missed between mounting and getSession().
     *
     * Keep this callback synchronous. Do not await
     * other Supabase calls inside it.
     */
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!active) {
            return;
          }

          applySession(session);
          setAuthError(null);
          setIsLoadingAuth(false);
        }
      );

    async function initializeAuth() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (error) {
          throw error;
        }

        applySession(
          data?.session ?? null
        );

        setAuthError(null);
      } catch (error) {
        if (!active) {
          return;
        }

        console.error(
          "Auth initialization failed:",
          error
        );

        setUser(null);
        setAuthError(error);
      } finally {
        if (active) {
          setIsLoadingAuth(false);
        }
      }
    }

    initializeAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

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
       * Preserve the property expected by App.jsx.
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
