import { afterEach, describe, expect, it, vi } from "vitest";
import { getRobinhoodStockUsdPrice } from "./robinhood-stock-pricing";

afterEach(() => vi.unstubAllGlobals());

describe("Robinhood stock-token pricing", () => {
  it("uses active mainnet metadata and decimal-safe multiplier pricing", async () => {
    const responses = [
      {
        assets: [{
          tokenSymbol: "AAPL",
          currentMultiplier: "0.500000000000000000",
          deployments: [{ contractAddress: `0x${"1".repeat(40)}`, chainId: 4663 }],
          status: "ASSET_STATUS_ACTIVE",
        }],
      },
      {
        quotes: [{
          tokenSymbol: "AAPL",
          ask: "200.123456789012345678",
          currency: "USD",
          isTradingHalt: false,
          deployments: [{ contractAddress: `0x${"1".repeat(40)}`, chainId: 4663 }],
        }],
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(responses.shift()), { status: 200 })),
    ));
    await expect(getRobinhoodStockUsdPrice("AAPL")).resolves.toBe(
      "100.061728394506172840",
    );
  });

  it("rejects symbols outside the server allowlist", async () => {
    await expect(getRobinhoodStockUsdPrice("NOTREAL")).rejects.toThrow(
      "Unsupported stock token",
    );
  });
});
