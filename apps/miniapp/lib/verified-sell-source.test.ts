import { describe, expect, it } from "vitest";
import {
  verifiedSellSourceDestinations,
  verifiedSellSourceRequestSchema,
} from "./verified-sell-source";

describe("verified sell sources", () => {
  it.each([
    ["apple_google", "/sell/verified/apple-google"],
    ["fragment_other", "/sell/verified/fragment"],
    ["gifts", "/sell/verified/gifts"],
  ] as const)(
    "maps %s to its controlled destination",
    (source, destination) => {
      expect(verifiedSellSourceRequestSchema.parse({ source })).toEqual({
        source,
      });
      expect(verifiedSellSourceDestinations[source]).toBe(destination);
    },
  );
  it("rejects unknown sources and client-supplied identity", () => {
    expect(
      verifiedSellSourceRequestSchema.safeParse({ source: "unknown" }).success,
    ).toBe(false);
    expect(
      verifiedSellSourceRequestSchema.safeParse({
        source: "gifts",
        userId: "client-value",
      }).success,
    ).toBe(false);
  });
});
