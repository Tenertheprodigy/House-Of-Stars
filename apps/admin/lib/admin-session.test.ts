import { describe, expect, it } from "vitest";
import {
  createAdminSession,
  hasAdminMembership,
  verifyAdminSession,
} from "./admin-session";
const secret = "a-secure-admin-session-secret-that-is-long";
const userId = "00000000-0000-4000-8000-000000000099";
describe("admin sessions", () => {
  it("accepts a valid signed session", async () => {
    const token = await createAdminSession(userId, secret, 1_000_000);
    await expect(verifyAdminSession(token, secret, 1_000_000)).resolves.toEqual(
      { sub: userId },
    );
  });
  it("rejects tampering and expiry", async () => {
    const token = await createAdminSession(userId, secret, 1_000_000);
    await expect(
      verifyAdminSession(`${token}x`, secret, 1_000_000),
    ).resolves.toBeNull();
    await expect(
      verifyAdminSession(token, secret, 40_000_000),
    ).resolves.toBeNull();
  });
  it("requires database membership for the authenticated subject", () => {
    expect(hasAdminMembership({ sub: userId }, { user_id: userId })).toBe(true);
    expect(hasAdminMembership({ sub: userId }, null)).toBe(false);
    expect(
      hasAdminMembership(
        { sub: userId },
        { user_id: "00000000-0000-4000-8000-000000000100" },
      ),
    ).toBe(false);
  });
});
