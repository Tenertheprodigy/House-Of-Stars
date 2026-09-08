/* eslint-disable @next/next/no-img-element -- evidence uses expiring signed URLs that must not be proxied or cached by the image optimizer */
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Evidence = {
  id: string;
  evidenceType: string;
  uploadedAt: string;
  sha256: string | null;
  signedUrl: string | null;
};
type Event = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: { reason?: string | null };
  created_at: string;
};
type Order = {
  id: string;
  order_number: number;
  stars_amount: number;
  payout_asset: string;
  payout_network: string;
  wallet_address: string;
  expected_payout_amount: string;
  status: string;
  type: string;
  source: string;
  settlement_available_at: string | null;
  created_at: string;
  quote_id: string | null;
  users: {
    telegram_user_id: number;
    username: string | null;
    first_name: string;
  } | null;
  order_quotes: {
    id: string;
    stars_amount: number;
    payout_asset: string;
    payout_network: string;
    expected_payout_amount: string;
    expires_at: string;
    created_at: string;
  } | null;
  order_events: Event[];
  payouts: Array<{ id: string; status: string; created_at: string }>;
  evidence: Evidence[];
  priorOrderCount: number;
  priorCompletedOrderCount: number;
  payoutEligibility: { eligible: boolean; reason: string };
};
type AdminAction =
  | "start_review"
  | "approve"
  | "reject"
  | "request_more_evidence"
  | "add_note"
  | "queue_payout";

export default function AdminOrderPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Evidence | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
      { cache: "no-store" },
    );
    if (response.status === 401 || response.status === 403) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) {
      setError("Unable to load this order.");
      return;
    }
    setOrder((await response.json()).order as Order);
    setError("");
  }, [orderNumber]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: AdminAction) {
    const requiresReason =
      action === "reject" ||
      action === "request_more_evidence" ||
      action === "add_note";
    const reason = requiresReason
      ? window
          .prompt(action === "add_note" ? "Internal note" : "Reason")
          ?.trim()
      : undefined;
    if (requiresReason && !reason) return;
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/admin/orders/${encodeURIComponent(orderNumber)}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      },
    );
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "The action could not be completed.");
      return;
    }
    await load();
  }

  if (!order)
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-6xl">
          <Link className="font-semibold text-indigo-700" href="/">
            ← Dashboard
          </Link>
          <p className="mt-8">{error || "Loading…"}</p>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link className="font-semibold text-indigo-700" href="/">
          ← Dashboard
        </Link>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Administrative order view</p>
            <h1 className="text-3xl font-bold">
              Order #{String(order.order_number).padStart(6, "0")}
            </h1>
          </div>
          <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800">
            {order.status}
          </span>
        </header>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>
        )}
        <Section title="Order summary">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Public order number"
              value={`#${String(order.order_number).padStart(6, "0")}`}
            />
            <Field label="Internal UUID" value={order.id} />
            <Field label="Creation time" value={formatDate(order.created_at)} />
            <Field label="Order type" value={order.type} />
            <Field label="Source" value={order.source} />
            <Field
              label="Stars amount"
              value={`⭐ ${order.stars_amount.toLocaleString()}`}
            />
            <Field
              label="Quote"
              value={
                order.order_quotes
                  ? `${order.order_quotes.id} · ${order.order_quotes.expected_payout_amount} ${order.order_quotes.payout_asset} · expires ${formatDate(order.order_quotes.expires_at)}`
                  : "No quote"
              }
            />
            <Field label="Payout asset" value={order.payout_asset} />
            <Field label="Network" value={order.payout_network} />
            <Field
              label="Payout state"
              value={order.payouts[0]?.status ?? "Not queued"}
            />
            <Field label="Wallet address" value={order.wallet_address} />
            <Field
              label="Expected payout"
              value={`${order.expected_payout_amount} ${order.payout_asset}`}
            />
            <Field
              label="Settlement date"
              value={
                order.settlement_available_at
                  ? formatDate(order.settlement_available_at)
                  : "No settlement hold"
              }
            />
            <Field label="Current status" value={order.status} />
          </dl>
        </Section>
        <Section title="User">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Telegram user ID"
              value={String(order.users?.telegram_user_id ?? "—")}
            />
            <Field
              label="Username"
              value={order.users?.username ? `@${order.users.username}` : "—"}
            />
            <Field label="First name" value={order.users?.first_name ?? "—"} />
            <Field label="Prior orders" value={String(order.priorOrderCount)} />
            <Field
              label="Prior completed orders"
              value={String(order.priorCompletedOrderCount)}
            />
          </dl>
        </Section>
        <Section title="Evidence">
          {order.evidence.length === 0 ? (
            <p className="text-slate-500">No evidence uploaded.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {order.evidence.map((item) => (
                <article
                  className="overflow-hidden rounded-xl border"
                  key={item.id}
                >
                  <button
                    className="block aspect-video w-full bg-slate-200"
                    disabled={!item.signedUrl}
                    onClick={() => setViewer(item)}
                  >
                    {item.signedUrl ? (
                      <img
                        className="h-full w-full object-cover"
                        src={item.signedUrl}
                        alt={item.evidenceType}
                      />
                    ) : (
                      <span>Preview unavailable</span>
                    )}
                  </button>
                  <div className="space-y-1 p-3 text-sm">
                    <p className="font-semibold">{item.evidenceType}</p>
                    <p>{formatDate(item.uploadedAt)}</p>
                    <p className="break-all font-mono text-xs text-slate-500">
                      SHA-256: {item.sha256 ?? "Unavailable"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
        <Section title="Admin actions">
          <div className="flex flex-wrap gap-3">
            <Action
              disabled={
                busy ||
                !["payment_received", "submitted"].includes(order.status)
              }
              onClick={() => void act("start_review")}
            >
              Start Review
            </Action>
            <Action
              disabled={busy || order.status !== "under_review"}
              onClick={() => void act("approve")}
            >
              Approve
            </Action>
            <Action
              disabled={
                busy ||
                !["submitted", "under_review", "awaiting_evidence"].includes(
                  order.status,
                )
              }
              onClick={() => void act("reject")}
            >
              Reject
            </Action>
            <Action
              disabled={
                busy || !["submitted", "under_review"].includes(order.status)
              }
              onClick={() => void act("request_more_evidence")}
            >
              Request More Evidence
            </Action>
            <Action disabled={busy} onClick={() => void act("add_note")}>
              Add Internal Note
            </Action>
          </div>
        </Section>
        <Section title="Payout">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Eligibility"
              value={
                order.payoutEligibility.eligible
                  ? "Payout Eligible"
                  : "Not Eligible"
              }
            />
            <Field label="Reason" value={order.payoutEligibility.reason} />
            <Field label="Destination" value={order.wallet_address} />
            <Field
              label="Amount"
              value={`${order.expected_payout_amount} ${order.payout_asset}`}
            />
            <Field label="Network" value={order.payout_network} />
          </div>
          {order.payoutEligibility.eligible && (
            <Action
              className="mt-5 bg-emerald-700 text-white"
              disabled={busy}
              onClick={() => void act("queue_payout")}
            >
              Queue Payout
            </Action>
          )}
          <p className="mt-4 text-sm text-slate-500">
            Queueing creates a workflow record only. No cryptocurrency is signed
            or transmitted.
          </p>
        </Section>
        <Section title="Audit events">
          <ol className="space-y-3">
            {order.order_events.map((event) => (
              <li className="border-l-2 border-indigo-300 pl-4" key={event.id}>
                <p className="font-medium">
                  {event.event_type}: {event.from_status ?? "—"} →{" "}
                  {event.to_status ?? "—"}
                </p>
                {event.payload?.reason && (
                  <p className="text-sm">Reason: {event.payload.reason}</p>
                )}
                <p className="text-sm text-slate-500">
                  {formatDate(event.created_at)}
                </p>
              </li>
            ))}
          </ol>
        </Section>
        {viewer?.signedUrl && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4"
          >
            <button
              className="self-end rounded-lg bg-white px-4 py-2 font-semibold"
              onClick={() => setViewer(null)}
            >
              Close
            </button>
            <img
              className="min-h-0 flex-1 object-contain"
              src={viewer.signedUrl}
              alt={viewer.evidenceType}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-5 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
function Action({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
