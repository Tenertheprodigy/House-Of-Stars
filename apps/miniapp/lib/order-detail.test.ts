import { describe, expect, it } from "vitest";
import { buildPublicTimeline, maskWallet } from "./order-detail";

describe("order detail presentation", () => {
  it("exposes only known customer timeline milestones", () => {
    expect(
      buildPublicTimeline([
        {
          id: 1,
          event_type: "risk_rule_triggered",
          to_status: null,
          created_at: "2026-09-01T00:00:00Z",
        },
        {
          id: 2,
          event_type: "status_changed",
          to_status: "submitted",
          created_at: "2026-09-02T00:00:00Z",
        },
        {
          id: 3,
          event_type: "status_changed",
          to_status: "under_review",
          created_at: "2026-09-03T00:00:00Z",
        },
      ]),
    ).toEqual([
      { label: "Order submitted", occurredAt: "2026-09-02T00:00:00Z" },
      { label: "Verification in review", occurredAt: "2026-09-03T00:00:00Z" },
    ]);
  });
  it("masks wallet destinations", () => {
    expect(maskWallet("EQBx1234567893Xq")).toBe("EQBx1…3Xq");
  });
});
