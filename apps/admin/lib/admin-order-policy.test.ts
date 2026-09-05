import { describe, expect, it } from "vitest";
import { canTransition, getPayoutEligibility } from "./admin-order-policy";

describe("admin order policy", () => {
  it("permits only supported state transitions", () => {
    expect(canTransition("under_review", "approve")).toBe(true);
    expect(canTransition("submitted", "approve")).toBe(false);
    expect(canTransition("paid", "reject")).toBe(false);
    expect(canTransition("submitted", "request_more_evidence")).toBe(true);
  });

  it("enforces future settlement holds", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    expect(
      getPayoutEligibility(
        {
          status: "approved",
          settlementAvailableAt: "2026-09-06T12:00:00.000Z",
          hasPayout: false,
        },
        now,
      ).eligible,
    ).toBe(false);
    expect(
      getPayoutEligibility(
        {
          status: "approved",
          settlementAvailableAt: "2026-09-04T12:00:00.000Z",
          hasPayout: false,
        },
        now,
      ).eligible,
    ).toBe(true);
  });

  it("does not queue unapproved or duplicate payouts", () => {
    expect(
      getPayoutEligibility({
        status: "under_review",
        settlementAvailableAt: null,
        hasPayout: false,
      }).eligible,
    ).toBe(false);
    expect(
      getPayoutEligibility({
        status: "approved",
        settlementAvailableAt: null,
        hasPayout: true,
      }).eligible,
    ).toBe(false);
  });
  it("does not queue an approved order without durable wallet validation", () => {
    expect(
      getPayoutEligibility({
        status: "approved",
        settlementAvailableAt: null,
        hasPayout: false,
        walletValidated: false,
      }),
    ).toEqual({
      eligible: false,
      reason: "The destination wallet has not been validated.",
    });
  });
});
