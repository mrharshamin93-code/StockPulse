import React from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/AuthContext";

export default function ProtectedRoute({
  unauthenticatedElement,
}) {
  const {
    isAuthenticated,
    isLoadingAuth,
  } = useAuth();

  const location =
    useLocation();

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      unauthenticatedElement ?? (
        <Navigate
          to="/login"
          replace
          state={{
            from:
              location.pathname +
              location.search,
          }}
        />
      )
    );
  }

  return <Outlet />;
}
