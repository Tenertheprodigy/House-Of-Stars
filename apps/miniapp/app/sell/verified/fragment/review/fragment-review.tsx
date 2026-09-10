"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../../components/telegram-back-button";
import { getTelegramWebApp } from "../../../../../lib/telegram-webapp";
type Draft = {
  order: {
    id: string;
    order_number: number;
    stars_amount: number;
    payout_asset: string;
    payout_network: string;
    wallet_address: string;
    expected_payout_amount: string;
  };
  evidence: unknown[];
};
const mask = (value: string): string =>
  `${value.slice(0, 7)}…${value.slice(-5)}`;
export function FragmentReview({
  flow = "fragment",
}: {
  flow?: "fragment" | "apple-google" | "gifts";
}): React.ReactNode {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch(`/api/sell/verified/${flow}/draft`, { cache: "no-store" }).then(
      async (r) => {
        if (!r.ok) {
          router.replace(`/sell/verified/${flow}/details`);
          return;
        }
        setDraft((await r.json()) as Draft);
      },
    );
  }, [flow, router]);
  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const webApp = getTelegramWebApp();
      if (!webApp || !webApp.initData) {
        throw new Error(
          "Open this Mini App inside Telegram to confirm your order.",
        );
      }
      if (!draft?.order.id) {
        throw new Error("This verified order is unavailable.");
      }

      const invoiceResponse = await fetch("/api/invoices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData: webApp.initData,
          purpose: "verified_sell",
          stars: draft.order.stars_amount,
          orderId: draft.order.id,
        }),
      });

      const invoiceBody = (await invoiceResponse.json().catch(() => null)) as {
        ok?: boolean;
        invoiceLink?: string;
        error?: string;
      } | null;

      if (
        !invoiceResponse.ok ||
        !invoiceBody?.ok ||
        !invoiceBody.invoiceLink
      ) {
        throw new Error(
          invoiceBody?.error ?? "We couldn't create an invoice for this order.",
        );
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

      const invoiceResult = await new Promise<"paid" | "cancelled" | "failed">
        ((resolve) => {
          invoiceWindow.openInvoice!(invoiceBody.invoiceLink!, (status) => {
            resolve(status);
          });
        });

      if (invoiceResult !== "paid") {
        throw new Error(
          invoiceResult === "cancelled"
            ? "The order was cancelled before payment was confirmed."
            : "The Stars invoice could not be completed.",
        );
      }

      const r = await fetch(`/api/sell/verified/${flow}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = (await r.json()) as { orderNumber?: string; error?: string };
      if (!r.ok || !body.orderNumber) {
        throw new Error(body.error ?? "Submission failed.");
      }
      router.replace(`/orders/${encodeURIComponent(body.orderNumber)}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to confirm order.",
      );
      setBusy(false);
    }
  }
  if (!draft)
    return (
      <main className="mx-auto min-h-dvh max-w-lg animate-pulse p-5">
        <div className="h-96 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      </main>
    );
  const rows = [
    ["Stars", `⭐ ${draft.order.stars_amount.toLocaleString()}`],
    [
      "Source",
      flow === "apple-google"
        ? "Google / Apple"
        : flow === "gifts"
          ? "Gifts"
          : "Fragment / Other Providers",
    ],
    [
      "Quote",
      `${draft.order.expected_payout_amount} ${draft.order.payout_asset}`,
    ],
    ["Asset", draft.order.payout_asset],
    ["Network", draft.order.payout_network],
    [
      "Wallet",
      revealed ? draft.order.wallet_address : mask(draft.order.wallet_address),
    ],
    ["Evidence upload count", String(draft.evidence.length)],
  ];
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-5">
      <TelegramBackButton />
      <button
        type="button"
        onClick={() => router.back()}
        className="min-h-11 text-sm font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </button>
      <p className="mt-4 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
        {flow === "gifts" ? "Step 7 of 8" : "Step 3 of 3"}
      </p>
      <h1 className="mt-1 text-3xl font-bold">Review order</h1>
      <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
        <dl className="space-y-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">{k}</dt>
              <dd className="break-all text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="mt-3 min-h-10 text-sm text-[var(--tg-theme-link-color,#3390ec)]"
        >
          {revealed ? "Hide wallet" : "Reveal wallet"}
        </button>
      </section>
      <div className="mt-5 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">Payment required before approval</p>
        <p className="mt-2">
          Your Stars payment must be completed before the order is approved. If
          the Stars sent come from a different source than the evidence above,
          they may be refunded after Telegram&apos;s 21-day transfer window.
        </p>
      </div>
      <label className="mt-5 flex gap-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I confirm the information above is correct.</span>
      </label>
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={!confirmed || busy}
        onClick={() => void submit()}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
      >
        {busy
          ? "Processing payment…"
          : flow === "gifts"
            ? "Pay & Submit Order · Step 8"
            : "Pay & Submit Order"}
      </button>
      <p className="mt-4 text-center text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
        No cryptocurrency transfer is performed.
      </p>
    </main>
  );
}
