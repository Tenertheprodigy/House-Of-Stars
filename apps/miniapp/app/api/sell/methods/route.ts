import { createServiceRoleClient } from "@house-of-stars/database";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickSellConfig } from "../../../../config/server";
import { determineQuickSellEligibility } from "../../../../lib/quick-sell-eligibility";
import {
  SESSION_COOKIE_NAME,
  verifyApplicationSession,
} from "../../../../lib/session";

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
  const config = getQuickSellConfig();
  const supabase = createServiceRoleClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await supabase
    .from("orders")
    .select("status, updated_at")
    .eq("user_id", session.sub)
    .eq("type", "quick")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Quick Sell eligibility query failed", error.code);
    return NextResponse.json(
      { error: "Unable to determine eligibility" },
      { status: 500 },
    );
  }
  const eligibility = determineQuickSellEligibility(
    (data ?? []).map((order) => ({
      status: order.status,
      updatedAt: order.updated_at,
    })),
    config,
  );
  return NextResponse.json({
    config: {
      quickSellMaxUsd: Number(config.quickSellMaxUsd),
      quickSellCooldownDays: config.quickSellCooldownDays,
    },
    quickSell: eligibility,
  });
}
