import { z } from "zod";

export const SESSION_COOKIE_NAME = "hos_session";
export const SESSION_TTL_SECONDS = 60 * 60;

const sessionPayloadSchema = z.object({
  sub: z.uuid(),
  telegramUserId: z.string().regex(/^\d+$/),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type ApplicationSession = z.infer<typeof sessionPayloadSchema>;

function encode(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encode(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ),
  );
}

export async function createApplicationSession(
  identity: { userId: string; telegramUserId: string },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload = encode(
    new TextEncoder().encode(
      JSON.stringify({
        sub: identity.userId,
        telegramUserId: identity.telegramUserId,
        iat: nowSeconds,
        exp: nowSeconds + SESSION_TTL_SECONDS,
      }),
    ),
  );
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifyApplicationSession(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<ApplicationSession | null> {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = await signature(payload, secret);
  const left = new TextEncoder().encode(suppliedSignature);
  const right = new TextEncoder().encode(expectedSignature);
  if (left.length !== right.length) return null;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index]! ^ right[index]!;
  if (difference !== 0) return null;
  try {
    const parsed = sessionPayloadSchema.parse(
      JSON.parse(new TextDecoder().decode(decode(payload))),
    );
    return parsed.exp > nowSeconds && parsed.iat <= nowSeconds + 30
      ? parsed
      : null;
  } catch {
    return null;
  }
}
