import { createServiceRoleClient } from "@house-of-stars/database";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  verifyApplicationSession,
} from "../../../lib/session";

export const runtime = "nodejs";
const envSchema = z.object({
  APP_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = envSchema.parse(process.env);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? await verifyApplicationSession(token, env.APP_SESSION_SECRET)
    : null;
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );

  const supabase = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const [profileResult, ordersResult] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, username, photo_url")
      .eq("id", session.sub)
      .single(),
    supabase
      .from("orders")
      .select("order_number, stars_amount, payout_asset, status, created_at")
      .eq("user_id", session.sub)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (profileResult.error || ordersResult.error) {
    console.error(
      "Dashboard query failed",
      profileResult.error?.code ?? ordersResult.error?.code,
    );
    return NextResponse.json(
      { error: "Unable to load dashboard" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    user: {
      firstName: profileResult.data.first_name,
      username: profileResult.data.username,
      photoUrl: profileResult.data.photo_url,
    },
    starsBalance: { status: "unavailable" },
    orders: (ordersResult.data ?? []).map((order) => ({
      orderNumber: String(order.order_number),
      starsAmount: Number(order.stars_amount),
      payoutAsset: order.payout_asset,
      status: order.status,
      createdAt: order.created_at,
    })),
  });
}
