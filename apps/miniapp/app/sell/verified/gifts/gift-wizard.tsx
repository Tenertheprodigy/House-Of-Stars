"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramBackButton } from "../../../../components/telegram-back-button";
import { giftSellContent } from "../../../../config/verified-sell-content";
type Quote = {
  quoteId: string;
  starsAmount: number;
  usdValue: string;
  payoutAsset: string;
  payoutNetwork: string;
  payoutAmount: string;
  exchangeRate: string;
  expiresAt: string;
};
type Asset = { asset: string; network: string };
function Shell({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  const router = useRouter();
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
        {step}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
async function loadQuote(): Promise<Quote> {
  const response = await fetch("/api/sell/verified/gifts/quote", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Quote unavailable.");
  return response.json() as Promise<Quote>;
}
export function GiftSettlement(): React.ReactNode {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/sell/verified/gifts/settlement", {
      cache: "no-store",
    }).then(async (r) => {
      if (!r.ok) return;
      const data = (await r.json()) as {
        accepted: boolean;
        settlementDays: number;
      };
      setChecked(data.accepted);
      setDays(data.settlementDays);
    });
  }, []);
  async function next(): Promise<void> {
    const r = await fetch("/api/sell/verified/gifts/settlement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acknowledged: true }),
    });
    if (!r.ok) {
      setError("Unable to save acknowledgement.");
      return;
    }
    router.push("/sell/verified/gifts/amount");
  }
  return (
    <Shell step="Step 1 of 8" title={giftSellContent.settlement.title}>
      {giftSellContent.settlement.paragraphs.map((text) => (
        <p key={text} className="mt-4 leading-6">
          {text}
        </p>
      ))}
      <div className="mt-5 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
        <span className="text-sm">Expected settlement period</span>
        <b className="mt-1 block text-xl">{days ?? "—"} days</b>
      </div>
      <label className="mt-5 flex gap-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>{giftSellContent.settlement.acknowledgement}</span>
      </label>
      {error ? <p className="mt-3 text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={!checked}
        onClick={() => void next()}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
      >
        Continue
      </button>
    </Shell>
  );
}
export function GiftAmount(): React.ReactNode {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function next(): Promise<void> {
    setBusy(true);
    const r = await fetch("/api/sell/verified/gifts/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starsAmount: Number(amount) }),
    });
    const body = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(body.error ?? "Unable to create quote.");
      setBusy(false);
      return;
    }
    router.push("/sell/verified/gifts/quote");
  }
  return (
    <Shell step="Step 2 of 8" title="How many Stars do you want to sell?">
      <input
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        placeholder="⭐ 0"
        className="mt-7 min-h-20 w-full rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-5 text-3xl font-bold outline-none"
      />
      {error ? <p className="mt-3 text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={!Number(amount) || busy}
        onClick={() => void next()}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-white disabled:opacity-40"
      >
        Create quote
      </button>
    </Shell>
  );
}
function QuoteCard({ quote }: { quote: Quote }): React.ReactNode {
  return (
    <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt>Stars</dt>
          <dd>⭐ {quote.starsAmount.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Estimated value</dt>
          <dd>${quote.usdValue}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Rate</dt>
          <dd>
            ${quote.exchangeRate} / {quote.payoutAsset}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>You receive</dt>
          <dd>
            {quote.payoutAmount} {quote.payoutAsset}
          </dd>
        </div>
      </dl>
    </section>
  );
}
export function GiftQuote(): React.ReactNode {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    void loadQuote()
      .then(setQuote)
      .catch(() => router.replace("/sell/verified/gifts/amount"));
  }, [router]);
  return (
    <Shell step="Step 3 of 8" title="Your quote">
      {quote ? (
        <>
          <QuoteCard quote={quote} />
          <button
            type="button"
            onClick={() => router.push("/sell/verified/gifts/payout")}
            className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-white"
          >
            Continue
          </button>
        </>
      ) : (
        <div className="mt-6 h-44 animate-pulse rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      )}
    </Shell>
  );
}
export function GiftPayout(): React.ReactNode {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    void Promise.all([
      loadQuote(),
      fetch("/api/sell/quick/assets").then(
        (r) => r.json() as Promise<{ assets: Asset[] }>,
      ),
    ])
      .then(([q, a]) => {
        setQuote(q);
        setAssets(a.assets);
      })
      .catch(() => router.replace("/sell/verified/gifts/amount"));
  }, [router]);
  async function choose(asset: string): Promise<void> {
    if (!quote) return;
    const r = await fetch("/api/sell/verified/gifts/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        starsAmount: quote.starsAmount,
        payoutAsset: asset,
      }),
    });
    if (r.ok) setQuote((await r.json()) as Quote);
  }
  return (
    <Shell step="Step 4 of 8" title="Choose payout method">
      <div className="mt-6 grid grid-cols-2 gap-3">
        {assets.map((a) => (
          <button
            type="button"
            key={a.asset}
            onClick={() => void choose(a.asset)}
            className={`min-h-24 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4 text-left ${quote?.payoutAsset === a.asset ? "ring-2 ring-[var(--tg-theme-button-color,#3390ec)]" : ""}`}
          >
            <b className="block">{a.asset}</b>
            <span className="text-sm">Network: {a.network}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!quote}
        onClick={() => router.push("/sell/verified/gifts/wallet")}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </Shell>
  );
}
export function GiftWallet(): React.ReactNode {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [address, setAddress] = useState("");
  const [valid, setValid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void loadQuote()
      .then(setQuote)
      .catch(() => router.replace("/sell/verified/gifts/amount"));
  }, [router]);
  async function validate(): Promise<void> {
    if (!quote) return;
    const r = await fetch("/api/sell/quick/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asset: quote.payoutAsset,
        network: quote.payoutNetwork,
        address,
      }),
    });
    const body = (await r.json()) as { status: string; reason?: string };
    setValid(body.status === "valid");
    setError(
      body.status === "valid" ? null : (body.reason ?? "Invalid wallet."),
    );
  }
  async function next(): Promise<void> {
    const r = await fetch("/api/sell/verified/gifts/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, networkConfirmed: true }),
    });
    const body = (await r.json()) as { error?: string };
    if (!r.ok) {
      setError(body.error ?? "Unable to save wallet.");
      return;
    }
    router.push("/sell/verified/gifts/evidence");
  }
  return (
    <Shell step="Step 5 of 8" title="Wallet address">
      <p className="mt-3 text-sm">
        {quote?.payoutAsset} on {quote?.payoutNetwork}
      </p>
      <input
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          setValid(false);
          setConfirmed(false);
        }}
        className="mt-5 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-4 outline-none"
      />
      <button
        type="button"
        onClick={() => void validate()}
        className="mt-3 min-h-12 w-full rounded-2xl border"
      >
        Validate address
      </button>
      {valid ? <p className="mt-2 text-emerald-500">✓ Valid address</p> : null}
      {error ? <p className="mt-2 text-red-500">{error}</p> : null}
      <label className="mt-4 flex gap-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4">
        <input
          type="checkbox"
          disabled={!valid}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I have checked that this address supports the selected network.
        </span>
      </label>
      <button
        type="button"
        disabled={!valid || !confirmed}
        onClick={() => void next()}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </Shell>
  );
}
