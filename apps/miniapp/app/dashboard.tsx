"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardSkeleton } from "../components/dashboard-skeleton";
import { EmptyOrdersState } from "../components/empty-orders-state";
import { PrimaryActionButton } from "../components/primary-action-button";
import {
  RecentOrderCard,
  type RecentOrder,
} from "../components/recent-order-card";
import {
  StarsBalanceCard,
  type StarsBalanceState,
} from "../components/stars-balance-card";
import { UserHeader } from "../components/user-header";
import { SupportButton } from "../components/support";

interface DashboardData {
  user: { firstName: string; username: string | null; photoUrl: string | null };
  starsBalance: Exclude<StarsBalanceState, { status: "loading" | "error" }>;
  orders: RecentOrder[];
}

interface AuthenticationResult {
  authenticated: boolean;
  error?: string;
}

async function authenticateWithTelegram(): Promise<AuthenticationResult> {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready();
  webApp?.expand?.();
  if (!webApp)
    return {
      authenticated: false,
      error:
        "Telegram context was not detected. Open the app using the bot's menu or /start button.",
    };
  if (!webApp.initData)
    return {
      authenticated: false,
      error:
        "Telegram did not provide signed launch data. Close this window and reopen it using the bot's menu or /start button.",
    };
  const response = await fetch("/api/auth/telegram", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: webApp.initData }),
  });
  if (response.ok) return { authenticated: true };
  const body = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  const messages: Record<string, string> = {
    telegram_init_data_expired:
      "Telegram launch data expired. Close this window and reopen the Mini App from the bot.",
    telegram_init_data_invalid_signature:
      "Telegram could not verify this Mini App. Confirm that the Mini App deployment uses the token for the same bot that opened it.",
    telegram_init_data_duplicate_field:
      "Telegram launch data contained duplicate fields. Close the window and reopen it from the bot.",
    telegram_init_data_missing_fields:
      "Telegram did not include a signed user identity. Open the Mini App from the bot's configured menu or /start Web App button, not from a copied website link.",
    telegram_init_data_invalid_hash:
      "Telegram supplied an invalid authentication hash. Close the window and reopen the Mini App from the bot.",
    telegram_init_data_invalid_auth_date:
      "Telegram supplied an invalid authentication timestamp. Update Telegram and reopen the Mini App.",
    telegram_init_data_invalid_user:
      "Telegram supplied a signed user profile that this app could not read. Update Telegram and reopen the Mini App.",
    auth_configuration:
      "Telegram authentication is not fully configured on the Mini App server.",
  };
  return {
    authenticated: false,
    error:
      (body?.code && messages[body.code]) ||
      (response.status === 429
        ? "Too many authentication attempts. Wait a minute and try again."
        : response.status === 503
          ? "The authentication service is temporarily unavailable. Check the Mini App server configuration and database migrations."
          : "Telegram authentication failed. Close this window and reopen the Mini App from the bot."),
  };
}

export function Dashboard(): React.ReactNode {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      let response = await fetch("/api/dashboard", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        const authentication = await authenticateWithTelegram();
        if (!authentication.authenticated)
          throw new Error(authentication.error ?? "Authentication failed.");
        response = await fetch("/api/dashboard", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 401)
          throw new Error(
            "Telegram authentication succeeded, but the session cookie was unavailable. Allow cookies for this Mini App and reopen it.",
          );
      }
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Open this Mini App from Telegram to continue."
            : "We couldn't load your dashboard.",
        );
      setData((await response.json()) as DashboardData);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn't load your dashboard.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) return <DashboardSkeleton />;
  if (error)
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-lg place-items-center px-5">
        <section className="w-full rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-6 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/15 text-xl">
            !
          </div>
          <h1 className="mt-4 text-xl font-semibold">Unable to continue</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--tg-theme-hint-color,#8e8e93)]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 min-h-12 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] px-5 font-semibold text-[var(--tg-theme-button-text-color,#fff)] active:scale-[0.98]"
          >
            Try again
          </button>
        </section>
      </main>
    );
  if (!data) return null;

  const buyStars = useCallback(
    async (packId: string) => {
      const webApp = window.Telegram?.WebApp;
      if (!webApp) {
        setError("Open this Mini App inside Telegram to buy Stars.");
        return;
      }
      if (!webApp.initData) {
        setError("Telegram did not provide signed launch data.");
        return;
      }

      const invoiceUrl =
        process.env.NEXT_PUBLIC_BOT_API_URL?.replace(/\/+$/, "") ??
        "http://localhost:3002";

      const response = await fetch(`${invoiceUrl}/invoices`, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData: webApp.initData,
          packId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; invoiceLink?: string; error?: string }
        | null;

      if (!response.ok || !body?.ok || !body.invoiceLink) {
        throw new Error(body?.error ?? "We couldn't create a Stars invoice.");
      }

      const invoiceWindow = webApp as typeof webApp & {
        openInvoice?: (
          invoiceLink: string,
          callback: (status: "paid" | "cancelled" | "failed") => void,
        ) => void;
      };

      if (!invoiceWindow.openInvoice) {
        throw new Error("This Telegram client does not support invoices.");
      }

      invoiceWindow.openInvoice(body.invoiceLink, (status) => {
        if (status === "paid") {
          void load();
          return;
        }
        if (status === "cancelled" || status === "failed") {
          setError("Stars purchase was cancelled or failed.");
        }
      });
    },
    [load],
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-28 pt-4 sm:px-5">
      <UserHeader {...data.user} />
      <div className="mt-5">
        <StarsBalanceCard state={data.starsBalance} />
      </div>
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => void buyStars("starter").catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "We couldn't open the Stars invoice.",
            );
          })}
          className="min-h-12 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] px-5 font-semibold text-[var(--tg-theme-button-text-color,#fff)] active:scale-[0.98]"
        >
          Buy 100 Stars
        </button>
        <PrimaryActionButton href="/sell">
          Sell Telegram Stars
        </PrimaryActionButton>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent orders</h2>
        <div className="space-y-3">
          {data.orders.length ? (
            data.orders.map((order) => (
              <RecentOrderCard key={order.orderNumber} order={order} />
            ))
          ) : (
            <EmptyOrdersState />
          )}
        </div>
      </section>
      <section className="mt-8 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 text-center">
        <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
          Need help?
        </p>
        <SupportButton className="mt-1" />
      </section>
    </main>
  );
}
