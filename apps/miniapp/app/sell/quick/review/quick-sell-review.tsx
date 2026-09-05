"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
import {
  clearQuickSellDraft,
  loadQuickSellDraft,
  type QuickSellDraft,
  type QuickSellQuote,
} from "../../../../lib/quick-sell-client";

function mask(value: string): string {
  if (value.length <= 12) return `${value.slice(0, 4)}…${value.slice(-3)}`;
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
}
export function QuickSellReview(): React.ReactNode {
  const router = useRouter();
  const [draft, setDraft] = useState<QuickSellDraft | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const saved = loadQuickSellDraft();
    if (!saved?.walletAddress || !saved.walletConfirmed) {
      router.replace("/sell/quick/amount");
      return;
    }
    void fetch(
      `/api/sell/quick/quotes/${encodeURIComponent(saved.quote.quoteId)}`,
      { credentials: "same-origin", cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const quote = (await response.json()) as QuickSellQuote;
        setDraft({ ...saved, quote });
      })
      .catch(() => setError("Your quote is unavailable."));
  }, [router]);
  useEffect(() => {
    if (!draft) return;
    const update = (): void =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((Date.parse(draft.quote.expiresAt) - Date.now()) / 1000),
        ),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [draft]);
  async function confirm(): Promise<void> {
    if (!draft?.walletAddress || remaining <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const webApp = window.Telegram?.WebApp;
      if (!webApp || !webApp.initData) {
        throw new Error("Open this Mini App inside Telegram to confirm your order.");
      }

      const invoiceUrl =
        process.env.NEXT_PUBLIC_BOT_API_URL?.replace(/\/+$/, "") ??
        "http://localhost:3002";

      const invoiceResponse = await fetch(`${invoiceUrl}/invoices`, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData: webApp.initData,
          purpose: "quick_sell",
          stars: draft.quote.starsAmount,
          orderId: draft.quote.quoteId,
        }),
      });

      const invoiceBody = (await invoiceResponse.json().catch(() => null)) as
        | { ok?: boolean; invoiceLink?: string; error?: string }
        | null;

      if (!invoiceResponse.ok || !invoiceBody?.ok || !invoiceBody.invoiceLink) {
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

      const invoiceLink = invoiceBody.invoiceLink;
      const invoiceResult = await new Promise<"paid" | "cancelled" | "failed">(
        (resolve) => {
          invoiceWindow.openInvoice!(invoiceLink, (status) => {
            resolve(status);
          });
        },
      );

      if (invoiceResult !== "paid") {
        throw new Error(
          invoiceResult === "cancelled"
            ? "The order was cancelled before payment was confirmed."
            : "The Stars invoice could not be completed.",
        );
      }

      const response = await fetch("/api/sell/quick/orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: draft.quote.quoteId,
          walletAddress: draft.walletAddress,
          networkConfirmed: true,
        }),
      });
      const result = (await response.json()) as {
        orderNumber?: string;
        error?: string;
      };
      if (!response.ok || !result.orderNumber)
        throw new Error(result.error ?? "Unable to confirm order.");
      clearQuickSellDraft();
      router.replace(`/orders/${encodeURIComponent(result.orderNumber)}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to confirm order.",
      );
      setSubmitting(false);
    }
  }
  if (!draft && !error)
    return (
      <main className="mx-auto min-h-dvh max-w-lg animate-pulse p-5">
        <div className="h-96 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      </main>
    );
  if (!draft)
    return (
      <main className="mx-auto min-h-dvh max-w-lg p-5">
        <p className="mt-16 text-center text-red-500">{error}</p>
        <Link
          href="/sell/quick/amount"
          className="mt-5 flex min-h-12 items-center justify-center text-[var(--tg-theme-link-color,#3390ec)]"
        >
          Create a new quote
        </Link>
      </main>
    );
  const expired = remaining <= 0;
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
        Step 4 of 4
      </p>
      <h1 className="mt-1 text-3xl font-bold">Review order</h1>
      <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 shadow-sm">
        <dl className="space-y-4 text-sm">
          {[
            ["Stars amount", `⭐ ${draft.quote.starsAmount.toLocaleString()}`],
            ["Quote", `$${draft.quote.usdValue}`],
            ["Payout asset", draft.quote.payoutAsset],
            ["Network", draft.quote.payoutNetwork],
            [
              "Estimated payout",
              `${draft.quote.payoutAmount} ${draft.quote.payoutAsset}`,
            ],
            ["Order type", "Quick Sell"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                {label}
              </dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
              Destination
            </dt>
            <dd className="break-all text-right font-semibold">
              {revealed ? draft.walletAddress : mask(draft.walletAddress!)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="mt-3 min-h-10 text-sm font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
        >
          {revealed ? "Hide address" : "Reveal address"}
        </button>
        <p
          className={`mt-4 text-sm font-semibold ${expired ? "text-red-500" : "text-[var(--tg-theme-hint-color,#8e8e93)]"}`}
        >
          {expired
            ? "Quote expired"
            : `Quote expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
        </p>
      </section>
      {error ? (
        <p className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {expired ? (
        <Link
          href="/sell/quick/amount"
          className="mt-6 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)]"
        >
          Get a new quote
        </Link>
      ) : (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void confirm()}
          className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-50"
        >
          {submitting ? "Confirming…" : "Confirm Order"}
        </button>
      )}
      <p className="mt-4 text-center text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
        No automatic cryptocurrency transfer is performed.
      </p>
    </main>
  );
}
