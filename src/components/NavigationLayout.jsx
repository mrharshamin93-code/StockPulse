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
import PortfolioChartPreloader from "@/components/portfolio/PortfolioChartPreloader";

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
const CHART_LONG_PRESS_DELAY = 325;
const CHART_SCROLL_CANCEL_DISTANCE = 8;

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

  const layoutRef = useRef(null);
  const scrollPositions = useRef({});
  const previousTab = useRef(activeTab);
  const contentScrollRef = useRef(null);

  useEffect(() => {
    const updateViewportHeight = () => {
      const viewportHeight =
        window.visualViewport?.height ||
        window.innerHeight;

      if (
        layoutRef.current &&
        Number.isFinite(viewportHeight) &&
        viewportHeight > 0
      ) {
        layoutRef.current.style.setProperty(
          "--stockpulse-viewport-height",
          `${Math.round(viewportHeight)}px`
        );
      }
    };

    updateViewportHeight();

    const visualViewport =
      window.visualViewport;

    window.addEventListener(
      "resize",
      updateViewportHeight
    );
    window.addEventListener(
      "orientationchange",
      updateViewportHeight
    );

    visualViewport?.addEventListener(
      "resize",
      updateViewportHeight
    );
    visualViewport?.addEventListener(
      "scroll",
      updateViewportHeight
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateViewportHeight
      );
      window.removeEventListener(
        "orientationchange",
        updateViewportHeight
      );

      visualViewport?.removeEventListener(
        "resize",
        updateViewportHeight
      );
      visualViewport?.removeEventListener(
        "scroll",
        updateViewportHeight
      );
    };
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/stock/")) {
      return undefined;
    }

    let gesture = null;

    const getChartSurface = (target) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const responsiveContainer = target.closest(
        ".recharts-responsive-container"
      );

      if (!responsiveContainer) {
        return null;
      }

      return responsiveContainer.parentElement;
    };

    const enableChartScrolling = () => {
      const scrollRoot = contentScrollRef.current;

      if (!scrollRoot) return;

      scrollRoot
        .querySelectorAll(".recharts-responsive-container")
        .forEach((responsiveContainer) => {
          const chartSurface = responsiveContainer.parentElement;

          if (!chartSurface) return;

          const currentValue = chartSurface.style.getPropertyValue(
            "touch-action"
          );
          const currentPriority = chartSurface.style.getPropertyPriority(
            "touch-action"
          );

          if (
            currentValue !== "pan-y" ||
            currentPriority !== "important"
          ) {
            chartSurface.style.setProperty(
              "touch-action",
              "pan-y",
              "important"
            );
          }
        });
    };

    const dispatchChartMouseMove = (
      chartSurface,
      clientX,
      clientY
    ) => {
      const target =
        document.elementFromPoint(clientX, clientY) ||
        chartSurface.querySelector(".recharts-wrapper") ||
        chartSurface;

      target.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          view: window,
        })
      );
    };

    const clearLongPressTimer = () => {
      if (gesture?.timer) {
        window.clearTimeout(gesture.timer);
        gesture.timer = null;
      }
    };

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) {
        return;
      }

      const chartSurface = getChartSurface(event.target);

      if (!chartSurface) {
        return;
      }

      chartSurface.style.setProperty(
        "touch-action",
        "pan-y",
        "important"
      );

      const touch = event.touches[0];

      clearLongPressTimer();

      gesture = {
        chartSurface,
        startX: touch.clientX,
        startY: touch.clientY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        active: false,
        moved: false,
        timer: null,
      };

      gesture.timer = window.setTimeout(() => {
        if (!gesture || gesture.moved) {
          return;
        }

        gesture.active = true;
        gesture.timer = null;

        dispatchChartMouseMove(
          gesture.chartSurface,
          gesture.clientX,
          gesture.clientY
        );
      }, CHART_LONG_PRESS_DELAY);

      // Keep StockDetail's immediate touch tooltip handler from firing.
      // The browser still receives the default touch behavior, so a
      // vertical swipe can scroll the page normally.
      event.stopPropagation();
    };

    const handleTouchMove = (event) => {
      if (!gesture || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      const distance = Math.hypot(deltaX, deltaY);

      gesture.clientX = touch.clientX;
      gesture.clientY = touch.clientY;

      if (!gesture.active) {
        if (distance > CHART_SCROLL_CANCEL_DISTANCE) {
          gesture.moved = true;
          clearLongPressTimer();
        }

        event.stopPropagation();
        return;
      }

      // Once the user deliberately long-presses, the chart owns the
      // gesture so they can move across data points without page scroll.
      event.preventDefault();
      event.stopPropagation();

      dispatchChartMouseMove(
        gesture.chartSurface,
        touch.clientX,
        touch.clientY
      );
    };

    const finishTouch = (event) => {
      if (!gesture) {
        return;
      }

      clearLongPressTimer();
      event.stopPropagation();
      gesture = null;
    };

    enableChartScrolling();

    const observer = new MutationObserver(
      enableChartScrolling
    );

    if (contentScrollRef.current) {
      observer.observe(contentScrollRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    document.addEventListener(
      "touchstart",
      handleTouchStart,
      { capture: true, passive: true }
    );
    document.addEventListener(
      "touchmove",
      handleTouchMove,
      { capture: true, passive: false }
    );
    document.addEventListener(
      "touchend",
      finishTouch,
      { capture: true, passive: true }
    );
    document.addEventListener(
      "touchcancel",
      finishTouch,
      { capture: true, passive: true }
    );

    return () => {
      clearLongPressTimer();
      observer.disconnect();

      document.removeEventListener(
        "touchstart",
        handleTouchStart,
        true
      );
      document.removeEventListener(
        "touchmove",
        handleTouchMove,
        true
      );
      document.removeEventListener(
        "touchend",
        finishTouch,
        true
      );
      document.removeEventListener(
        "touchcancel",
        finishTouch,
        true
      );
    };
  }, [pathname]);

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
    <div
      ref={layoutRef}
      className="relative w-full max-w-full overflow-hidden overscroll-none bg-background"
      style={{
        height:
          "var(--stockpulse-viewport-height, 100dvh)",
      }}
    >
      <PortfolioChartPreloader />

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
          className="absolute left-1/2 z-50 -translate-x-1/2"
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
          className="absolute inset-x-0 bottom-0 z-50 w-full shrink-0 overflow-hidden overscroll-none border-t border-gray-100 bg-[hsl(var(--card))]"
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
