import { describe, expect, it } from "vitest";
import { calculateQuoteValues } from "./quote";
const config = {
  quickSellMaxUsd: "10",
  quickSellCooldownDays: 30,
  quickSellQuoteTtlSeconds: 300,
  quickSellUsdPerStar: "0.0145",
  platformFeeRate: "3",
  chainlinkEthUsdFeedAddress: `0x${"1".repeat(40)}`,
  chainlinkPriceMaxAgeSeconds: 3600,
  priceRequestTimeoutMs: 5000,
  priceRequestRetries: 2,
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
      usdValue: "7.25",
      fees: "0.217500000000000000",
      netUsdValue: "7.03",
      payoutAmount: "1.406500000000000000",
    });
  });
  it("rejects values over the configured maximum", () => {
    expect(() =>
      calculateQuoteValues(690, config.payoutAssets[0], config),
    ).toThrow("maximum");
  });
  it("uses the identical per-Star rate for verified quotes", () => {
    expect(
      calculateQuoteValues(1000, config.payoutAssets[0], config, false),
    ).toMatchObject({
      usdValue: "14.50",
      fees: "0.435000000000000000",
      netUsdValue: "14.06",
      payoutAmount: "2.813000000000000000",
    });
  });
});
