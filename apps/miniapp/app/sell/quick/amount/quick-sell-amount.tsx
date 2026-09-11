"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
import {
  saveQuickSellDraft,
  type QuickSellQuote,
} from "../../../../lib/quick-sell-client";

export function QuickSellAmount(): React.ReactNode {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuickSellQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!quote) return;
    const update = (): void => {
      const next = Math.max(
        0,
        Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000),
      );
      setRemaining(next);
      if (next === 0) {
        setQuote(null);
        setRefresh((value) => value + 1);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote]);
  useEffect(() => {
    const parsed = Number(amount);
    setQuote(null);
    setError(null);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch("/api/sell/quick/quotes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ starsAmount: parsed }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const value = (await response.json()) as QuickSellQuote & {
            error?: string;
          };
          if (!response.ok)
            throw new Error(value.error ?? "Unable to create quote.");
          setQuote(value);
        })
        .catch((reason: unknown) => {
          if (!(reason instanceof DOMException && reason.name === "AbortError"))
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to create quote.",
            );
        })
        .finally(() => setLoading(false));
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [amount, refresh]);
  const expired = !!quote && remaining === 0;
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
        Step 1 of 4
      </p>
      <h1 className="mt-1 text-3xl font-bold">How many Stars?</h1>
      <label className="mt-7 flex min-h-20 items-center rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-5 text-3xl font-bold shadow-sm">
        <span>⭐</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
          aria-label="Stars amount"
          placeholder="0"
          className="ml-3 min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--tg-theme-hint-color,#8e8e93)]"
        />
      </label>
      {loading ? (
        <div className="mt-5 h-44 animate-pulse rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500"
        >
          {error}
        </p>
      ) : null}
      {quote ? (
        <section className="mt-5 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 shadow-sm">
          <div className="flex justify-between">
            <h2 className="font-semibold">Your quote</h2>
            <span
              className={
                expired
                  ? "text-red-500"
                  : "text-[var(--tg-theme-hint-color,#8e8e93)]"
              }
            >
              {expired
                ? "Refreshing…"
                : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
            </span>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                Stars
              </dt>
              <dd className="font-semibold">
                ⭐ {quote.starsAmount.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                Rate
              </dt>
              <dd className="font-semibold">${quote.starUsdRate} per Star</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                Gross USD value
              </dt>
              <dd className="font-semibold">${quote.usdValue}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                Platform fee ({quote.platformFeePercent}%)
              </dt>
              <dd className="font-semibold">
                -${Number(quote.fees).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                Net payout value
              </dt>
              <dd className="font-semibold">${quote.netUsdValue}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                {quote.payoutAsset} price
              </dt>
              <dd className="font-semibold">
                $
                {Number(quote.exchangeRate).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                You receive
              </dt>
              <dd className="font-semibold">
                {quote.payoutAmount} {quote.payoutAsset}
              </dd>
            </div>
            {quote.priceUpdatedAt ? (
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-[var(--tg-theme-hint-color,#8e8e93)]">
                  Price timestamp
                </dt>
                <dd className="text-right">
                  {new Date(quote.priceUpdatedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <button
        type="button"
        disabled={!quote || expired || loading}
        onClick={() => {
          if (quote) {
            saveQuickSellDraft({ quote });
            router.push("/sell/quick/payout");
          }
        }}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
