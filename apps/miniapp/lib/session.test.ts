import { describe, expect, it } from "vitest";
import { createApplicationSession, verifyApplicationSession } from "./session";

const secret = "a-secure-test-secret-with-at-least-32-characters";
const identity = {
  userId: "11111111-1111-4111-8111-111111111111",
  telegramUserId: "123456",
};

describe("application sessions", () => {
  it("verifies a signed, unexpired session", async () => {
    const token = await createApplicationSession(identity, secret, 1000);
    await expect(
      verifyApplicationSession(token, secret, 1001),
    ).resolves.toMatchObject({ sub: identity.userId });
  });

  it("rejects tampered and expired sessions", async () => {
    const token = await createApplicationSession(identity, secret, 1000);
    await expect(
      verifyApplicationSession(`${token}x`, secret, 1001),
    ).resolves.toBeNull();
    await expect(
      verifyApplicationSession(token, secret, 5000),
    ).resolves.toBeNull();
  });
});
