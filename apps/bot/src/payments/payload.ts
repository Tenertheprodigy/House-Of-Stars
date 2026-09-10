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
  readonly purpose?: "stars_purchase" | "quick_sell" | "verified_sell";
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
    if (!match) {
      if (
        key === "custom" &&
        Number.isSafeInteger(input.stars) &&
        (input.stars ?? 0) > 0
      ) {
        const stars = input.stars as number;
        return {
          id: "custom",
          stars,
          title: "House of Stars order",
          description: `Order processing service for ${stars} Stars.`,
        };
      }
      throw new Error(`Unsupported Stars pack: ${input.packId}`);
    }
    return match;
  }

  if (typeof input.stars === "number") {
    if (!Number.isSafeInteger(input.stars) || input.stars <= 0) {
      throw new Error("Stars amount must be a positive integer");
    }
    const match = Object.values(PACKS).find(
      (pack) => pack.stars === input.stars,
    );
    return (
      match ?? {
        id: "custom",
        stars: input.stars,
        title: "House of Stars order",
        description: `Order processing service for ${input.stars} Stars.`,
      }
    );
  }

  throw new Error("A Stars pack or a valid star amount is required");
}

export function createInvoicePayload(input: {
  readonly userId: string;
  readonly packId?: string;
  readonly stars?: number;
  readonly purpose?: "stars_purchase" | "quick_sell" | "verified_sell";
  readonly orderId?: string;
  readonly nonce?: string;
}): string {
  const userId = String(input.userId ?? "").trim();
  if (!userId) throw new Error("Invoice payload requires a user id");

  const pack = resolvePack({ packId: input.packId, stars: input.stars });

  const orderId = input.orderId?.trim() || undefined;
  const purpose = input.purpose ?? "stars_purchase";
  // Telegram limits invoice payloads to 128 UTF-8 bytes. Keep the payload
  // small and use the order id as the idempotency nonce for the non-purchase
  // cases that are tied to a verified service order.
  const rawPayload =
    purpose === "quick_sell"
      ? { u: userId, p: pack.id, s: pack.stars, pr: "q", o: orderId }
      : purpose === "verified_sell"
        ? { u: userId, p: pack.id, s: pack.stars, pr: "v", o: orderId }
        : {
            u: userId,
            p: pack.id,
            s: pack.stars,
            pr: "p",
            o: orderId,
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
  const userId = (
    typeof record.u === "string"
      ? record.u
      : typeof record.userId === "string"
        ? record.userId
        : ""
  ).trim();
  const packId = (
    typeof record.p === "string"
      ? record.p
      : typeof record.packId === "string"
        ? record.packId
        : ""
  ).trim();
  const stars = Number(record.s ?? record.stars);
  const purpose =
    record.pr === "q"
      ? "quick_sell"
      : record.pr === "v"
        ? "verified_sell"
        : record.pr === "p"
          ? "stars_purchase"
          : record.pr === "quick_sell" ||
              record.pr === "verified_sell" ||
              record.pr === "stars_purchase"
            ? record.pr
            : record.purpose === "quick_sell" ||
                record.purpose === "verified_sell" ||
                record.purpose === "stars_purchase"
              ? record.purpose
              : "stars_purchase";
  const orderId =
    typeof record.o === "string"
      ? record.o.trim() || undefined
      : typeof record.orderId === "string"
        ? record.orderId.trim() || undefined
        : undefined;
  const nonce =
    (typeof record.n === "string"
      ? record.n
      : typeof record.nonce === "string"
        ? record.nonce
        : ""
    ).trim() ||
    (purpose === "quick_sell" || purpose === "verified_sell"
      ? orderId
      : undefined);

  if (
    !userId ||
    !packId ||
    !packId.length ||
    !Number.isSafeInteger(stars) ||
    stars <= 0 ||
    !nonce
  ) {
    throw new Error("Invoice payload is missing required fields");
  }

  const resolved = resolvePack({ packId, stars });
  if (resolved.stars !== stars) {
    throw new Error("Invoice payload star amount does not match its pack");
  }

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
