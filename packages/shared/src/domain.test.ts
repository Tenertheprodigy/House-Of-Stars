import { describe, expect, it } from "vitest";
import { orderStatusGroups } from "./domain";

describe("order status groups", () => {
  it("keeps user-action states separate from processing", () => {
    expect(orderStatusGroups.needsAction).toContain("awaiting_evidence");
    expect(orderStatusGroups.processing).not.toContain("awaiting_evidence");
  });
  it("groups terminal statuses as completed", () => {
    expect(orderStatusGroups.completed).toEqual([
      "paid",
      "cancelled",
      "refunded",
      "rejected",
    ]);
  });
});
