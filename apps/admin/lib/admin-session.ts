import { createServiceRoleClient } from "@house-of-stars/database";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const ADMIN_COOKIE_NAME = "hos_admin_session";
const encoder = new TextEncoder();
const payloadSchema = z.object({
  sub: z.uuid(),
  exp: z.number().int(),
  aud: z.literal("house-of-stars-admin"),
});
const base64url = (value: Uint8Array | string): string =>
  Buffer.from(
    typeof value === "string" ? encoder.encode(value) : value,
  ).toString("base64url");
async function signature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
  );
}
export async function createAdminSession(
  userId: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(now / 1000) + 8 * 60 * 60,
      aud: "house-of-stars-admin",
    }),
  );
  return `${payload}.${await signature(payload, secret)}`;
}
export async function verifyAdminSession(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<{ sub: string } | null> {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = await signature(payload, secret);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1)
    difference |= a[index]! ^ b[index]!;
  if (difference !== 0) return null;
  try {
    const parsed = payloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.exp > Math.floor(now / 1000) ? { sub: parsed.sub } : null;
  } catch {
    return null;
  }
}

export function hasAdminMembership(
  session: { sub: string } | null,
  membership: { user_id: string } | null,
): boolean {
  return session !== null && membership?.user_id === session.sub;
}
const envSchema = z.object({
  ADMIN_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});
export async function getAuthorizedAdmin(request: NextRequest) {
  const env = envSchema.parse(process.env);
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = token
    ? await verifyAdminSession(token, env.ADMIN_SESSION_SECRET)
    : null;
  const supabase = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!session) return { admin: null, supabase };
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.sub)
    .maybeSingle();
  return {
    admin: hasAdminMembership(session, data) ? session : null,
    supabase,
  };
}
