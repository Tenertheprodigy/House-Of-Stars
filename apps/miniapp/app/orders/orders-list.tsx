"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  RecentOrderCard,
  type RecentOrder,
} from "../../components/recent-order-card";
import { TelegramBackButton } from "../../components/telegram-back-button";

type Tab = "all" | "processing" | "completed" | "needs_action";
const tabs: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "all", label: "All" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "needs_action", label: "Needs Action" },
];
interface Response {
  orders: RecentOrder[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function OrdersList(): React.ReactNode {
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/orders?tab=${tab}&page=${page}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const body = (await response.json()) as Response & { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Unable to load orders.");
      return;
    }
    setData(body);
  }, [page, tab]);
  useEffect(() => {
    void load();
  }, [load]);
  function selectTab(value: Tab): void {
    setTab(value);
    setPage(1);
    setData(null);
  }
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-12 pt-4 sm:px-5">
      <TelegramBackButton />
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Your orders</h1>
      <div
        className="mt-5 flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Order filters"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => selectTab(item.value)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${tab === item.value ? "bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]" : "bg-[var(--tg-theme-secondary-bg-color,#fff)]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {!data && !error ? (
        <div className="mt-4 space-y-3 animate-pulse">
          <div className="h-28 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
          <div className="h-28 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        </div>
      ) : null}
      {error ? (
        <section className="mt-5 rounded-3xl bg-red-500/10 p-5 text-center text-red-500">
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
      {data ? (
        <>
          {data.orders.length ? (
            <div className="mt-4 space-y-3">
              {data.orders.map((order) => (
                <RecentOrderCard key={order.orderNumber} order={order} />
              ))}
            </div>
          ) : (
            <section className="mt-8 rounded-3xl border border-dashed border-[var(--tg-theme-hint-color,#8e8e93)]/35 p-8 text-center">
              <h2 className="font-bold">No orders yet</h2>
              <Link
                href="/sell"
                className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] px-5 font-semibold text-[var(--tg-theme-button-text-color,#fff)]"
              >
                Start a Sell Order
              </Link>
            </section>
          )}
          {data.pagination.totalPages > 1 ? (
            <nav
              className="mt-6 flex items-center justify-between"
              aria-label="Orders pagination"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((value) => value - 1);
                  setData(null);
                }}
                className="min-h-11 rounded-xl px-4 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => {
                  setPage((value) => value + 1);
                  setData(null);
                }}
                className="min-h-11 rounded-xl px-4 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
