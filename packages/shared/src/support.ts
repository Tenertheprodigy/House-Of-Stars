export interface SupportContact {
  readonly username: string;
  readonly displayName: string;
  readonly telegramUrl: `https://t.me/${string}`;
}

export const SUPPORT_CONTACTS = [
  {
    username: "tenerheprodigy",
    displayName: "@tenerheprodigy",
    telegramUrl: "https://t.me/tenerheprodigy",
  },
  {
    username: "EMMANUEL4167",
    displayName: "@EMMANUEL4167",
    telegramUrl: "https://t.me/EMMANUEL4167",
  },
] as const satisfies readonly SupportContact[];

export function formatPublicOrderReference(
  orderNumber: string | number,
): string {
  return `Order #${String(orderNumber).padStart(6, "0")}`;
}
