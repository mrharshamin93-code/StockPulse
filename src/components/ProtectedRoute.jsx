import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function ProtectedRoute({
  unauthenticatedElement,
}) {
  const {
    isAuthenticated,
    isLoadingAuth,
  } = useAuth();

  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      unauthenticatedElement ?? (
        <Navigate
          to="/login"
          state={{ from: location }}
          replace
        />
      )
    );
  }

  return <Outlet />;
}
