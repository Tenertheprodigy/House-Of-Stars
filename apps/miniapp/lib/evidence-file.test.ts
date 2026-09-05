import { describe, expect, it } from "vitest";
import { hasExpectedImageSignature } from "./evidence-file";

describe("evidence image signatures", () => {
  it("accepts signatures matching the declared image type", () => {
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([0xff, 0xd8, 0xff, 0x01]),
        "image/jpeg",
      ),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      hasExpectedImageSignature(
        new TextEncoder().encode("RIFF0000WEBP"),
        "image/webp",
      ),
    ).toBe(true);
  });
  it("rejects renamed or mismatched content", () => {
    expect(
      hasExpectedImageSignature(
        new TextEncoder().encode("<script>alert(1)</script>"),
        "image/png",
      ),
    ).toBe(false);
    expect(
      hasExpectedImageSignature(
        Uint8Array.from([0xff, 0xd8, 0xff]),
        "image/webp",
      ),
    ).toBe(false);
  });
});
