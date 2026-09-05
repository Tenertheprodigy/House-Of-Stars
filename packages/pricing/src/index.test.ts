import { describe, expect, it } from "vitest";
import {
  DecimalPricingProvider,
  type QuoteRepository,
  type QuoteTerms,
  type StoredQuote,
} from "./index";

class MemoryQuotes implements QuoteRepository {
  readonly quotes = new Map<string, StoredQuote>();
  sequence = 0;
  async create(terms: QuoteTerms): Promise<StoredQuote> {
    const quote: StoredQuote = {
      ...terms,
      id: `quote-${++this.sequence}`,
      createdAt: "2026-01-01T00:00:00.000Z",
      consumedAt: null,
    };
    this.quotes.set(quote.id, quote);
    return quote;
  }
  async findForUser(id: string, userId: string) {
    const quote = this.quotes.get(id);
    return quote?.userId === userId ? quote : null;
  }
  async consume(id: string, userId: string, consumedAt: string) {
    const quote = await this.findForUser(id, userId);
    if (!quote || quote.consumedAt) return null;
    const consumed = { ...quote, consumedAt };
    this.quotes.set(id, consumed);
    return consumed;
  }
  async expire(id: string, userId: string, expiredAt: string) {
    const quote = await this.findForUser(id, userId);
    if (!quote || quote.consumedAt) return false;
    this.quotes.set(id, { ...quote, expiresAt: expiredAt });
    return true;
  }
}
const config = {
  usdPerStar: "0.013",
  feeRate: "0.025",
  fixedFeeUsd: "0.10",
  assets: [
    { asset: "GRAM", network: "TON", usdPerAsset: "5.123456789123456789" },
  ],
} as const;
const now = new Date("2026-01-01T00:00:00.000Z");

describe("DecimalPricingProvider", () => {
  it("uses decimal arithmetic and defaults expiry to 60 seconds", async () => {
    const provider = new DecimalPricingProvider(
      new MemoryQuotes(),
      config,
      () => now,
    );
    expect(await provider.getUsdValueForStars(1000)).toBe("13.00");
    const quote = await provider.getAssetQuote({
      userId: "user-1",
      starsAmount: 1000,
      payoutAsset: "GRAM",
    });
    expect(quote.fees).toBe("0.43");
    expect(quote.assetAmount).toBe("2.453421687225848570");
    expect(quote.expiresAt).toBe("2026-01-01T00:01:00.000Z");
  });
  it("isolates quotes by authenticated user", async () => {
    const provider = new DecimalPricingProvider(
      new MemoryQuotes(),
      config,
      () => now,
    );
    const quote = await provider.getAssetQuote({
      userId: "user-1",
      starsAmount: 100,
      payoutAsset: "GRAM",
    });
    await expect(
      provider.validateQuote({ userId: "user-2", quoteId: quote.id }),
    ).resolves.toEqual({ valid: false, reason: "not_found" });
  });
  it("expires quotes at the configured boundary", async () => {
    let clock = now;
    const provider = new DecimalPricingProvider(
      new MemoryQuotes(),
      { ...config, quoteTtlSeconds: 10 },
      () => clock,
    );
    const quote = await provider.getAssetQuote({
      userId: "user-1",
      starsAmount: 100,
      payoutAsset: "GRAM",
    });
    clock = new Date("2026-01-01T00:00:10.000Z");
    await expect(
      provider.validateQuote({ userId: "user-1", quoteId: quote.id }),
    ).resolves.toEqual({ valid: false, reason: "expired" });
  });
  it("atomically consumes a quote only once", async () => {
    const provider = new DecimalPricingProvider(
      new MemoryQuotes(),
      config,
      () => now,
    );
    const quote = await provider.getAssetQuote({
      userId: "user-1",
      starsAmount: 100,
      payoutAsset: "GRAM",
    });
    expect(
      (
        await provider.validateQuote({
          userId: "user-1",
          quoteId: quote.id,
          consume: true,
        })
      ).valid,
    ).toBe(true);
    await expect(
      provider.validateQuote({
        userId: "user-1",
        quoteId: quote.id,
        consume: true,
      }),
    ).resolves.toEqual({ valid: false, reason: "consumed" });
  });
  it("supports explicit expiration and rejects invalid inputs", async () => {
    const provider = new DecimalPricingProvider(
      new MemoryQuotes(),
      config,
      () => now,
    );
    const quote = await provider.getAssetQuote({
      userId: "user-1",
      starsAmount: 100,
      payoutAsset: "GRAM",
    });
    expect(
      await provider.expireQuote({ userId: "user-1", quoteId: quote.id }),
    ).toBe(true);
    await expect(
      provider.validateQuote({ userId: "user-1", quoteId: quote.id }),
    ).resolves.toEqual({ valid: false, reason: "expired" });
    await expect(provider.getUsdValueForStars(0)).rejects.toThrow(
      "positive safe integer",
    );
    await expect(
      provider.getAssetQuote({
        userId: "user-1",
        starsAmount: 100,
        payoutAsset: "BTC",
      }),
    ).rejects.toThrow("Unsupported");
  });
});
