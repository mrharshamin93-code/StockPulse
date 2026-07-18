import React, { useCallback, useRef, useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, TrendingUp, Settings, Star, SlidersHorizontal } from "lucide-react";
import AddStockDialog from "@/components/portfolio/AddStockDialog";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";

const tabs = [
  { label: "Watchlist", path: "/", icon: Star },
  { label: "Portfolio", path: "/home", icon: BriefcaseBusiness },
  { label: "Analysis", path: "/analysis", icon: TrendingUp },
  { label: "Screener", path: "/screener", icon: SlidersHorizontal },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function NavigationLayout() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();

  // Determine the active root tab (first path segment)
  const activeTab = (() => {
    if (pathname === "/" || pathname.startsWith("/stock/")) return "/";
    const root = "/" + pathname.split("/")[1];
    return tabs.find(t => t.path === root) ? root : "/";
  })();

  // Don't show tab bar on stock detail pages
  const showTabs = !pathname.startsWith("/stock/");

  const isPortfolio = pathname === "/home" || pathname.startsWith("/home");

  // Preserve scroll positions per tab
  const scrollPositions = useRef({});
  const prevTab = useRef(activeTab);
  const directionRef = useRef(0); // -1 = slide left (going right), 1 = slide right (going left)

  useEffect(() => {
    const prev = prevTab.current;
    if (prev !== activeTab) {
      const prevIndex = tabs.findIndex(t => t.path === prev);
      const nextIndex = tabs.findIndex(t => t.path === activeTab);
      directionRef.current = nextIndex > prevIndex ? -1 : 1;
      // Save scroll position of the leaving tab
      scrollPositions.current[prev] = window.scrollY;
      // Restore scroll position of the entering tab
      const saved = scrollPositions.current[activeTab] ?? 0;
      window.scrollTo({ top: saved, behavior: "instant" });
      prevTab.current = activeTab;
    }
  }, [activeTab]);

  // Re-tapping the active tab resets to its root path and scrolls to top
  const handleTabClick = useCallback((e, path) => {
    const isActive = activeTab === path;
    if (isActive) {
      e.preventDefault();
      if (pathname !== path) {
        navigate(path, { replace: true });
      }
      scrollPositions.current[path] = 0;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab, pathname, navigate]);

  const slideVariants = {
    enter: (dir) => ({ x: dir < 0 ? "100%" : "-100%" }),
    center: { x: 0 },
    exit: (dir) => ({ x: dir < 0 ? "-100%" : "100%" }),
  };

  return (
    <div className="flex flex-col min-h-screen overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", overflow: showTabs ? "hidden" : "visible", flex: 1 }}>
        <AnimatePresence mode="popLayout" custom={directionRef.current} initial={false}>
          <motion.div
            key={activeTab}
            custom={directionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={showTabs ? { position: "absolute", top: 0, left: 0, right: 0, willChange: "transform" } : { position: "relative" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      {(pathname === "/home") && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + 68px)` }}
        >
          <AddStockDialog />
        </div>
      )}
      {showTabs && (
        <nav
          className="fixed bottom-0 left-0 right-0 border-t border-gray-100 z-50"
          style={{ backgroundColor: "hsl(var(--card))", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-stretch max-w-lg mx-auto">
            {tabs.map(({ label, path, icon: Icon }) => {
              const active = activeTab === path;
              const primaryColor = "hsl(var(--primary))";
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={(e) => handleTabClick(e, path)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
                    active ? "" : "text-gray-400"
                  }`}
                  style={active ? { color: primaryColor } : {}}
                >
                  {label === "Watchlist" ? (
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            className="absolute rounded-full"
                            style={{ background: "rgba(251,191,36,0.35)", width: 28, height: 28 }}
                            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                      </AnimatePresence>
                      <motion.div
                        key={active ? "active" : "inactive"}
                        animate={active ? { rotate: [0, -15, 15, -10, 10, 0] } : { rotate: 0 }}
                        transition={active ? { duration: 0.4, ease: "easeInOut" } : {}}
                        className="relative z-10"
                      >
                        <Star className={`w-5 h-5 ${active ? "text-amber-400" : "text-gray-400"}`} style={active ? { fill: "#f59e0b" } : {}} />
                      </motion.div>
                    </div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                  <span className="text-[10px] font-medium">
                    {label}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ bottom: "env(safe-area-inset-bottom)", backgroundColor: primaryColor }} />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}