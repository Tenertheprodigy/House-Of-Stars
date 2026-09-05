"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OrderStatusBadge } from "../../../components/order-status-badge";
import { TelegramBackButton } from "../../../components/telegram-back-button";
import { OrderSupportCard } from "../../../components/support";
import { maskWallet } from "../../../lib/order-detail";

interface Detail {
  order: {
    orderNumber: string;
    starsAmount: number;
    payoutAsset: string;
    payoutNetwork: string;
    walletAddress: string;
    estimatedAmount: string;
    status: string;
    source: string;
    createdAt: string;
    settlementAvailableAt: string | null;
  };
  timeline: Array<{ label: string; occurredAt: string }>;
  transaction: { id: string; url: string } | null;
  estimatedProcessingDays: number | null;
}

export function OrderStatus({
  orderNumber,
}: {
  orderNumber: string;
}): React.ReactNode {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const body = (await response.json()) as Detail & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to load order.");
      setDetail(body);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load order.",
      );
    }
  }, [orderNumber]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);
  if (!detail && !error)
    return (
      <main className="mx-auto min-h-dvh max-w-lg animate-pulse p-5">
        <div className="h-96 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      </main>
    );
  const order = detail?.order;
  const reference = order
    ? `Order #${order.orderNumber.padStart(6, "0")}`
    : "Order";
  const delayed = order?.source === "apple_google" || order?.source === "gifts";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-12 pt-5">
      <TelegramBackButton />
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </Link>
      {error && !detail ? (
        <section className="mt-8 rounded-3xl bg-red-500/10 p-5 text-red-500">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-11 font-semibold"
          >
            Try again
          </button>
        </section>
      ) : null}
      {order && detail ? (
        <>
          <header className="mt-5">
            <h1 className="text-3xl font-bold">{reference}</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
                Status:
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
          </header>
          <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 shadow-sm">
            <dl className="space-y-4">
              <Row
                label="Stars"
                value={`⭐ ${order.starsAmount.toLocaleString()}`}
              />
              <Row label="Receiving" value={order.payoutAsset} />
              <Row label="Network" value={order.payoutNetwork} />
              <Row
                label="Wallet"
                value={maskWallet(order.walletAddress)}
                mono
              />
              <Row
                label="Estimated amount"
                value={`${order.estimatedAmount} ${order.payoutAsset}`}
              />
            </dl>
          </section>
          <section className="mt-6">
            <h2 className="text-lg font-bold">Status timeline</h2>
            {detail.timeline.length ? (
              <ol className="mt-4 border-l-2 border-[var(--tg-theme-button-color,#3390ec)]/30 pl-5">
                {detail.timeline.map((event, index) => (
                  <li
                    key={`${event.label}-${event.occurredAt}`}
                    className="relative pb-6 last:pb-0"
                  >
                    <span className="absolute -left-[1.68rem] top-0.5 size-3 rounded-full bg-[var(--tg-theme-button-color,#3390ec)] ring-4 ring-[var(--app-bg)]" />
                    <p className="font-semibold">{event.label}</p>
                    <time className="mt-1 block text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.occurredAt))}
                    </time>
                    {index === detail.timeline.length - 1 ? (
                      <span className="sr-only">Current milestone</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
                The first status update will appear here shortly.
              </p>
            )}
          </section>
          <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
            {delayed ? (
              <>
                <h2 className="font-bold">Your order has been received.</h2>
                <p className="mt-4 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
                  Expected payout eligibility:
                </p>
                <p className="mt-1 font-semibold">
                  {order.settlementAvailableAt
                    ? new Intl.DateTimeFormat(undefined, {
                        dateStyle: "long",
                      }).format(new Date(order.settlementAvailableAt))
                    : "Calculated when the order is accepted"}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-bold">
                  Your order #{order.orderNumber.padStart(6, "0")} is
                  processing.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--tg-theme-hint-color,#8e8e93)]">
                  When approved for payout, your selected asset will be sent to
                  the wallet address shown above.
                </p>
                {detail.estimatedProcessingDays ? (
                  <p className="mt-3 text-sm font-semibold">
                    Estimated processing period:{" "}
                    {detail.estimatedProcessingDays} days
                  </p>
                ) : null}
              </>
            )}
          </section>
          {detail.transaction ? (
            <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
              <h2 className="font-bold">Transaction ID:</h2>
              <p className="mt-2 break-all font-mono text-sm">
                {detail.transaction.id}
              </p>
              <a
                href={detail.transaction.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border border-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-color,#3390ec)]"
              >
                View transaction
              </a>
            </section>
          ) : null}
          <div className="mt-6">
            <OrderSupportCard
              orderNumber={order.orderNumber}
              showSupportButton
            />
          </div>
          <p className="mt-4 text-center text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
            Status refreshes automatically. No automatic payout is performed.
          </p>
        </>
      ) : null}
    </main>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactNode {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">{label}:</dt>
      <dd
        className={`break-all text-right font-semibold ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
