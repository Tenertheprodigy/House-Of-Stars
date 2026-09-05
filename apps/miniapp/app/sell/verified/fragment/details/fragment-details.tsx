"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../../components/telegram-back-button";
type Asset = { asset: string; network: string };
type Validation =
  | { status: "idle" | "checking" }
  | { status: "valid"; normalizedAddress: string }
  | { status: "invalid" | "unsupported_network"; reason: string };
export function FragmentDetails({
  flow = "fragment",
}: {
  flow?: "fragment" | "apple-google";
}): React.ReactNode {
  const router = useRouter();
  const [stars, setStars] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [address, setAddress] = useState("");
  const [validation, setValidation] = useState<Validation>({ status: "idle" });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    void fetch("/api/sell/quick/assets", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const values = ((await r.json()) as { assets: Asset[] }).assets;
        setAssets(values);
        setAsset(values[0] ?? null);
      })
      .catch(() => setError("Unable to load payout assets."));
  }, []);
  async function validate(): Promise<void> {
    if (!asset || !address.trim()) return;
    setValidation({ status: "checking" });
    const r = await fetch("/api/sell/quick/wallet", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asset: asset.asset,
        network: asset.network,
        address,
      }),
    });
    setValidation(
      (await r.json()) as Exclude<Validation, { status: "idle" | "checking" }>,
    );
  }
  async function proceed(): Promise<void> {
    if (!asset || validation.status !== "valid" || !confirmed) return;
    setSubmitting(true);
    setError(null);
    const r = await fetch(`/api/sell/verified/${flow}/details`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        starsAmount: Number(stars),
        payoutAsset: asset.asset,
        walletAddress: validation.normalizedAddress,
        networkConfirmed: true,
      }),
    });
    const body = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(body.error ?? "Unable to save details.");
      setSubmitting(false);
      return;
    }
    router.push(`/sell/verified/${flow}/evidence`);
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
      <p className="mt-4 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
        Step 1 of 3
      </p>
      <h1 className="mt-1 text-3xl font-bold">Order details</h1>
      <label className="mt-6 block font-semibold">
        How many Stars do you want to sell?
        <input
          inputMode="numeric"
          value={stars}
          onChange={(e) => setStars(e.target.value.replace(/\D/g, ""))}
          className="mt-2 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-4 text-xl outline-none"
          placeholder="⭐ 0"
        />
      </label>
      <h2 className="mt-6 font-semibold">Payout asset</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {assets.map((item) => (
          <button
            type="button"
            key={item.asset}
            onClick={() => {
              setAsset(item);
              setValidation({ status: "idle" });
              setConfirmed(false);
            }}
            className={`min-h-20 rounded-2xl p-4 text-left ${asset?.asset === item.asset ? "ring-2 ring-[var(--tg-theme-button-color,#3390ec)]" : ""} bg-[var(--tg-theme-secondary-bg-color,#fff)]`}
          >
            <b className="block">{item.asset}</b>
            <span className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
              Network: {item.network}
            </span>
          </button>
        ))}
      </div>
      <label className="mt-6 block font-semibold">
        Wallet address
        <input
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setValidation({ status: "idle" });
            setConfirmed(false);
          }}
          className="mt-2 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-4 outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() => void validate()}
        disabled={!address || validation.status === "checking"}
        className="mt-3 min-h-12 w-full rounded-2xl border border-[var(--tg-theme-button-color,#3390ec)] font-semibold disabled:opacity-40"
      >
        Validate address
      </button>
      {validation.status === "valid" ? (
        <p className="mt-2 text-emerald-500">✓ Valid address</p>
      ) : null}
      {validation.status === "invalid" ||
      validation.status === "unsupported_network" ? (
        <p className="mt-2 text-red-500">
          {validation.status === "unsupported_network"
            ? "Unsupported network"
            : "Invalid address"}{" "}
          — {validation.reason}
        </p>
      ) : null}
      <label className="mt-4 flex gap-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={validation.status !== "valid"}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I have checked that this address supports the selected network.
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-4 text-red-500">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void proceed()}
        disabled={
          !Number(stars) ||
          validation.status !== "valid" ||
          !confirmed ||
          submitting
        }
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
      >
        {submitting ? "Creating quote…" : "Continue"}
      </button>
    </main>
  );
}
