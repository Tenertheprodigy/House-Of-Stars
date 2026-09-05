import { describe, expect, it } from "vitest";
import { calculateQuoteValues } from "./quote";
const config = {
  quickSellMaxUsd: "10",
  quickSellCooldownDays: 30,
  quickSellQuoteTtlSeconds: 300,
  quickSellUsdPerStar: "0.01",
  appleGoogleSettlementDays: 21,
  giftSettlementDays: 7,
  payoutAssets: [{ asset: "GRAM", network: "TON", usdPerAsset: "5" }],
} as const;
describe("calculateQuoteValues", () => {
  it("calculates authoritative values with decimal arithmetic", () => {
    expect(
      calculateQuoteValues(500, config.payoutAssets[0], config),
    ).toMatchObject({ usdValue: "5.00", payoutAmount: "1.000000000000000000" });
  });
  it("rejects values over the configured maximum", () => {
    expect(() =>
      calculateQuoteValues(1001, config.payoutAssets[0], config),
    ).toThrow("maximum");
  });
});
