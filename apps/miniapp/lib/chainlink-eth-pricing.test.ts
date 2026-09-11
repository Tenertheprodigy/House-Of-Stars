import { describe, expect, it, vi } from "vitest";
import { getEthUsdPrice } from "./chainlink-eth-pricing";

const word = (value: bigint): string => value.toString(16).padStart(64, "0");
const rpcResponse = (result: string): Response =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
  });

describe("Chainlink ETH/USD pricing", () => {
  it("normalizes feed decimals and returns the round timestamp", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(rpcResponse(`0x${word(8n)}`))
      .mockResolvedValueOnce(
        rpcResponse(
          `0x${word(12n)}${word(400_000_000_000n)}${word(0n)}${word(1_789_041_600n)}${word(12n)}`,
        ),
      );
    await expect(
      getEthUsdPrice({
        rpcUrl: "https://rpc.example",
        feedAddress: `0x${"1".repeat(40)}`,
        maxAgeSeconds: 3600,
        timeoutMs: 5000,
        retries: 0,
        now: () => new Date("2026-09-10T12:30:00.000Z"),
        fetcher,
      }),
    ).resolves.toEqual({
      usdPrice: "4000.000000000000000000",
      updatedAt: "2026-09-10T12:00:00.000Z",
      source: "chainlink_eth_usd",
    });
  });

  it("rejects stale round data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(rpcResponse(`0x${word(8n)}`))
      .mockResolvedValueOnce(
        rpcResponse(
          `0x${word(12n)}${word(400_000_000_000n)}${word(0n)}${word(1_789_034_400n)}${word(12n)}`,
        ),
      );
    await expect(
      getEthUsdPrice({
        rpcUrl: "https://rpc.example",
        feedAddress: `0x${"1".repeat(40)}`,
        maxAgeSeconds: 3600,
        timeoutMs: 5000,
        retries: 0,
        now: () => new Date("2026-09-10T12:30:00.000Z"),
        fetcher,
      }),
    ).rejects.toThrow("temporarily unavailable");
  });
});
