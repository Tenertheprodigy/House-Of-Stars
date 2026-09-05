"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
import {
  loadQuickSellDraft,
  saveQuickSellDraft,
  type QuickSellDraft,
  type QuickSellQuote,
} from "../../../../lib/quick-sell-client";

interface Asset {
  asset: string;
  network: string;
}
type Validation =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; normalizedAddress: string }
  | { status: "invalid" | "unsupported_network"; reason: string };
export function QuickSellPayout(): React.ReactNode {
  const router = useRouter();
  const [draft, setDraft] = useState<QuickSellDraft | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [address, setAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState<Validation>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    const saved = loadQuickSellDraft();
    if (!saved || Date.parse(saved.quote.expiresAt) <= Date.now()) {
      router.replace("/sell/quick/amount");
      return;
    }
    setDraft(saved);
    setAddress(saved.walletAddress ?? "");
    setConfirmed(saved.walletConfirmed ?? false);
    void fetch("/api/sell/quick/assets", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setAssets(((await response.json()) as { assets: Asset[] }).assets);
      })
      .catch(() => setError("Unable to load payout methods."));
  }, [router]);
  async function changeAsset(assetName: string): Promise<void> {
    if (!draft || assetName === draft.quote.payoutAsset) return;
    setChanging(true);
    setError(null);
    try {
      const response = await fetch("/api/sell/quick/quotes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          starsAmount: draft.quote.starsAmount,
          payoutAsset: assetName,
        }),
      });
      const value = (await response.json()) as QuickSellQuote & {
        error?: string;
      };
      if (!response.ok) throw new Error(value.error);
      const next = { quote: value };
      setDraft(next);
      saveQuickSellDraft(next);
      setValidation({ status: "idle" });
      setConfirmed(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update quote.",
      );
    } finally {
      setChanging(false);
    }
  }
  async function validate(): Promise<void> {
    if (!draft || !address.trim()) return;
    setValidation({ status: "checking" });
    const response = await fetch("/api/sell/quick/wallet", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asset: draft.quote.payoutAsset,
        network: draft.quote.payoutNetwork,
        address,
      }),
    });
    const result = (await response.json()) as Exclude<
      Validation,
      { status: "idle" | "checking" }
    >;
    setValidation(result);
  }
  if (!draft)
    return (
      <main className="mx-auto min-h-dvh max-w-lg animate-pulse p-5">
        <div className="h-96 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      </main>
    );
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
        Steps 2–3 of 4
      </p>
      <h1 className="mt-1 text-3xl font-bold">
        How would you like to receive your payout?
      </h1>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {assets.map((item) => (
          <button
            key={`${item.asset}-${item.network}`}
            type="button"
            disabled={changing}
            onClick={() => void changeAsset(item.asset)}
            className={`min-h-24 rounded-2xl border p-4 text-left transition ${draft.quote.payoutAsset === item.asset ? "border-[var(--tg-theme-button-color,#3390ec)] bg-[var(--tg-theme-button-color,#3390ec)]/10" : "border-transparent bg-[var(--tg-theme-secondary-bg-color,#fff)]"}`}
          >
            <span className="block text-lg font-bold">{item.asset}</span>
            <span className="mt-1 block text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
              Network: {item.network}
            </span>
          </button>
        ))}
      </div>
      <section className="mt-7">
        <h2 className="text-xl font-bold">Wallet address</h2>
        <p className="mt-1 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
          {draft.quote.payoutAsset} on {draft.quote.payoutNetwork}
        </p>
        <input
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setValidation({ status: "idle" });
            setConfirmed(false);
          }}
          placeholder="Enter wallet address"
          className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-4 outline-none ring-[var(--tg-theme-button-color,#3390ec)] focus:ring-2"
        />
        <button
          type="button"
          disabled={!address.trim() || validation.status === "checking"}
          onClick={() => void validate()}
          className="mt-3 min-h-12 w-full rounded-2xl border border-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-color,#3390ec)] disabled:opacity-40"
        >
          Validate address
        </button>
        {validation.status === "valid" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-500">
            ✓ Valid address
          </p>
        ) : null}
        {validation.status === "invalid" ? (
          <p className="mt-3 text-sm font-semibold text-red-500">
            Invalid address — {validation.reason}
          </p>
        ) : null}
        {validation.status === "unsupported_network" ? (
          <p className="mt-3 text-sm font-semibold text-red-500">
            Unsupported network — {validation.reason}
          </p>
        ) : null}
        <label className="mt-5 flex min-h-14 items-start gap-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={validation.status !== "valid"}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-5 accent-[var(--tg-theme-button-color,#3390ec)]"
          />
          <span className="text-sm leading-5">
            I have checked that this address supports the selected network.
          </span>
        </label>
      </section>
      {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={validation.status !== "valid" || !confirmed || changing}
        onClick={() => {
          if (validation.status === "valid") {
            const next = {
              ...draft,
              walletAddress: validation.normalizedAddress,
              walletConfirmed: true,
            };
            saveQuickSellDraft(next);
            router.push("/sell/quick/review");
          }
        }}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
