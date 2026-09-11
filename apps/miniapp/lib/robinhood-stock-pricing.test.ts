import { afterEach, describe, expect, it, vi } from "vitest";
import { getRobinhoodStockUsdPrice } from "./robinhood-stock-pricing";

afterEach(() => vi.unstubAllGlobals());

describe("Robinhood stock-token pricing", () => {
  it("uses active mainnet metadata and decimal-safe multiplier pricing", async () => {
    const responses = [
      {
        assets: [
          {
            tokenSymbol: "AAPL",
            currentMultiplier: "0.500000000000000000",
            deployments: [
              { contractAddress: `0x${"1".repeat(40)}`, chainId: 4663 },
            ],
            status: "ASSET_STATUS_ACTIVE",
          },
        ],
      },
      {
        quotes: [
          {
            tokenSymbol: "AAPL",
            bid: "199.123456789012345678",
            ask: "200.123456789012345678",
            currency: "USD",
            isTradingHalt: false,
            deployments: [
              { contractAddress: `0x${"1".repeat(40)}`, chainId: 4663 },
            ],
            generatedAt: "2026-09-10T12:00:00.000Z",
          },
        ],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify(responses.shift()), { status: 200 }),
          ),
        ),
    );
    await expect(getRobinhoodStockUsdPrice("AAPL")).resolves.toEqual({
      usdPrice: "99.561728394506172839",
      updatedAt: "2026-09-10T12:00:00.000Z",
      source: "robinhood_stock_token_bid",
    });
  });

  it("rejects symbols outside the server allowlist", async () => {
    await expect(getRobinhoodStockUsdPrice("NOTREAL")).rejects.toThrow(
      "Unsupported stock token",
    );
  });
});
