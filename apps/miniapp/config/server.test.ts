import { describe, expect, it } from "vitest";
import { getQuickSellConfig } from "./server";

describe("payout configuration", () => {
  it("adds STARS as a separate mainnet token when fully configured", () => {
    const config = getQuickSellConfig({
      NODE_ENV: "test",
      STARS_CONTRACT_ADDRESS: `0x${"1".repeat(40)}`,
      STARS_USD_PER_TOKEN: "0.25",
    });
    expect(config.payoutAssets).toContainEqual({
      asset: "STARS",
      network: "Robinhood Chain",
      usdPerAsset: "0.25",
      category: "token",
      contractAddress: `0x${"1".repeat(40)}`,
    });
  });

  it("does not expose an unpriceable STARS option", () => {
    const config = getQuickSellConfig({
      NODE_ENV: "test",
      STARS_CONTRACT_ADDRESS: `0x${"1".repeat(40)}`,
    });
    expect(config.payoutAssets.some((asset) => asset.asset === "STARS")).toBe(false);
  });
});
