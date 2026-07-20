import React, { useCallback, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, TrendingUp, Settings, Star, SlidersHorizontal } from "lucide-react";
import AddStockDialog from "@/components/portfolio/AddStockDialog";

const tabs = [
  { label: "Watchlist", path: "/watchlist", icon: Star },
  { label: "Portfolio", path: "/home", icon: BriefcaseBusiness },
  { label: "Analysis", path: "/analysis", icon: TrendingUp },
  { label: "Screener", path: "/screener", icon: SlidersHorizontal },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function NavigationLayout() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();

  const activeTab = (() => {
    if (pathname === "/" || pathname === "/watchlist" || pathname.startsWith("/stock/")) {
      return "/watchlist";
    }
    const root = "/" + pathname.split("/")[1];
    return tabs.find((t) => t.path === root) ? root : "/watchlist";
  })();

  const showTabs = !pathname.startsWith("/stock/");
  const scrollPositions = useRef({});
  const prevTab = useRef(activeTab);

  useEffect(() => {
    const prev = prevTab.current;
    if (prev !== activeTab) {
      scrollPositions.current[prev] = window.scrollY;
      const saved = scrollPositions.current[activeTab] ?? 0;
      window.scrollTo({ top: saved, behavior: "instant" });
      prevTab.current = activeTab;
    }
  }, [activeTab]);

  const handleTabClick = useCallback((e, path) => {
    const isActive = activeTab === path;
    if (isActive) {
      e.preventDefault();
      if (pathname !== path) navigate(path, { replace: true });
      scrollPositions.current[path] = 0;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab, pathname, navigate]);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      {/* Content area – no animation, always visible */}
      <div className="relative flex-1" style={{ minHeight: "calc(100dvh - 70px)" }}>
        <div className="absolute inset-0 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {/* Floating Add button */}
      {pathname === "/home" && (
        <div className="fixed left-1/2 z-50 -translate-x-1/2"
             style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}>
          <AddStockDialog />
        </div>
      )}

      {/* Bottom Navigation */}
      {showTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-[hsl(var(--card))]"
             style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-lg">
            {tabs.map(({ label, path, icon: Icon }) => {
              const active = activeTab === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={(e) => handleTabClick(e, path)}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors min-h-[56px] ${
                    active ? "text-[hsl(var(--primary))]" : "text-gray-400"
                  }`}
                >
                  {label === "Watchlist" ? (
                    <Star className={`h-5 w-5 ${active ? "text-amber-400 fill-amber-400" : ""}`} />
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
