export interface InvoicePack {
  readonly id: string;
  readonly stars: number;
  readonly title: string;
  readonly description: string;
}

export interface InvoicePayload {
  readonly userId: string;
  readonly packId: string;
  readonly stars: number;
  readonly purpose?: "stars_purchase" | "quick_sell";
  readonly orderId?: string;
  readonly nonce: string;
}

const PACKS: Record<string, InvoicePack> = {
  starter: {
    id: "starter",
    stars: 100,
    title: "100 Stars",
    description: "Add 100 Telegram Stars to your House of Stars balance.",
  },
  boost: {
    id: "boost",
    stars: 250,
    title: "250 Stars",
    description: "Add 250 Telegram Stars to your House of Stars balance.",
  },
  premium: {
    id: "premium",
    stars: 500,
    title: "500 Stars",
    description: "Add 500 Telegram Stars to your House of Stars balance.",
  },
};

export function resolvePack(input: {
  readonly packId?: string;
  readonly stars?: number;
}): InvoicePack {
  if (input.packId) {
    const key = input.packId.trim();
    const match = PACKS[key];
    if (!match) throw new Error(`Unsupported Stars pack: ${input.packId}`);
    return match;
  }

  if (typeof input.stars === "number") {
    if (!Number.isSafeInteger(input.stars) || input.stars <= 0) {
      throw new Error("Stars amount must be a positive integer");
    }
    const match = Object.values(PACKS).find((pack) => pack.stars === input.stars);
    if (!match) throw new Error(`Unsupported stars amount: ${input.stars}`);
    return match;
  }

  throw new Error("A Stars pack or a valid star amount is required");
}

export function createInvoicePayload(input: {
  readonly userId: string;
  readonly packId?: string;
  readonly stars?: number;
  readonly purpose?: "stars_purchase" | "quick_sell";
  readonly orderId?: string;
  readonly nonce?: string;
}): string {
  const userId = String(input.userId ?? "").trim();
  if (!userId) throw new Error("Invoice payload requires a user id");

  const pack = resolvePack({ packId: input.packId, stars: input.stars });

  const rawPayload = {
    u: userId,
    p: pack.id,
    s: pack.stars,
    pr: input.purpose ?? "stars_purchase",
    o: input.orderId?.trim() || undefined,
    n: input.nonce?.trim() || crypto.randomUUID(),
  };

  const serialized = JSON.stringify(rawPayload);
  if (Buffer.byteLength(serialized, "utf8") > 128) {
    throw new Error("Invoice payload exceeds Telegram's 128 byte limit");
  }

  return serialized;
}

export function parseInvoicePayload(rawPayload: string): InvoicePayload {
  if (!rawPayload || typeof rawPayload !== "string") {
    throw new Error("Invoice payload is missing");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Invoice payload is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invoice payload must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const userId =
    (typeof record.u === "string" ? record.u : typeof record.userId === "string" ? record.userId : "")
      .trim();
  const packId =
    (typeof record.p === "string" ? record.p : typeof record.packId === "string" ? record.packId : "")
      .trim();
  const stars = Number(record.s ?? record.stars);
  const purpose =
    record.pr === "quick_sell" || record.pr === "stars_purchase"
      ? record.pr
      : record.purpose === "quick_sell" || record.purpose === "stars_purchase"
        ? record.purpose
        : "stars_purchase";
  const nonce =
    (typeof record.n === "string" ? record.n : typeof record.nonce === "string" ? record.nonce : "")
      .trim();

  if (!userId || !packId || !packId.length || !Number.isSafeInteger(stars) || stars <= 0 || !nonce) {
    throw new Error("Invoice payload is missing required fields");
  }

  const resolved = resolvePack({ packId });
  if (resolved.stars !== stars) {
    throw new Error("Invoice payload star amount does not match its pack");
  }

  const orderId =
    typeof record.o === "string"
      ? record.o.trim() || undefined
      : typeof record.orderId === "string"
        ? record.orderId.trim() || undefined
        : undefined;

  return {
    userId,
    packId: resolved.id,
    stars: resolved.stars,
    purpose,
    orderId,
    nonce,
  };
}

export const invoicePacks = Object.freeze(Object.values(PACKS));
