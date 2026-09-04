import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Briefcase,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { useMarketData } from "@/lib/MarketDataContext";
import { supabase } from "@/lib/supabase";
import {
  cachePortfolioStocks,
  readCachedPortfolioStocks,
} from "@/lib/portfolioCache";

import StockCard from "@/components/portfolio/StockCard";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import PortfolioGrowthChart from "@/components/portfolio/PortfolioGrowthChart";
import PortfolioOnboarding from "@/components/portfolio/PortfolioOnboarding";

function onboardingStorageKey(userId) {
  return `stockpulse:portfolio-onboarding-seen:${userId}`;
}

function hasSeenPortfolioOnboarding(user) {
  if (
    user?.user_metadata?.portfolio_onboarding_seen ||
    user?.user_metadata?.onboarding_completed
  ) {
    return true;
  }

  try {
    return (
      window.localStorage.getItem(
        onboardingStorageKey(user?.id)
      ) === "true"
    );
  } catch {
    return false;
  }
}

async function markPortfolioOnboardingSeen(userId) {
  try {
    window.localStorage.setItem(
      onboardingStorageKey(userId),
      "true"
    );
  } catch {
    // Supabase metadata remains the cross-device source of truth.
  }

  try {
    const { error } =
      await supabase.auth.updateUser({
        data: {
          portfolio_onboarding_seen: true,
        },
      });

    if (!error) {
      return;
    }

    console.warn(
      "Failed to persist portfolio onboarding state:",
      error
    );
  } catch (error) {
    console.warn(
      "Failed to persist portfolio onboarding state:",
      error
    );
  }
}

function EmptyPortfolio() {
  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col items-center justify-center px-5 py-16 text-center">
      <div
        className="
          flex
          h-[58px]
          w-[58px]
          items-center
          justify-center
          rounded-[18px]
          border
          border-border
          bg-card
          shadow-[0_4px_12px_rgba(0,0,0,0.045)]
        "
      >
        <Briefcase
          size={25}
          strokeWidth={2}
          className="text-foreground"
        />
      </div>

      <h2 className="mt-5 text-[20px] font-bold tracking-[-0.4px] text-foreground">
        Empty portfolio
      </h2>

      <p className="mt-2 max-w-[260px] text-[14px] leading-5 text-muted-foreground">
        Star a stock in your Watchlist to add it to your
        Portfolio.
      </p>
    </div>
  );
}

function PortfolioLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="
              h-[92px]
              animate-pulse
              rounded-[18px]
              border
              border-border/70
              bg-card
            "
          />
        ))}
      </div>

      <div
        className="
          h-[360px]
          animate-pulse
          rounded-[22px]
          border
          border-border
          bg-card
        "
      />

      <div className="space-y-3 pt-1">
        <div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-muted" />

        <div
          className="
            h-[82px]
            animate-pulse
            rounded-[20px]
            border
            border-border
            bg-card
          "
        />

        <div
          className="
            h-[82px]
            animate-pulse
            rounded-[20px]
            border
            border-border
            bg-card
          "
        />
      </div>
    </div>
  );
}

function SectionHeading({
  children,
  count = null,
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-2">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>

      {typeof count === "number" ? (
        <span className="text-[11px] font-medium text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const initialCachedStocks = useMemo(
    () => readCachedPortfolioStocks(user?.id),
    [user?.id],
  );

  const {
    quotes,
    refreshQuotes,
  } = useMarketData();

  const [stocks, setStocks] =
    useState(() => initialCachedStocks || []);

  const [loading, setLoading] =
    useState(() => initialCachedStocks === null);

  const [
    showPortfolioOnboarding,
    setShowPortfolioOnboarding,
  ] = useState(false);

  const onboardingDecisionMade =
    useRef(false);

  const onboardingMarked =
    useRef(false);

  const pricedStocks =
    useMemo(
      () =>
        stocks.map(
          (stock) => {
            const ticker =
              String(
                stock?.ticker || ""
              )
                .trim()
                .toUpperCase();

            const livePrice =
              quotes[ticker]
                ?.c;

            return Number.isFinite(
              livePrice
            ) && livePrice > 0
              ? {
                  ...stock,
                  current_price:
                    livePrice,
                }
              : stock;
          }
        ),
      [
        quotes,
        stocks,
      ]
    );

  const loadStocks =
    useCallback(async () => {
      if (!user?.id) {
        setStocks([]);
        setLoading(false);
        return;
      }

      try {
        const [
          stocksResult,
          watchlistResult,
        ] = await Promise.all([
          supabase
            .from("stocks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("watchlist_items")
            .select("ticker")
            .eq("user_id", user.id),
        ]);

        if (stocksResult.error) {
          throw stocksResult.error;
        }

        if (watchlistResult.error) {
          throw watchlistResult.error;
        }

        const watchlistTickers =
          new Set(
            (watchlistResult.data || [])
              .map((item) =>
                String(
                  item?.ticker || ""
                )
                  .trim()
                  .toUpperCase()
              )
              .filter(Boolean)
          );

        const nextStocks =
          (stocksResult.data || [])
            .filter(
              (stock) =>
                stock?.id &&
                stock.id !== "undefined"
            )
            .filter((stock) =>
              watchlistTickers.has(
                String(
                  stock?.ticker || ""
                )
                  .trim()
                  .toUpperCase()
              )
            );

        const alreadySeen =
          hasSeenPortfolioOnboarding(
            user
          );

        setStocks(nextStocks);
        cachePortfolioStocks(user.id, nextStocks);

        if (
          !onboardingDecisionMade.current
        ) {
          const showFirstVisit =
            nextStocks.length === 0 &&
            !alreadySeen;

          onboardingDecisionMade.current =
            true;

          setShowPortfolioOnboarding(
            showFirstVisit
          );

          if (showFirstVisit) {
            onboardingMarked.current =
              true;

            void markPortfolioOnboardingSeen(
              user.id
            );
          }
        }

        if (
          nextStocks.length > 0 &&
          !alreadySeen &&
          !onboardingMarked.current
        ) {
          onboardingMarked.current =
            true;

          setShowPortfolioOnboarding(
            false
          );

          void markPortfolioOnboardingSeen(
            user.id
          );
        }
      } catch (error) {
        console.error(
          "Error loading portfolio:",
          error
        );

        setStocks([]);
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    onboardingDecisionMade.current =
      false;

    onboardingMarked.current =
      false;

    setShowPortfolioOnboarding(false);
  }, [user?.id]);

  useEffect(() => {
    loadStocks();

    if (!user?.id) {
      return undefined;
    }

    const channel = supabase
      .channel(
        `portfolio-realtime-${user.id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stocks",
          filter:
            `user_id=eq.${user.id}`,
        },
        () => {
          void loadStocks();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlist_items",
          filter:
            `user_id=eq.${user.id}`,
        },
        () => {
          void loadStocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    user?.id,
    loadStocks,
  ]);

  useEffect(() => {
    if (!stocks.length) {
      return;
    }

    // Cached prices make the page appear instantly; force a silent refresh so
    // the restored chart endpoint never waits for a manual pull-to-refresh.
    void refreshQuotes(
      stocks.map(
        (stock) =>
          stock.ticker
      )
    );
  }, [
    refreshQuotes,
    stocks,
  ]);

  return (
    <div
      className="flex min-h-full flex-col bg-background text-foreground"
      style={{
        overscrollBehaviorY: "none",
      }}
    >
      <header
        className="
          sticky
          top-0
          z-20
          shrink-0
          border-b
          border-border/70
          bg-background/95
          backdrop-blur-xl
        "
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-[62px] w-full max-w-[430px] items-end justify-center px-4 pb-3">
          <h1 className="text-[24px] font-bold tracking-[-0.5px] text-foreground">
            Portfolio
          </h1>
        </div>
      </header>

      <main
        className="
          mx-auto
          flex
          w-full
          max-w-[430px]
          flex-1
          flex-col
          overflow-y-auto
          overscroll-y-none
          px-4
          pb-7
          pt-4
        "
        style={{
          overscrollBehaviorY: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {loading ? (
          <PortfolioLoading />
        ) : stocks.length === 0 ? (
          showPortfolioOnboarding ? (
            <PortfolioOnboarding />
          ) : (
            <EmptyPortfolio />
          )
        ) : (
          <motion.div
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            className="space-y-5"
          >
            <section>
              <SectionHeading>
                Overview
              </SectionHeading>

              <PortfolioSummary
                stocks={pricedStocks}
              />
            </section>

            <section>
              <SectionHeading>
                Performance
              </SectionHeading>

              <div
                className="
                  overflow-hidden
                  rounded-[22px]
                  border
                  border-border
                  bg-card
                  shadow-[0_4px_12px_rgba(0,0,0,0.04)]
                "
              >
                <PortfolioGrowthChart
                  stocks={pricedStocks}
                />
              </div>
            </section>

            <section>
              <SectionHeading
                count={stocks.length}
              >
                Holdings
              </SectionHeading>

              <div className="space-y-3">
                <AnimatePresence
                  initial={false}
                >
                  {pricedStocks.map(
                    (stock, index) => (
                      <motion.div
                        key={stock.id}
                        layout
                        initial={{
                          opacity: 0,
                          y: 8,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.98,
                        }}
                        transition={{
                          duration: 0.18,
                          delay:
                            Math.min(
                              index * 0.025,
                              0.15
                            ),
                        }}
                        className="
                          overflow-hidden
                          rounded-[20px]
                          border
                          border-border
                          bg-card
                          shadow-[0_4px_10px_rgba(0,0,0,0.035)]
                          transition-[transform,box-shadow]
                          duration-150
                          active:scale-[0.995]
                        "
                      >
                        <StockCard
                          stock={stock}
                          onRefresh={
                            loadStocks
                          }
                        />
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </div>
            </section>
          </motion.div>
        )}

        {loading ? (
          <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[-1] flex -translate-y-1/2 justify-center opacity-0">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}
      </main>
    </div>
  );
}
