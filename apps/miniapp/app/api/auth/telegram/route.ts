import { createServiceRoleClient } from "@house-of-stars/database";
import {
  TelegramInitDataError,
  TelegramInitDataHmacVerifier,
} from "@house-of-stars/telegram";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApplicationSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../../../../lib/session";

export const runtime = "nodejs";

const requestSchema = z.object({ initData: z.string().min(1) }).strict();
const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  APP_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Missing or invalid Telegram init data" },
      { status: 400 },
    );
  }

  const env = envSchema.parse(process.env);
  const verifier = new TelegramInitDataHmacVerifier({
    botToken: env.TELEGRAM_BOT_TOKEN,
    maxAgeSeconds: env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
  });
  let telegramUser;
  try {
    telegramUser = await verifier.verify(body.initData);
  } catch (error) {
    if (error instanceof TelegramInitDataError)
      return NextResponse.json(
        { error: "Telegram authentication failed" },
        { status: 401 },
      );
    throw error;
  }

  const supabase = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: user, error } = await supabase
    .from("users")
    .upsert(
      {
        telegram_user_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.firstName,
        last_name: telegramUser.lastName ?? null,
        photo_url: telegramUser.photoUrl ?? null,
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id")
    .single();
  if (error || !user) {
    console.error("Telegram user upsert failed", error?.code);
    return NextResponse.json(
      { error: "Unable to create application session" },
      { status: 500 },
    );
  }

  const token = await createApplicationSession(
    { userId: String(user.id), telegramUserId: telegramUser.id },
    env.APP_SESSION_SECRET,
  );
  const response = NextResponse.json({ user: telegramUser });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
