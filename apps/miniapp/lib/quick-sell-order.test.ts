import { describe, expect, it } from "vitest";
import { quickSellOrderRequestSchema } from "./quick-sell-order";

describe("Quick Sell order confirmation", () => {
  const request = {
    quoteId: "20000000-0000-4000-8000-000000000002",
    walletAddress: "wallet",
    networkConfirmed: true,
  } as const;
  it("accepts quote identity and wallet confirmation", () => {
    expect(quickSellOrderRequestSchema.safeParse(request).success).toBe(true);
  });
  it("rejects client attempts to change authoritative quote values", () => {
    expect(
      quickSellOrderRequestSchema.safeParse({
        ...request,
        payoutAmount: "999",
        payoutAsset: "OTHER",
      }).success,
    ).toBe(false);
  });
});
