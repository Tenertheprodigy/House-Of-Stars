import { createServiceRoleClient } from "@house-of-stars/database";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME, verifyApplicationSession } from "./session";

const envSchema = z.object({
  APP_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});
export async function getServerSessionContext(request: NextRequest) {
  const env = envSchema.parse(process.env);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? await verifyApplicationSession(token, env.APP_SESSION_SECRET)
    : null;
  return {
    session,
    supabase: createServiceRoleClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
