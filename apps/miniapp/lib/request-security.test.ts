import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { rejectCrossOriginMutation } from "./request-security";

describe("request security", () => {
  it("rejects cross-origin state changes", () => {
    const request = new NextRequest(
      "https://mini.example/api/sell/quick/orders",
      { method: "POST", headers: { origin: "https://evil.example" } },
    );
    expect(rejectCrossOriginMutation(request)?.status).toBe(403);
  });
  it("allows same-origin state changes and safe methods", () => {
    expect(
      rejectCrossOriginMutation(
        new NextRequest("https://mini.example/api/sell/quick/orders", {
          method: "POST",
          headers: { origin: "https://mini.example" },
        }),
      ),
    ).toBeNull();
    expect(
      rejectCrossOriginMutation(
        new NextRequest("https://mini.example/api/orders", { method: "GET" }),
      ),
    ).toBeNull();
  });
});
