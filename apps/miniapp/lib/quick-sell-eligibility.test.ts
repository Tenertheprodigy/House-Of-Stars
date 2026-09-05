import { describe, expect, it } from "vitest";
import { determineQuickSellEligibility } from "./quick-sell-eligibility";

const config = { quickSellMaxUsd: "10", quickSellCooldownDays: 30 };
const now = new Date("2026-09-05T00:00:00.000Z");

describe("determineQuickSellEligibility", () => {
  it("allows a user without previous Quick Sell orders", () => {
    expect(determineQuickSellEligibility([], config, now)).toEqual({
      status: "eligible",
    });
  });
  it("reports an order that is still processing", () => {
    expect(
      determineQuickSellEligibility(
        [{ status: "under_review", updatedAt: "2026-08-01T00:00:00.000Z" }],
        config,
        now,
      ),
    ).toMatchObject({ status: "processing" });
  });
  it("applies the configured cooldown to a completed order", () => {
    expect(
      determineQuickSellEligibility(
        [{ status: "paid", updatedAt: "2026-08-20T00:00:00.000Z" }],
        config,
        now,
      ),
    ).toEqual({
      status: "not_eligible",
      reason: "You can complete one Quick Sell every 30 days.",
      eligibleAt: "2026-09-19T00:00:00.000Z",
    });
  });
  it("allows a user after the configured cooldown", () => {
    expect(
      determineQuickSellEligibility(
        [{ status: "paid", updatedAt: "2026-07-01T00:00:00.000Z" }],
        config,
        now,
      ),
    ).toEqual({ status: "eligible" });
  });
});
