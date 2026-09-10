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

  it("supports an arbitrary positive Quick Sell amount", () => {
    const pack = resolvePack({ stars: 1_000 });

    expect(pack).toMatchObject({ id: "custom", stars: 1_000 });
  });

  it("supports a verified sale invoice without reusing a quick-sell quote", () => {
    const raw = createInvoicePayload({
      userId: "11111111-1111-4111-8111-111111111111",
      stars: 250,
      purpose: "verified_sell",
      orderId: "33333333-3333-4333-8333-333333333333",
      nonce: "nonce-verified",
    });

    expect(Buffer.byteLength(raw, "utf8")).toBeLessThanOrEqual(128);
    expect(parseInvoicePayload(raw)).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      packId: "boost",
      stars: 250,
      purpose: "verified_sell",
      orderId: "33333333-3333-4333-8333-333333333333",
      nonce: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("keeps a Quick Sell payload within Telegram's 128-byte limit", () => {
    const raw = createInvoicePayload({
      userId: "11111111-1111-4111-8111-111111111111",
      stars: 1_000,
      purpose: "quick_sell",
      orderId: "22222222-2222-4222-8222-222222222222",
    });

    expect(Buffer.byteLength(raw, "utf8")).toBeLessThanOrEqual(128);
    expect(parseInvoicePayload(raw)).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      packId: "custom",
      stars: 1_000,
      purpose: "quick_sell",
      orderId: "22222222-2222-4222-8222-222222222222",
      nonce: "22222222-2222-4222-8222-222222222222",
    });
  });
});
