import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { queryClientInstance } from "@/lib/query-client";
import {
  AuthProvider,
  useAuth,
} from "@/lib/AuthContext";
import { MarketDataProvider } from "@/lib/MarketDataContext";

import { applyTheme } from "@/components/settings/ThemeSection.jsx";

import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";

import ProtectedRoute from "@/components/ProtectedRoute";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import NavigationLayout from "@/components/NavigationLayout";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuthCallback from "@/pages/auth/callback";

import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";
import StockDetail from "@/pages/StockDetail";
import Analysis from "@/pages/Analysis";
import Watchlist from "@/pages/Watchlist";
import Screener from "@/pages/Screener";
import ScreenerResults from "@/pages/ScreenerResults";
import Settings from "@/pages/Settings";
import PriceAlerts from "@/pages/PriceAlerts";
import ThemeSettings from "@/pages/ThemeSettings";
import CurrencySettings from "@/pages/CurrencySettings";
import Legal from "@/pages/Legal";
import MonthlyReport from "@/pages/MonthlyReport";
import ReferralPage from "@/pages/ReferralPage";
import ContactUs from "@/pages/ContactUs";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/legal",
  "/contact-us",
]);

/*
 * Keeps the active theme synchronized everywhere in the app.
 *
 * Previously, ThemeSection was the only component applying the saved
 * preference. That meant the saved theme did not return until the user
 * visited the Settings page and mounted ThemeSection.
 */
function ThemeSync() {
  const { preferences } = useAuth();

  useEffect(() => {
    applyTheme(
      preferences?.theme || "default",
    );
  }, [preferences?.theme]);

  return null;
}

function AuthenticatedApp() {
  const {
    isLoadingPublicSettings,
    authError,
  } = useAuth();

  const location =
    useLocation();

  const isPublicPath =
    PUBLIC_PATHS.has(
      location.pathname,
    );

  if (
    isLoadingPublicSettings &&
    !isPublicPath
  ) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (
    authError?.type ===
      "user_not_registered" &&
    !isPublicPath
  ) {
    return (
      <UserNotRegisteredError />
    );
  }

  return (
    <Routes location={location}>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/forgot-password"
        element={
          <ForgotPassword />
        }
      />

      <Route
        path="/reset-password"
        element={
          <ResetPassword />
        }
      />

      <Route
        path="/auth/callback"
        element={
          <AuthCallback />
        }
      />

      <Route
        path="/privacy"
        element={
          <Legal page="privacy" />
        }
      />

      <Route
        path="/terms"
        element={
          <Legal page="terms" />
        }
      />

      <Route
        path="/legal"
        element={<Legal />}
      />

      <Route
        path="/contact-us"
        element={
          <ContactUs />
        }
      />

      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={
              <Navigate
                to="/login"
                replace
              />
            }
          />
        }
      >
        <Route
          element={
            <NavigationLayout />
          }
        >
          <Route
            path="/"
            element={
              <Navigate
                to="/watchlist"
                replace
              />
            }
          />

          <Route
            path="/home"
            element={<Home />}
          />

          <Route
            path="/watchlist"
            element={<Watchlist />}
          />

          <Route
            path="/onboarding"
            element={<Onboarding />}
          />

          <Route
            path="/stock/:ticker"
            element={<StockDetail />}
          />

          <Route
            path="/analysis"
            element={<Analysis />}
          />

          <Route
            path="/analysis/:ticker"
            element={<Analysis />}
          />

          <Route
            path="/screener"
            element={<Screener />}
          />

          <Route
            path="/screener/results"
            element={
              <ScreenerResults />
            }
          />

          <Route
            path="/settings"
            element={<Settings />}
          />

          <Route
            path="/settings/theme"
            element={
              <ThemeSettings />
            }
          />

          <Route
            path="/settings/currency"
            element={
              <CurrencySettings />
            }
          />

          <Route
            path="/price-alerts"
            element={
              <PriceAlerts />
            }
          />

          <Route
            path="/monthly-report"
            element={
              <MonthlyReport />
            }
          />

          <Route
            path="/referrals"
            element={
              <ReferralPage />
            }
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={<PageNotFound />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeSync />

      <QueryClientProvider
        client={
          queryClientInstance
        }
      >
        <Router>
          <MarketDataProvider>
            <ScrollToTop />

            <AuthenticatedApp />
          </MarketDataProvider>
        </Router>

        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
