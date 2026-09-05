import {
  createBrowserClient,
  createServiceRoleClient,
} from "@house-of-stars/database";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
} from "../../../../../lib/admin-session";
const bodySchema = z
  .object({ email: z.email(), password: z.string().min(1) })
  .strict();
const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(32),
});
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 400 },
    );
  const env = envSchema.parse(process.env);
  const authClient = createBrowserClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
  );
  const { data, error } = await authClient.auth.signInWithPassword(body.data);
  if (error || !data.user)
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 },
    );
  const service = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: admin } = await service
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  await authClient.auth.signOut();
  if (!admin)
    return NextResponse.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE_NAME,
    await createAdminSession(data.user.id, env.ADMIN_SESSION_SECRET),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 28_800,
    },
  );
  return response;
}
