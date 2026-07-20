import React, { useCallback, useEffect, useRef } from "react";
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

const tabs = [
  {
    label: "Watchlist",
    path: "/watchlist",
    icon: Star,
  },
  {
    label: "Portfolio",
    path: "/home",
    icon: BriefcaseBusiness,
  },
  {
    label: "Analysis",
    path: "/analysis",
    icon: TrendingUp,
  },
  {
    label: "Screener",
    path: "/screener",
    icon: SlidersHorizontal,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

export default function NavigationLayout() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();

  const activeTab = (() => {
    if (
      pathname === "/" ||
      pathname === "/watchlist" ||
      pathname.startsWith("/stock/")
    ) {
      return "/watchlist";
    }

    const root = `/${pathname.split("/")[1]}`;

    return tabs.some(
      (tab) => tab.path === root
    )
      ? root
      : "/watchlist";
  })();

  const showTabs =
    !pathname.startsWith("/stock/");

  const scrollPositions = useRef({});
  const previousTab = useRef(activeTab);
  const contentScrollRef = useRef(null);

  useEffect(() => {
    const previous = previousTab.current;

    if (previous === activeTab) {
      return;
    }

    const scrollContainer =
      contentScrollRef.current;

    scrollPositions.current[previous] =
      scrollContainer?.scrollTop ?? 0;

    const savedPosition =
      scrollPositions.current[activeTab] ?? 0;

    scrollContainer?.scrollTo({
      top: savedPosition,
      behavior: "instant",
    });

    previousTab.current = activeTab;
  }, [activeTab]);

  const handleTabClick = useCallback(
    (event, path) => {
      if (activeTab !== path) {
        return;
      }

      event.preventDefault();

      if (pathname !== path) {
        navigate(path, {
          replace: true,
        });
      }

      scrollPositions.current[path] = 0;

      contentScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    },
    [activeTab, pathname, navigate]
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <div
          ref={contentScrollRef}
          className="absolute inset-0 overflow-y-auto overscroll-y-contain"
        >
          <Outlet />
        </div>
      </div>

      {pathname === "/home" && (
        <div
          className="fixed left-1/2 z-50 -translate-x-1/2"
          style={{
            bottom:
              "calc(env(safe-area-inset-bottom) + 68px)",
          }}
        >
          <AddStockDialog />
        </div>
      )}

      {showTabs && (
        <nav
          className="relative z-50 shrink-0 border-t border-gray-100 bg-[hsl(var(--card))]"
          style={{
            paddingBottom:
              "env(safe-area-inset-bottom)",
          }}
        >
          <div className="mx-auto flex max-w-lg">
            {tabs.map(
              ({
                label,
                path,
                icon: Icon,
              }) => {
                const active =
                  activeTab === path;

                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={(event) =>
                      handleTabClick(
                        event,
                        path
                      )
                    }
                    className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                      active
                        ? "text-[hsl(var(--primary))]"
                        : "text-gray-400"
                    }`}
                  >
                    {label ===
                    "Watchlist" ? (
                      <Star
                        className={`h-5 w-5 ${
                          active
                            ? "fill-amber-400 text-amber-400"
                            : ""
                        }`}
                      />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}

                    <span>{label}</span>

                    {active && (
                      <div className="absolute bottom-1 h-0.5 w-6 rounded-full bg-[hsl(var(--primary))]" />
                    )}
                  </Link>
                );
              }
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
