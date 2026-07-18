import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate, useLocation } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import Onboarding from '@/pages/Onboarding';
import StockDetail from '@/pages/StockDetail';
import Analysis from '@/pages/Analysis';
import Watchlist from '@/pages/Watchlist';
import Screener from '@/pages/Screener';
import Settings from '@/pages/Settings';
import PriceAlerts from '@/pages/PriceAlerts';
import ThemeSettings from '@/pages/ThemeSettings';
import CurrencySettings from '@/pages/CurrencySettings';
import Legal from '@/pages/Legal';
import ScreenerResults from '@/pages/ScreenerResults';
import MonthlyReport from '@/pages/MonthlyReport';
import ReferralPage from '@/pages/ReferralPage';
import ContactUs from '@/pages/ContactUs';
import NavigationLayout from '@/components/NavigationLayout';
import { MarketDataProvider } from '@/lib/MarketDataContext';
import AuthCallback from '@/pages/auth/callback';   // ← Added

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />   {/* ← Added */}

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<NavigationLayout />}>
          <Route path="/" element={<Watchlist />} />
          <Route path="/home" element={<Home />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/price-alerts" element={<PriceAlerts />} />
          <Route path="/theme" element={<ThemeSettings />} />
          <Route path="/currency" element={<CurrencySettings />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/screener/results" element={<ScreenerResults />} />
          <Route path="/monthly-report" element={<MonthlyReport />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/stock/:id" element={<StockDetail />} />
        </Route>
      </Route>

      <Route path="/PriceAlerts" element={<Navigate to="/price-alerts" replace />} />
      <Route path="/price_alerts" element={<Navigate to="/price-alerts" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <MarketDataProvider>
            <ScrollToTop />
            <AuthenticatedApp />
          </MarketDataProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
