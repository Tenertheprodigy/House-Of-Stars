import type { Bot } from "grammy";
import { createInvoicePayload, resolvePack } from "./payload.js";

export interface CreateInvoiceInput {
  readonly bot: Bot;
  readonly userId: string;
  readonly packId?: string;
  readonly stars?: number;
  readonly purpose?: "stars_purchase" | "quick_sell";
  readonly orderId?: string;
  readonly nonce?: string;
}

export async function createTelegramStarsInvoice(
  input: CreateInvoiceInput,
): Promise<string> {
  const pack = resolvePack({ packId: input.packId, stars: input.stars });

  const payload = createInvoicePayload({
    userId: input.userId,
    packId: pack.id,
    stars: pack.stars,
    purpose: input.purpose,
    orderId: input.orderId,
    nonce: input.nonce,
  });

  const title = pack.title;
  const description = pack.description;

  return input.bot.api.createInvoiceLink(
    title,
    description,
    payload,
    "",
    "XTR",
    [{ label: title, amount: pack.stars }],
  );
}
