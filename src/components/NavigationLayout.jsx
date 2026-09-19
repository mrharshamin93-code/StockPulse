import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BriefcaseBusiness,
  Settings,
  SlidersHorizontal,
  Star,
  TrendingUp,
} from "lucide-react";

import AddStockDialog from "@/components/portfolio/AddStockDialog";
import PortfolioChartPreloader from "@/components/portfolio/PortfolioChartPreloader";

const tabs = [
  { label: "Watchlist", path: "/watchlist", icon: Star },
  { label: "Portfolio", path: "/home", icon: BriefcaseBusiness },
  { label: "Analysis", path: "/analysis", icon: TrendingUp },
  { label: "Screener", path: "/screener", icon: SlidersHorizontal },
  { label: "Settings", path: "/settings", icon: Settings },
];

const TAB_BAR_HEIGHT = 56;
const KEYBOARD_THRESHOLD = 120;

export default function NavigationLayout() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const layoutRef = useRef(null);
  const contentScrollRef = useRef(null);
  const scrollPositions = useRef({});
  const previousTab = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);

  const activeTab = (() => {
    if (pathname === "/" || pathname === "/watchlist" || pathname.startsWith("/stock/")) return "/watchlist";
    const root = `/${pathname.split("/")[1]}`;
    return tabs.some((tab) => tab.path === root) ? root : "/watchlist";
  })();

  const showTabs = !pathname.startsWith("/stock/");
  // Never render the tab bar while an editable control owns focus. This is
  // synchronous with the render path and avoids a one-frame iOS/WKWebView
  // viewport race where the keyboard can lift the fixed tab bar above itself.
  const activeElement =
    typeof document !== "undefined" ? document.activeElement : null;
  const editableFocused =
    ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement?.tagName) ||
    activeElement?.isContentEditable === true;
  const tabsVisible = showTabs && !keyboardOpen && !editableFocused;

  useEffect(() => {
    const visualViewport = window.visualViewport;

    const updateViewport = () => {
      const viewportHeight = visualViewport?.height || window.innerHeight;
      const fullHeight = window.innerHeight;
      const keyboardHeight = Math.max(0, fullHeight - viewportHeight - (visualViewport?.offsetTop || 0));
      const activeElement = document.activeElement;
      const isEditable =
        ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement?.tagName) ||
        activeElement?.isContentEditable === true;

      // iOS WKWebView can resize window.innerHeight together with visualViewport,
      // which makes keyboardHeight look like 0 even while the keyboard is open.
      // Focus on an editable control is therefore the primary keyboard signal.
      const nextKeyboardOpen = isEditable || keyboardHeight > KEYBOARD_THRESHOLD;

      // Hide/show the native-style tab bar immediately as well as through
      // React state. iOS can paint the keyboard before React commits state.
      if (layoutRef.current) {
        layoutRef.current.dataset.keyboardOpen = nextKeyboardOpen ? "true" : "false";
      }

      if (keyboardOpenRef.current !== nextKeyboardOpen) {
        keyboardOpenRef.current = nextKeyboardOpen;
        setKeyboardOpen(nextKeyboardOpen);
      }

      if (layoutRef.current && Number.isFinite(viewportHeight) && viewportHeight > 0) {
        layoutRef.current.style.setProperty(
          "--stockpulse-viewport-height",
          `${Math.round(viewportHeight)}px`
        );
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    document.addEventListener("focusin", updateViewport);
    const handleFocusOut = () => {
      // Let iOS finish moving focus before checking document.activeElement.
      window.setTimeout(updateViewport, 0);
    };

    document.addEventListener("focusout", handleFocusOut);
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      document.removeEventListener("focusin", updateViewport);
      document.removeEventListener("focusout", handleFocusOut);
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  useEffect(() => {
    const previous = previousTab.current;
    if (!previous) {
      previousTab.current = activeTab;
      return;
    }
    if (previous === activeTab) return;
    const scrollContainer = contentScrollRef.current;
    scrollPositions.current[previous] = scrollContainer?.scrollTop ?? 0;
    scrollContainer?.scrollTo({ top: scrollPositions.current[activeTab] ?? 0, behavior: "instant" });
    previousTab.current = activeTab;
  }, [activeTab]);

  const handleTabClick = useCallback((event, path) => {
    if (activeTab !== path) return;
    event.preventDefault();
    if (pathname !== path) navigate(path, { replace: true });
    scrollPositions.current[path] = 0;
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, pathname, navigate]);

  return (
    <div
      ref={layoutRef}
      className="relative w-full max-w-full overflow-hidden overscroll-none bg-background"
      style={{ height: "var(--stockpulse-viewport-height, 100dvh)" }}
    >
      <PortfolioChartPreloader />

      <style>{`
        [data-keyboard-open="true"] [data-stockpulse-tab-bar] {
          display: none !important;
        }
      `}</style>

      <div
        className="absolute inset-x-0 top-0 min-h-0 overflow-hidden"
        style={{
          bottom: tabsVisible
            ? `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`
            : "0px",
        }}
      >
        <div
          ref={contentScrollRef}
          className={`absolute inset-0 overflow-x-hidden overflow-y-auto touch-pan-y ${activeTab === "/watchlist" ? "stockpulse-watchlist-scroll overscroll-y-auto" : "overscroll-none"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Outlet />
        </div>
      </div>

      {pathname === "/home" && !keyboardOpen && (
        <div className="absolute left-1/2 z-50 -translate-x-1/2" style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}>
          <AddStockDialog />
        </div>
      )}

      {showTabs && (
        <nav
          data-stockpulse-tab-bar
          className="absolute inset-x-0 bottom-0 z-50 w-full shrink-0 overflow-hidden overscroll-none border-t border-gray-100 bg-[hsl(var(--card))]"
          style={{
            display: tabsVisible ? undefined : "none",
            paddingBottom: "env(safe-area-inset-bottom)",
            touchAction: "manipulation",
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
          }}
        >
          <div className="mx-auto flex h-[56px] w-full max-w-lg">
            {tabs.map(({ label, path, icon: Icon }) => {
              const active = activeTab === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={(event) => handleTabClick(event, path)}
                  draggable={false}
                  className={`relative flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${active ? "text-[hsl(var(--primary))]" : "text-gray-400"}`}
                  style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                >
                  {label === "Watchlist" ? (
                    <Star className={`h-5 w-5 ${active ? "fill-amber-400 text-amber-400" : ""}`} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span>{label}</span>
                  {active && <div className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[hsl(var(--primary))]" />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
