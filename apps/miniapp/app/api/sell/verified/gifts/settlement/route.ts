import { type NextRequest, NextResponse } from "next/server";
import { getQuickSellConfig } from "../../../../../../config/server";
import { getServerSessionContext } from "../../../../../../lib/server-session";
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { data, error } = await supabase
    .from("sell_sessions")
    .select("settlement_notice_accepted_at")
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .maybeSingle();
  if (error) {
    console.error("Gift settlement lookup failed", error.code);
    return NextResponse.json(
      { error: "Unable to load Gift settlement." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    accepted: Boolean(data?.settlement_notice_accepted_at),
    settlementDays: getQuickSellConfig().giftSettlementDays,
  });
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const body = (await request.json().catch(() => null)) as {
    acknowledged?: unknown;
  } | null;
  if (body?.acknowledged !== true)
    return NextResponse.json(
      { error: "Acknowledgement is required." },
      { status: 400 },
    );
  const { data, error } = await supabase
    .from("sell_sessions")
    .update({
      settlement_notice_accepted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("Gift settlement acknowledgement failed", error?.code);
    return NextResponse.json(
      { error: "Gift sell session unavailable." },
      { status: 409 },
    );
  }
  return NextResponse.json({
    accepted: true,
    settlementDays: getQuickSellConfig().giftSettlementDays,
  });
}
