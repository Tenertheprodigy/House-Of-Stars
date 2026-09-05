import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TelegramInitDataHmacVerifier } from "./init-data.js";

const botToken = "123456:test-token";
const nowSeconds = 1_800_000_000;
const user = {
  id: 123456789,
  username: "stellar",
  first_name: "Stella",
  last_name: "Ray",
  photo_url: "https://t.me/i/userpic/test.jpg",
};

function sign(fields: Record<string, string>): string {
  const data = new URLSearchParams(fields);
  const check = [...data.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  data.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return data.toString();
}

const verifier = new TelegramInitDataHmacVerifier({
  botToken,
  now: () => new Date(nowSeconds * 1000),
});

describe("TelegramInitDataHmacVerifier", () => {
  it("accepts a valid signature", async () => {
    const value = sign({
      auth_date: String(nowSeconds),
      query_id: "query",
      user: JSON.stringify(user),
    });
    await expect(verifier.verify(value)).resolves.toEqual({
      id: String(user.id),
      username: "stellar",
      firstName: "Stella",
      lastName: "Ray",
      photoUrl: "https://t.me/i/userpic/test.jpg",
    });
  });

  it("rejects an incorrect signature", async () => {
    const value = sign({
      auth_date: String(nowSeconds),
      user: JSON.stringify(user),
    }).replace(/hash=[^&]+/, `hash=${"0".repeat(64)}`);
    await expect(verifier.verify(value)).rejects.toMatchObject({
      code: "invalid_signature",
    });
  });

  it("rejects expired init data", async () => {
    const value = sign({
      auth_date: String(nowSeconds - 301),
      user: JSON.stringify(user),
    });
    await expect(verifier.verify(value)).rejects.toMatchObject({
      code: "expired",
    });
  });

  it("rejects modified Telegram user data", async () => {
    const value = sign({
      auth_date: String(nowSeconds),
      user: JSON.stringify(user),
    }).replace("Stella", "Mallory");
    await expect(verifier.verify(value)).rejects.toMatchObject({
      code: "invalid_signature",
    });
  });

  it("rejects missing init data", async () => {
    await expect(verifier.verify("")).rejects.toMatchObject({
      code: "missing",
    });
  });
});
