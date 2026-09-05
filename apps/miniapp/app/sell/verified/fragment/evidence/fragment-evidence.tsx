"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SupportContacts } from "../../../../../components/support";
import { TelegramBackButton } from "../../../../../components/telegram-back-button";
import { giftSellContent } from "../../../../../config/verified-sell-content";
type Evidence = { id: string; evidence_type: string; size: number };
export function FragmentEvidence({
  flow = "fragment",
}: {
  flow?: "fragment" | "apple-google" | "gifts";
}): React.ReactNode {
  const router = useRouter();
  const [items, setItems] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch(`/api/sell/verified/${flow}/draft`, { cache: "no-store" }).then(
      async (r) => {
        if (!r.ok) {
          router.replace(`/sell/verified/${flow}/details`);
          return;
        }
        setItems(((await r.json()) as { evidence: Evidence[] }).evidence);
      },
    );
  }, [flow, router]);
  async function upload(
    files: FileList | null,
    evidenceType: string,
  ): Promise<void> {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      form.set("evidenceType", evidenceType);
      const r = await fetch(`/api/sell/verified/${flow}/evidence`, {
        method: "POST",
        body: form,
      });
      const body = (await r.json()) as { evidence?: Evidence; error?: string };
      if (!r.ok || !body.evidence) {
        setError(body.error ?? "Upload failed.");
        break;
      }
      setItems((current) => [...current, body.evidence!]);
    }
    setBusy(false);
  }
  async function viewEvidence(id: string): Promise<void> {
    const response = await fetch(
      `/api/sell/verified/${flow}/evidence/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      setError(body.error ?? "Unable to open evidence.");
      return;
    }
    window.open(body.url, "_blank", "noopener,noreferrer");
  }
  const evidenceItems =
    flow === "gifts"
      ? giftSellContent.evidence.items
      : [
          {
            type: "stars_transaction_history",
            title: "Stars transaction history",
            instructions: "Upload the relevant Stars transaction history.",
            multiple: true,
          },
          {
            type: "purchase_receipt",
            title: "Purchase / receipt confirmation",
            instructions: "Upload the Telegram message or purchase receipt.",
            multiple: false,
          },
        ];
  const requiredComplete = evidenceItems
    .filter((entry) => !("optional" in entry && entry.optional))
    .every((entry) => items.some((item) => item.evidence_type === entry.type));
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
        {flow === "gifts" ? "Step 6 of 8" : "Step 2 of 3"}
      </p>
      <h1 className="mt-1 text-3xl font-bold">
        {flow === "gifts"
          ? giftSellContent.evidence.title
          : "Verify your Stars"}
      </h1>
      <p className="mt-4 leading-6">
        {flow === "gifts"
          ? giftSellContent.evidence.description
          : "Screenshot your Telegram Stars transaction history and the message you received when the Stars were added to your account."}
      </p>
      {flow !== "gifts" ? (
        <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
          <h2 className="text-lg font-bold">How to find your Stars history</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li>Open Telegram Settings</li>
            <li>Open Stars</li>
            <li>Screenshot the relevant transaction history</li>
            <li>Upload enough history for the order to be reviewed</li>
            <li>
              Upload the Telegram message or receipt showing the Stars were
              received
            </li>
          </ol>
        </section>
      ) : null}
      {evidenceItems.map((entry) => (
        <div key={entry.type}>
          <UploadArea
            title={entry.title}
            count={
              items.filter((item) => item.evidence_type === entry.type).length
            }
            multiple={entry.multiple}
            onFiles={(files) => void upload(files, entry.type)}
          />
          <p className="mt-1 px-2 text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
            {entry.instructions}
          </p>
        </div>
      ))}
      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex min-h-12 items-center justify-between rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] px-4 text-sm"
            >
              <span>Evidence {index + 1}</span>
              <button
                type="button"
                onClick={() => void viewEvidence(item.id)}
                className="font-semibold text-[var(--tg-theme-link-color,#3390ec)]"
              >
                View
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <section className="mt-6">
        <h2 className="font-bold">Need help?</h2>
        <div className="mt-2">
          <SupportContacts />
        </div>
      </section>
      {error ? (
        <p role="alert" className="mt-4 text-red-500">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!requiredComplete || busy}
        onClick={() => router.push(`/sell/verified/${flow}/review`)}
        className="mt-6 min-h-14 w-full rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40"
      >
        {busy ? "Uploading…" : "Continue"}
      </button>
    </main>
  );
}
function UploadArea({
  title,
  count,
  multiple = false,
  onFiles,
}: {
  title: string;
  count: number;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
}): React.ReactNode {
  return (
    <label className="mt-4 block cursor-pointer rounded-3xl border-2 border-dashed border-[var(--tg-theme-hint-color,#8e8e93)]/40 p-6 text-center">
      <span className="block font-bold">{title}</span>
      <span className="mt-2 block text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
        JPEG, PNG or WebP · max 8 MB each
        <br />
        {count ? `${count} uploaded` : "Tap to upload"}
      </span>
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={(e) => onFiles(e.target.files)}
      />
    </label>
  );
}
