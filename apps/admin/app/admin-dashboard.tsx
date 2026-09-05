"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Metrics = Record<
  | "pendingReview"
  | "awaitingUser"
  | "approved"
  | "payoutQueue"
  | "delayedSettlement"
  | "completedToday",
  number
>;
type Order = {
  order_number: number;
  stars_amount: number;
  payout_asset: string;
  expected_payout_amount: string;
  status: string;
  type: string;
  source: string;
  created_at: string;
  wallet_address: string;
  users: { telegram_user_id: number; username: string | null } | null;
};
type OrdersResponse = {
  orders: Order[];
  pagination: { page: number; totalPages: number; total: number };
};

const metricLabels: Array<[keyof Metrics, string]> = [
  ["pendingReview", "Pending Review"],
  ["awaitingUser", "Awaiting User"],
  ["approved", "Approved"],
  ["payoutQueue", "Payout Queue"],
  ["delayedSettlement", "Delayed Settlement"],
  ["completedToday", "Completed Today"],
];

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [error, setError] = useState("");
  const [params, setParams] = useState({
    search: "",
    status: "",
    type: "",
    source: "",
    asset: "",
    from: "",
    to: "",
    page: "1",
  });

  const load = useCallback(async () => {
    setError("");
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value),
    );
    const [metricsResponse, ordersResponse] = await Promise.all([
      fetch("/api/admin/dashboard", { cache: "no-store" }),
      fetch(`/api/admin/orders?${query}`, { cache: "no-store" }),
    ]);
    if (metricsResponse.status === 401 || metricsResponse.status === 403) {
      window.location.assign("/login");
      return;
    }
    if (!metricsResponse.ok || !ordersResponse.ok) {
      setError("Unable to load the admin dashboard.");
      return;
    }
    setMetrics((await metricsResponse.json()).metrics as Metrics);
    setData((await ordersResponse.json()) as OrdersResponse);
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);
  const update = (key: keyof typeof params, value: string) =>
    setParams((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : "1",
    }));

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-700">
              Private administration
            </p>
            <h1 className="text-3xl font-bold">Orders dashboard</h1>
          </div>
          <button
            className="rounded-lg border bg-white px-4 py-2"
            onClick={async () => {
              await fetch("/api/admin/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}
          >
            Sign out
          </button>
        </header>
        {error && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
        )}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {metricLabels.map(([key, label]) => (
            <article
              key={key}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{metrics?.[key] ?? "—"}</p>
            </article>
          ))}
        </section>
        <section className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <input
              aria-label="Search orders"
              className="rounded-lg border px-3 py-2 md:col-span-2"
              placeholder="Order, Telegram ID, username, wallet"
              value={params.search}
              onChange={(e) => update("search", e.target.value)}
            />
            <select
              aria-label="Status"
              className="rounded-lg border px-3 py-2"
              value={params.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "draft",
                "awaiting_payment",
                "payment_pending",
                "payment_received",
                "awaiting_evidence",
                "submitted",
                "under_review",
                "approved",
                "rejected",
                "payout_queued",
                "payout_broadcast",
                "paid",
                "cancelled",
                "refunded",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Type"
              className="rounded-lg border px-3 py-2"
              value={params.type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">All types</option>
              <option value="quick">Quick</option>
              <option value="verified">Verified</option>
            </select>
            <select
              aria-label="Source"
              className="rounded-lg border px-3 py-2"
              value={params.source}
              onChange={(e) => update("source", e.target.value)}
            >
              <option value="">All sources</option>
              <option value="apple_google">Google / Apple</option>
              <option value="fragment_other">Fragment / Other</option>
              <option value="gifts">Gifts</option>
              <option value="unknown">Unknown</option>
            </select>
            <input
              aria-label="Payout asset"
              className="rounded-lg border px-3 py-2"
              placeholder="Asset"
              value={params.asset}
              onChange={(e) => update("asset", e.target.value.toUpperCase())}
            />
            <input
              aria-label="Created from"
              type="date"
              className="rounded-lg border px-3 py-2"
              value={params.from}
              onChange={(e) => update("from", e.target.value)}
            />
            <input
              aria-label="Created to"
              type="date"
              className="rounded-lg border px-3 py-2"
              value={params.to}
              onChange={(e) => update("to", e.target.value)}
            />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  {[
                    "Order",
                    "User",
                    "Type",
                    "Source",
                    "Stars",
                    "Payout Asset",
                    "Payout Amount",
                    "Status",
                    "Created",
                    "Actions",
                  ].map((label) => (
                    <th className="px-3 py-3 font-medium" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((order) => (
                  <tr
                    className="border-b last:border-0"
                    key={order.order_number}
                  >
                    <td className="px-3 py-4 font-semibold">
                      #{String(order.order_number).padStart(6, "0")}
                    </td>
                    <td className="px-3 py-4">
                      {order.users?.username
                        ? `@${order.users.username}`
                        : (order.users?.telegram_user_id ?? "—")}
                    </td>
                    <td className="px-3 py-4">{order.type}</td>
                    <td className="px-3 py-4">{order.source}</td>
                    <td className="px-3 py-4">
                      {order.stars_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-4">{order.payout_asset}</td>
                    <td className="px-3 py-4">
                      {order.expected_payout_amount}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        className="font-semibold text-indigo-700"
                        href={`/orders/${order.order_number}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.orders.length === 0 && (
            <p className="py-10 text-center text-slate-500">
              No matching orders.
            </p>
          )}
          <footer className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {data ? `${data.pagination.total} orders` : "Loading…"}
            </p>
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
                disabled={!data || data.pagination.page <= 1}
                onClick={() =>
                  update("page", String((data?.pagination.page ?? 2) - 1))
                }
              >
                Previous
              </button>
              <span className="text-sm">
                Page {data?.pagination.page ?? 1} of{" "}
                {data?.pagination.totalPages ?? 1}
              </span>
              <button
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
                disabled={
                  !data || data.pagination.page >= data.pagination.totalPages
                }
                onClick={() =>
                  update("page", String((data?.pagination.page ?? 0) + 1))
                }
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
