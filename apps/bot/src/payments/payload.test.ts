import { describe, expect, it } from "vitest";
import {
  createInvoicePayload,
  parseInvoicePayload,
  resolvePack,
} from "./payload.js";

describe("Telegram Stars invoice payload", () => {
  it("serializes and parses a valid purchase payload", () => {
    const raw = createInvoicePayload({
      userId: "11111111-1111-4111-8111-111111111111",
      packId: "starter",
      stars: 100,
      orderId: "order_123",
      nonce: "nonce-abc",
    });

    const parsed = parseInvoicePayload(raw);

    expect(parsed).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      packId: "starter",
      stars: 100,
      orderId: "order_123",
      nonce: "nonce-abc",
    });
  });

  it("rejects unsupported packs and invalid star values", () => {
    expect(() => resolvePack({ packId: "missing" })).toThrow();
    expect(() => resolvePack({ stars: 0 })).toThrow();
  });
});
