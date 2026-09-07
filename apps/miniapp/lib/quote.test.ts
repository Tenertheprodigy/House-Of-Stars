import { describe, expect, it } from "vitest";
import { calculateQuoteValues } from "./quote";
const config = {
  quickSellMaxUsd: "10",
  quickSellCooldownDays: 30,
  quickSellQuoteTtlSeconds: 300,
  quickSellUsdPerStar: "0.001455",
  appleGoogleSettlementDays: 21,
  giftSettlementDays: 7,
  payoutAssets: [
    { asset: "GRAM", network: "TON", usdPerAsset: "5", category: "crypto" },
  ],
} as const;
describe("calculateQuoteValues", () => {
  it("calculates authoritative values with decimal arithmetic", () => {
    expect(
      calculateQuoteValues(1000, config.payoutAssets[0], config),
    ).toMatchObject({
      usdValue: "1.46",
      payoutAmount: "0.291000000000000000",
    });
  });
  it("rejects values over the configured maximum", () => {
    expect(() =>
      calculateQuoteValues(6873, config.payoutAssets[0], config),
    ).toThrow("maximum");
  });
});
