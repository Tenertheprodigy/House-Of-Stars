"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
import type { VerifiedSellSource } from "../../../../lib/verified-sell-source";

const sources: ReadonlyArray<{
  value: VerifiedSellSource;
  title: string;
  detail: string;
}> = [
  {
    value: "apple_google",
    title: "Google / Apple",
    detail: "Stars purchased through an app store",
  },
  {
    value: "fragment_other",
    title: "Fragment / Other Providers",
    detail: "Stars purchased from an external provider",
  },
  {
    value: "gifts",
    title: "Gifts",
    detail: "Stars received through Telegram gifts",
  },
];

export function VerifiedSourceSelection(): React.ReactNode {
  const router = useRouter();
  const [selected, setSelected] = useState<VerifiedSellSource | null>(null);
  const [pending, setPending] = useState<VerifiedSellSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/sell/verified/source", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          source: VerifiedSellSource | null;
        };
        setSelected(body.source);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function choose(source: VerifiedSellSource): Promise<void> {
    setPending(source);
    setError(null);
    try {
      const response = await fetch("/api/sell/verified/source", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const body = (await response.json()) as {
        error?: string;
        nextPath?: string;
      };
      if (!response.ok || !body.nextPath)
        throw new Error(body.error ?? "Unable to save your selection");
      setSelected(source);
      router.push(body.nextPath);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save your selection",
      );
      setPending(null);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-12 pt-4 sm:px-5">
      <TelegramBackButton />
      <Link
        href="/sell"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </Link>
      <header className="mt-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Where did you get your Stars?
        </h1>
        <p className="mt-3 leading-6 text-[var(--tg-theme-hint-color,#8e8e93)]">
          We use this information to determine the verification process for your
          order.
        </p>
      </header>
      <div className="mt-7 space-y-3" role="list" aria-label="Stars sources">
        {sources.map((source) => {
          const isPending = pending === source.value;
          const isSelected = selected === source.value;
          return (
            <button
              key={source.value}
              type="button"
              disabled={pending !== null}
              onClick={() => void choose(source.value)}
              className={`flex min-h-24 w-full items-center justify-between gap-4 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5 text-left shadow-sm transition duration-150 active:scale-[0.98] disabled:opacity-60 ${isSelected ? "ring-2 ring-[var(--tg-theme-button-color,#3390ec)]" : ""}`}
            >
              <span>
                <span className="block text-lg font-bold">{source.title}</span>
                <span className="mt-1 block text-sm leading-5 text-[var(--tg-theme-hint-color,#8e8e93)]">
                  {source.detail}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[var(--tg-theme-link-color,#3390ec)]"
              >
                {isPending ? "…" : "›"}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}
