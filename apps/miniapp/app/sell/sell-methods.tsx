"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TelegramBackButton } from "../../components/telegram-back-button";

type Eligibility =
  | { status: "eligible" }
  | { status: "processing"; reason: string }
  | { status: "not_eligible"; reason: string; eligibleAt: string };
interface SellMethodsData {
  config: { quickSellMaxUsd: number; quickSellCooldownDays: number };
  quickSell: Eligibility;
}

function eligibilityCopy(value: Eligibility): {
  label: string;
  detail?: string;
  tone: string;
} {
  if (value.status === "eligible")
    return { label: "Eligible", tone: "text-emerald-500 bg-emerald-500/10" };
  if (value.status === "processing")
    return {
      label: "Previous order still processing",
      detail: value.reason,
      tone: "text-amber-500 bg-amber-500/10",
    };
  return {
    label: "Not eligible",
    detail: `${value.reason} Eligibility returns ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value.eligibleAt))}.`,
    tone: "text-red-500 bg-red-500/10",
  };
}

export function SellMethods(): React.ReactNode {
  const [data, setData] = useState<SellMethodsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/sell/methods", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session expired. Return home to sign in again."
            : "Eligibility is unavailable right now.",
        );
      setData((await response.json()) as SellMethodsData);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Eligibility is unavailable right now.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const display = data ? eligibilityCopy(data.quickSell) : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-12 pt-4 sm:px-5">
      <TelegramBackButton />
      <Link
        href="/"
        aria-label="Back to dashboard"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </Link>
      <header className="mt-3">
        <p className="text-sm font-medium text-[var(--tg-theme-hint-color,#8e8e93)]">
          Choose a method
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Sell Telegram Stars
        </h1>
      </header>
      {!data && !error ? (
        <div
          aria-label="Loading sell methods"
          className="mt-7 space-y-4 animate-pulse"
        >
          <div className="h-72 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
          <div className="h-56 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        </div>
      ) : null}
      {error ? (
        <section className="mt-7 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-6 text-center">
          <h2 className="font-semibold">Unable to check eligibility</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--tg-theme-hint-color,#8e8e93)]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 min-h-12 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)]"
          >
            Try again
          </button>
        </section>
      ) : null}
      {data && display ? (
        <div className="mt-7 space-y-4">
          <section className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-2xl">⚡</span>
                <h2 className="mt-2 text-xl font-bold">Quick Sell</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${display.tone}`}
              >
                {display.label}
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
              For smaller eligible orders.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--tg-theme-bg-color,#f4f4f7)] p-3">
                <dt className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
                  Maximum equivalent
                </dt>
                <dd className="mt-1 font-bold">
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(data.config.quickSellMaxUsd)}
                </dd>
              </div>
              <div className="rounded-2xl bg-[var(--tg-theme-bg-color,#f4f4f7)] p-3">
                <dt className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
                  Limit
                </dt>
                <dd className="mt-1 text-sm font-bold">
                  1 completed in {data.config.quickSellCooldownDays} days
                </dd>
              </div>
            </dl>
            {display.detail ? (
              <p className="mt-4 rounded-2xl bg-[var(--tg-theme-bg-color,#f4f4f7)] p-3 text-sm leading-5 text-[var(--tg-theme-hint-color,#8e8e93)]">
                {display.detail}
              </p>
            ) : null}
            {data.quickSell.status === "eligible" ? (
              <Link
                href="/sell/quick"
                className="mt-5 flex min-h-13 items-center justify-center rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] active:scale-[0.98]"
              >
                Quick Sell
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="mt-5 min-h-13 w-full cursor-not-allowed rounded-2xl bg-[var(--tg-theme-hint-color,#8e8e93)]/25 font-semibold text-[var(--tg-theme-hint-color,#8e8e93)]"
              >
                Quick Sell
              </button>
            )}
          </section>
          <section className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 shadow-sm">
            <span className="text-2xl">🛡</span>
            <h2 className="mt-2 text-xl font-bold">Verified Sell</h2>
            <p className="mt-3 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
              For orders requiring source verification.
            </p>
            <Link
              href="/sell/verified/source"
              className="mt-5 flex min-h-13 items-center justify-center rounded-2xl border border-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-color,#3390ec)] active:scale-[0.98]"
            >
              Verified Sell
            </Link>
          </section>
        </div>
      ) : null}
    </main>
  );
}
