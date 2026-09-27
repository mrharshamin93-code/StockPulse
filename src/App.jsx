import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { MarketDataProvider } from "@/lib/MarketDataContext";
import { recordReviewSession } from "@/lib/reviewPrompt";
import { supabase } from "@/lib/supabase";
import { getMonthlyProduct, hasActiveStockPulseSubscription, purchaseStockPulsePro, restoreStockPulsePurchases } from "@/lib/subscription";
import { applyTheme } from "@/components/settings/ThemeSection.jsx";
import PremiumGate from "@/components/PremiumGate";
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

const PUBLIC_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback", "/privacy", "/terms", "/legal", "/contact-us"]);

function ThemeSync() {
  const { preferences } = useAuth();
  useEffect(() => { applyTheme(preferences?.theme || "default"); }, [preferences?.theme]);
  return null;
}

function ReviewPromptTracker() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return undefined;
    let disposed = false, listenerHandle = null, reviewTimer = null;
    const scheduleSessionCheck = () => {
      if (reviewTimer) clearTimeout(reviewTimer);
      reviewTimer = window.setTimeout(() => { if (!disposed) recordReviewSession(); }, 4000);
    };
    scheduleSessionCheck();
    CapacitorApp.addListener("appStateChange", ({ isActive }) => { if (isActive) scheduleSessionCheck(); }).then((handle) => { if (disposed) handle.remove(); else listenerHandle = handle; }).catch(() => {});
    return () => { disposed = true; if (reviewTimer) clearTimeout(reviewTimer); listenerHandle?.remove(); };
  }, [user?.id]);
  return null;
}

function SubscriptionGate({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, allowed: false, price: "$4.99", processing: false });

  const checkAccess = async () => {
    if (!user?.id) { setState((s) => ({ ...s, loading: false, allowed: true })); return; }
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data: profile, error } = await supabase.from("profiles").select("grandfathered_free, access_tier").eq("id", user.id).maybeSingle();
      if (error) throw error;
      const grandfathered = profile?.grandfathered_free === true;
      const serverPremium = profile?.access_tier === "premium";
      let storeActive = false;
      let price = "$4.99";
      if (!grandfathered && !serverPremium) {
        try {
          const [active, product] = await Promise.all([hasActiveStockPulseSubscription(), getMonthlyProduct()]);
          storeActive = active;
          price = product?.priceString || product?.displayPrice || price;
        } catch (storeError) {
          console.error("Unable to check App Store subscription:", storeError);
        }
      }
      setState((s) => ({ ...s, loading: false, allowed: grandfathered || serverPremium || storeActive, price }));
    } catch (error) {
      console.error("Unable to determine StockPulse access:", error);
      setState((s) => ({ ...s, loading: false, allowed: false }));
    }
  };

  useEffect(() => { void checkAccess(); }, [user?.id]);

  const subscribe = async () => {
    setState((s) => ({ ...s, processing: true }));
    try { await purchaseStockPulsePro(); await checkAccess(); }
    catch (error) { console.error("StockPulse Pro purchase failed:", error); alert(error?.message || "The purchase could not be completed."); }
    finally { setState((s) => ({ ...s, processing: false })); }
  };

  const restore = async () => {
    setState((s) => ({ ...s, processing: true }));
    try {
      const restored = await restoreStockPulsePurchases();
      if (!restored) alert("No active StockPulse Pro subscription was found.");
      await checkAccess();
    } catch (error) { console.error("Restore purchases failed:", error); alert(error?.message || "Purchases could not be restored."); }
    finally { setState((s) => ({ ...s, processing: false })); }
  };

  if (state.loading) return <div className="fixed inset-0 flex items-center justify-center">Loading...</div>;
  if (!state.allowed) return <PremiumGate onSubscribe={subscribe} onRestore={restore} isProcessing={state.processing} price={state.price} />;
  return children;
}

function AuthenticatedApp() {
  const { isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();
  const isPublicPath = PUBLIC_PATHS.has(location.pathname);
  if (isLoadingPublicSettings && !isPublicPath) return <div className="fixed inset-0 flex items-center justify-center">Loading...</div>;
  if (authError?.type === "user_not_registered" && !isPublicPath) return <UserNotRegisteredError />;

  return <Routes location={location}>
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/privacy" element={<Legal page="privacy" />} /><Route path="/terms" element={<Legal page="terms" />} /><Route path="/legal" element={<Legal />} /><Route path="/contact-us" element={<ContactUs />} />
    <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
      <Route element={<SubscriptionGate><NavigationLayout /></SubscriptionGate>}>
        <Route path="/" element={<Navigate to="/watchlist" replace />} /><Route path="/home" element={<Home />} /><Route path="/watchlist" element={<Watchlist />} /><Route path="/onboarding" element={<Onboarding />} /><Route path="/stock/:ticker" element={<StockDetail />} /><Route path="/analysis" element={<Analysis />} /><Route path="/analysis/:ticker" element={<Analysis />} /><Route path="/screener" element={<Screener />} /><Route path="/screener/results" element={<ScreenerResults />} /><Route path="/settings" element={<Settings />} /><Route path="/settings/theme" element={<ThemeSettings />} /><Route path="/settings/currency" element={<CurrencySettings />} /><Route path="/price-alerts" element={<PriceAlerts />} /><Route path="/monthly-report" element={<MonthlyReport />} /><Route path="/referrals" element={<ReferralPage />} />
      </Route>
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>;
}

export default function App() {
  return <AuthProvider><ThemeSync /><ReviewPromptTracker /><QueryClientProvider client={queryClientInstance}><Router><MarketDataProvider><ScrollToTop /><AuthenticatedApp /></MarketDataProvider></Router><Toaster /></QueryClientProvider></AuthProvider>;
}
