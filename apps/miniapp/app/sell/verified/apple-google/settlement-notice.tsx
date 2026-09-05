"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
export function AppleGoogleSettlementNotice(): React.ReactNode {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/sell/verified/apple-google/notice", {
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return;
      const value = (await response.json()) as {
        accepted: boolean;
        settlementDays: number;
      };
      setChecked(value.accepted);
      setDays(value.settlementDays);
    });
  }, []);
  async function proceed(): Promise<void> {
    if (!checked) return;
    setBusy(true);
    const response = await fetch("/api/sell/verified/apple-google/notice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acknowledged: true }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Unable to save your acknowledgement.");
      setBusy(false);
      return;
    }
    router.push("/sell/verified/apple-google/details");
  }
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
      <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-6 shadow-sm">
        <div className="text-3xl" aria-hidden="true">
          ⏳
        </div>
        <h1 className="mt-3 text-3xl font-bold">Extended settlement period</h1>
        <p className="mt-4 leading-6">
          Orders involving Stars purchased through Apple or Google are subject
          to an extended settlement period under this service&apos;s risk
          policy.
        </p>
        <p className="mt-3 leading-6">
          Eligible orders are scheduled for payout {days ?? 21} days after
          acceptance.
        </p>
        <div className="mt-6 rounded-2xl bg-[var(--tg-theme-bg-color,#f4f4f7)] p-4">
          <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
            Expected waiting period:
          </p>
          <p className="mt-1 text-xl font-bold">{days ?? 21} days</p>
        </div>
        <label className="mt-5 flex min-h-16 items-start gap-3 rounded-2xl border border-[var(--tg-theme-hint-color,#8e8e93)]/20 p-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-0.5 size-5"
          />
          <span>
            I understand that this order will not be immediately eligible for
            payout.
          </span>
        </label>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!checked || busy}
          onClick={() => void proceed()}
          className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </section>
    </main>
  );
}
