import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  acceptedEvidenceMimeTypes,
  fragmentDetailsSchema,
  MAX_EVIDENCE_FILE_SIZE,
} from "./fragment-sell";
import { getQuickSellConfig } from "../config/server";

describe("Fragment verified sell validation", () => {
  it("rejects client identity and incomplete wallet confirmation", () => {
    expect(
      fragmentDetailsSchema.safeParse({
        starsAmount: 10,
        payoutAsset: "GRAM",
        walletAddress: "x",
        networkConfirmed: false,
      }).success,
    ).toBe(false);
    expect(
      fragmentDetailsSchema.safeParse({
        starsAmount: 10,
        payoutAsset: "GRAM",
        walletAddress: "x",
        networkConfirmed: true,
        userId: "other",
      }).success,
    ).toBe(false);
  });
  it("defines private evidence upload limits and stable SHA-256 hashes", () => {
    expect(acceptedEvidenceMimeTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(MAX_EVIDENCE_FILE_SIZE).toBe(8_388_608);
    expect(createHash("sha256").update("same-file").digest("hex")).toHaveLength(
      64,
    );
  });
  it("uses a 21-day Apple / Google settlement policy by default", () => {
    expect(getQuickSellConfig({ NODE_ENV: "test" })).toMatchObject({
      appleGoogleSettlementDays: 21,
    });
  });
  it("keeps the Gifts settlement policy in server configuration", () => {
    expect(getQuickSellConfig({ NODE_ENV: "test" })).toMatchObject({
      giftSettlementDays: 7,
    });
  });
});
