import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-alerts-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AlertRow = {
  id: string;
  user_id: string;
  ticker: string;
  condition: "above" | "below" | string;
  target_price: number | string;
  enabled: boolean;
  triggered: boolean;
  last_checked_price: number | string | null;
};

type QuoteResult = {
  ticker: string;
  price: number | null;
  error: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object"
  ) {
    const record =
      error as Record<string, unknown>;

    const parts = [
      record.message,
      record.details,
      record.hint,
      record.code,
    ]
      .filter(
        (value) =>
          typeof value === "string" &&
          value.trim(),
      )
      .map((value) =>
        String(value).trim()
      );

    if (parts.length) {
      return [...new Set(parts)].join(" — ");
    }
  }

  return "Unknown error";
}

function numberOrNull(
  value: unknown,
): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeCondition(
  value: unknown,
): "above" | "below" | null {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  if (
    normalized === "above" ||
    normalized === "price above"
  ) {
    return "above";
  }

  if (
    normalized === "below" ||
    normalized === "price below"
  ) {
    return "below";
  }

  return null;
}

function alertWasReached(
  alert: AlertRow,
  currentPrice: number,
): boolean {
  const targetPrice =
    numberOrNull(alert.target_price);

  const condition =
    normalizeCondition(
      alert.condition,
    );

  if (
    targetPrice === null ||
    targetPrice <= 0 ||
    !condition
  ) {
    return false;
  }

  if (condition === "above") {
    return currentPrice >= targetPrice;
  }

  return currentPrice <= targetPrice;
}

function notificationCopy(
  alert: AlertRow,
  currentPrice: number,
): {
  title: string;
  body: string;
} {
  const ticker =
    alert.ticker.trim().toUpperCase();

  const targetPrice =
    Number(alert.target_price);

  const direction =
    normalizeCondition(
      alert.condition,
    ) === "below"
      ? "below"
      : "above";

  return {
    title:
      `${ticker} price alert triggered`,

    body:
      `${ticker} is ${direction} $${targetPrice.toFixed(2)}. ` +
      `Current price: $${currentPrice.toFixed(2)}.`,
  };
}

async function fetchFinnhubQuote(
  ticker: string,
  apiKey: string,
): Promise<QuoteResult> {
  try {
    const url =
      new URL(
        "https://finnhub.io/api/v1/quote",
      );

    url.searchParams.set(
      "symbol",
      ticker,
    );

    url.searchParams.set(
      "token",
      apiKey,
    );

    const response =
      await fetch(url);

    const payload =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      return {
        ticker,
        price: null,
        error:
          payload?.error ||
          `Finnhub returned ${response.status}`,
      };
    }

    const price =
      numberOrNull(payload?.c);

    if (
      price === null ||
      price <= 0
    ) {
      return {
        ticker,
        price: null,
        error:
          "Finnhub returned no valid current price.",
      };
    }

    return {
      ticker,
      price,
      error: null,
    };
  } catch (error) {
    return {
      ticker,
      price: null,
      error: getErrorMessage(error),
    };
  }
}

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers: corsHeaders,
        },
      );
    }

    if (
      request.method !== "POST"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const expectedSecret =
        getRequiredEnvironmentVariable(
          "ALERTS_WORKER_SECRET",
        );

      const suppliedSecret =
        request.headers.get(
          "x-alerts-secret",
        );

      if (
        !suppliedSecret ||
        suppliedSecret !== expectedSecret
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Unauthorized worker request.",
          },
          401,
        );
      }

      const supabaseUrl =
        getRequiredEnvironmentVariable(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      const finnhubApiKey =
        getRequiredEnvironmentVariable(
          "FINNHUB_API_KEY",
        );

      const admin =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          },
        );

      const {
        data: alerts,
        error: alertsError,
      } =
        await admin
          .from("stock_alerts")
          .select(
            "id,user_id,ticker,condition,target_price,enabled,triggered,last_checked_price",
          )
          .eq("enabled", true)
          .eq("triggered", false)
          .order("created_at", {
            ascending: true,
          })
          .limit(5000);

      if (alertsError) {
        throw alertsError;
      }

      const activeAlerts =
        (alerts || []) as AlertRow[];

      if (!activeAlerts.length) {
        return jsonResponse({
          ok: true,
          alertsChecked: 0,
          alertsReached: 0,
          tickersChecked: 0,
          alertsTriggered: 0,
          quoteErrors: 0,
          notificationErrors: 0,
          triggerUpdateErrors: 0,
          firstNotificationError: null,
          diagnostics: [],
        });
      }

      const uniqueTickers =
        [
          ...new Set(
            activeAlerts
              .map((alert) =>
                String(
                  alert.ticker || "",
                )
                  .trim()
                  .toUpperCase()
              )
              .filter(Boolean),
          ),
        ]
          .slice(0, 50);

      const quotes =
        new Map<
          string,
          QuoteResult
        >();

      for (
        const ticker
        of uniqueTickers
      ) {
        const quote =
          await fetchFinnhubQuote(
            ticker,
            finnhubApiKey,
          );

        quotes.set(
          ticker,
          quote,
        );

        // Keeps a free Finnhub key comfortably below
        // burst limits while still finishing quickly.
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              120,
            ),
        );
      }

      let alertsChecked = 0;
      let alertsReached = 0;
      let alertsTriggered = 0;
      let quoteErrors = 0;
      let notificationErrors = 0;
      let triggerUpdateErrors = 0;
      let firstNotificationError:
        string | null = null;

      const diagnostics: Array<{
        alertId: string;
        ticker: string;
        rawCondition: string;
        normalizedCondition: "above" | "below" | null;
        targetPrice: number | null;
        currentPrice: number | null;
        reached: boolean;
        quoteError: string | null;
      }> = [];

      for (
        const alert
        of activeAlerts
      ) {
        const ticker =
          String(
            alert.ticker || "",
          )
            .trim()
            .toUpperCase();

        if (
          !quotes.has(ticker)
        ) {
          continue;
        }

        const quote =
          quotes.get(ticker)!;

        if (
          quote.error ||
          quote.price === null
        ) {
          quoteErrors += 1;

          if (diagnostics.length < 20) {
            diagnostics.push({
              alertId: alert.id,
              ticker,
              rawCondition: String(alert.condition || ""),
              normalizedCondition: normalizeCondition(alert.condition),
              targetPrice: numberOrNull(alert.target_price),
              currentPrice: quote.price,
              reached: false,
              quoteError: quote.error,
            });
          }

          const {
            error: updateError,
          } =
            await admin
              .from("stock_alerts")
              .update({
                last_checked_at:
                  new Date().toISOString(),

                notification_error:
                  quote.error ||
                  "Quote unavailable",
              })
              .eq(
                "id",
                alert.id,
              );

          if (updateError) {
            console.error(
              `Could not save quote error for alert ${alert.id}:`,
              updateError,
            );
          }

          continue;
        }

        alertsChecked += 1;

        const reached =
          alertWasReached(
            alert,
            quote.price,
          );

        if (diagnostics.length < 20) {
          diagnostics.push({
            alertId: alert.id,
            ticker,
            rawCondition: String(alert.condition || ""),
            normalizedCondition: normalizeCondition(alert.condition),
            targetPrice: numberOrNull(alert.target_price),
            currentPrice: quote.price,
            reached,
            quoteError: null,
          });
        }

        const checkedAt =
          new Date().toISOString();

        if (!reached) {
          const {
            error: updateError,
          } =
            await admin
              .from("stock_alerts")
              .update({
                last_checked_price:
                  quote.price,

                last_checked_at:
                  checkedAt,

                notification_error:
                  null,
              })
              .eq(
                "id",
                alert.id,
              );

          if (updateError) {
            console.error(
              `Could not update alert ${alert.id}:`,
              updateError,
            );
          }

          continue;
        }

        alertsReached += 1;

        const copy =
          notificationCopy(
            alert,
            quote.price,
          );

        const notificationPayload = {
          user_id:
            alert.user_id,

          type:
            "price_alert",

          title:
            copy.title,

          body:
            copy.body,

          ticker,

          route:
            `/stock/ticker-${ticker}`,

          source_type:
            "stock_alert",

          source_id:
            alert.id,

          metadata: {
            condition:
              alert.condition,

            target_price:
              Number(
                alert.target_price,
              ),

            current_price:
              quote.price,
          },
        };

        const {
          data: existingNotification,
          error: existingNotificationError,
        } =
          await admin
            .from(
              "app_notifications",
            )
            .select("id")
            .eq(
              "user_id",
              alert.user_id,
            )
            .eq(
              "source_type",
              "stock_alert",
            )
            .eq(
              "source_id",
              alert.id,
            )
            .maybeSingle();

        let notificationError:
          unknown = null;

        if (
          existingNotificationError
        ) {
          notificationError =
            existingNotificationError;
        } else if (
          existingNotification?.id
        ) {
          const {
            error: updateNotificationError,
          } =
            await admin
              .from(
                "app_notifications",
              )
              .update({
                ...notificationPayload,

                read_at:
                  null,

                created_at:
                  checkedAt,
              })
              .eq(
                "id",
                existingNotification.id,
              );

          notificationError =
            updateNotificationError;
        } else {
          const {
            error: insertNotificationError,
          } =
            await admin
              .from(
                "app_notifications",
              )
              .insert(
                notificationPayload,
              );

          notificationError =
            insertNotificationError;
        }

        if (notificationError) {
          notificationErrors += 1;

          const notificationMessage =
            getErrorMessage(
              notificationError,
            );

          if (!firstNotificationError) {
            firstNotificationError =
              notificationMessage;
          }

          console.error(
            `Could not create notification for alert ${alert.id}:`,
            notificationMessage,
            notificationError,
          );

          await admin
            .from("stock_alerts")
            .update({
              last_checked_price:
                quote.price,

              last_checked_at:
                checkedAt,

              notification_error:
                notificationMessage,
            })
            .eq(
              "id",
              alert.id,
            );

          continue;
        }

        const {
          error: triggerError,
        } =
          await admin
            .from("stock_alerts")
            .update({
              triggered:
                true,

              triggered_at:
                checkedAt,

              last_checked_price:
                quote.price,

              last_checked_at:
                checkedAt,

              notification_sent_at:
                checkedAt,

              notification_error:
                null,
            })
            .eq(
              "id",
              alert.id,
            )
            .eq(
              "triggered",
              false,
            );

        if (triggerError) {
          triggerUpdateErrors += 1;

          console.error(
            `Could not mark alert ${alert.id} triggered:`,
            triggerError,
          );

          continue;
        }

        alertsTriggered += 1;
      }

      return jsonResponse({
        ok: true,
        alertsChecked,
        alertsReached,
        tickersChecked:
          uniqueTickers.length,
        alertsTriggered,
        quoteErrors,
        notificationErrors,
        triggerUpdateErrors,
        firstNotificationError,
        diagnostics,
      });
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        "Price alert worker failed:",
        message,
        error,
      );

      return jsonResponse(
        {
          ok: false,
          error: message,
        },
        500,
      );
    }
  },
);
