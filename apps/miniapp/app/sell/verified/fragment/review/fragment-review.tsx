"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../../components/telegram-back-button";
type Draft = {
  order: {
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
    const r = await fetch(`/api/sell/verified/${flow}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    const body = (await r.json()) as { orderNumber?: string; error?: string };
    if (!r.ok || !body.orderNumber) {
      setError(body.error ?? "Submission failed.");
      setBusy(false);
      return;
    }
    router.replace(`/orders/${encodeURIComponent(body.orderNumber)}`);
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
          ? "Submitting…"
          : flow === "gifts"
            ? "Submit Order · Step 8"
            : "Submit Order"}
      </button>
      <p className="mt-4 text-center text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
        No cryptocurrency transfer is performed.
      </p>
    </main>
  );
}
