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

const TAB_BAR_HEIGHT = 56;

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
    <div className="relative h-[100dvh] w-full max-w-full overflow-hidden overscroll-none bg-background">
      <div
        className="absolute inset-x-0 top-0 min-h-0 overflow-hidden"
        style={{
          bottom: showTabs
            ? `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`
            : "0px",
        }}
      >
        <div
          ref={contentScrollRef}
          className={[
            "absolute inset-0 overflow-x-hidden overflow-y-auto touch-pan-y",
            activeTab === "/watchlist"
              ? "stockpulse-watchlist-scroll overscroll-y-auto"
              : "overscroll-none",
          ].join(" ")}
          style={{
            WebkitOverflowScrolling: "touch",
          }}
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
          className="fixed inset-x-0 bottom-0 z-50 w-full shrink-0 overflow-hidden overscroll-none border-t border-gray-100 bg-[hsl(var(--card))]"
          style={{
            paddingBottom:
              "env(safe-area-inset-bottom)",
            touchAction: "manipulation",
            WebkitTransform: "translateZ(0)",
            transform: "translateZ(0)",
          }}
        >
          <div className="mx-auto flex h-[56px] w-full max-w-lg">
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
                    draggable={false}
                    className={`relative flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                      active
                        ? "text-[hsl(var(--primary))]"
                        : "text-gray-400"
                    }`}
                    style={{
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
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
