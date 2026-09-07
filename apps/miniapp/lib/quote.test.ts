import { describe, expect, it } from "vitest";
import { calculateQuoteValues } from "./quote";
const config = {
  quickSellMaxUsd: "10",
  quickSellCooldownDays: 30,
  quickSellQuoteTtlSeconds: 300,
  quickSellUsdPerStar: "0.01455",
  appleGoogleSettlementDays: 21,
  giftSettlementDays: 7,
  payoutAssets: [
    { asset: "GRAM", network: "TON", usdPerAsset: "5", category: "crypto" },
  ],
} as const;
describe("calculateQuoteValues", () => {
  it("calculates authoritative values with decimal arithmetic", () => {
    expect(
      calculateQuoteValues(500, config.payoutAssets[0], config),
    ).toMatchObject({
      usdValue: "7.28",
      payoutAmount: "1.455000000000000000",
    });
  });
  it("rejects values over the configured maximum", () => {
    expect(() =>
      calculateQuoteValues(688, config.payoutAssets[0], config),
    ).toThrow("maximum");
  });
  it("uses the identical per-Star rate for verified quotes", () => {
    expect(
      calculateQuoteValues(1000, config.payoutAssets[0], config, false),
    ).toMatchObject({
      usdValue: "14.55",
      payoutAmount: "2.910000000000000000",
    });
  });
});
