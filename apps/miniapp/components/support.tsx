"use client";

import {
  SUPPORT_CONTACTS,
  formatPublicOrderReference,
} from "@house-of-stars/shared";
import Link from "next/link";
import { useState } from "react";
import { getTelegramWebApp } from "../lib/telegram-webapp";

export function SupportButton({
  orderNumber,
  className = "",
}: {
  orderNumber?: string;
  className?: string;
}): React.ReactNode {
  const href = orderNumber
    ? `/support?orderNumber=${encodeURIComponent(orderNumber)}`
    : "/support";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center font-semibold text-[var(--tg-theme-link-color,#3390ec)] ${className}`}
    >
      Contact Support
    </Link>
  );
}

export function SupportContacts(): React.ReactNode {
  function openTelegram(
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ): void {
    const telegram = getTelegramWebApp();
    if (!telegram?.openTelegramLink) return;
    event.preventDefault();
    telegram.openTelegramLink(url);
  }
  return (
    <div className="flex flex-col gap-2">
      {SUPPORT_CONTACTS.map((contact) => (
        <a
          key={contact.username}
          href={contact.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => openTelegram(event, contact.telegramUrl)}
          className="inline-flex min-h-11 items-center text-[var(--tg-theme-link-color,#3390ec)]"
        >
          {contact.displayName}
        </a>
      ))}
    </div>
  );
}

export function OrderSupportCard({
  orderNumber,
  title = "Having an issue with this order?",
  showSupportButton = false,
}: {
  orderNumber: string | number;
  title?: string;
  showSupportButton?: boolean;
}): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const reference = formatPublicOrderReference(orderNumber);
  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <section className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-5">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-3 font-semibold">{reference}</p>
      <div className="mt-2">
        <SupportContacts />
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-4 min-h-12 w-full rounded-2xl bg-[var(--tg-theme-bg-color,#f4f4f7)] font-semibold"
      >
        {copied ? "Copied" : "Copy Order Number"}
      </button>
      {showSupportButton ? (
        <SupportButton
          orderNumber={String(orderNumber)}
          className="mt-2 w-full"
        />
      ) : null}
    </section>
  );
}
