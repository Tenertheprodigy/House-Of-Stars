import { type NextRequest, NextResponse } from "next/server";
import { getServerSessionContext } from "../../../../../../lib/server-session";
import { getQuickSellConfig } from "../../../../../../config/server";
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { data: state } = await supabase
    .from("sell_sessions")
    .select("order_id")
    .eq("user_id", session.sub)
    .eq("selected_source", "apple_google")
    .maybeSingle();
  if (!state?.order_id)
    return NextResponse.json(
      { error: "Complete order details first." },
      { status: 404 },
    );
  const [{ data: order }, { data: evidence }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, stars_amount, payout_asset, payout_network, wallet_address, expected_payout_amount, status, quote_id, settlement_available_at",
      )
      .eq("id", state.order_id)
      .eq("user_id", session.sub)
      .single(),
    supabase
      .from("order_evidence")
      .select("id, evidence_type, mime_type, size, uploaded_at")
      .eq("order_id", state.order_id)
      .eq("user_id", session.sub)
      .order("uploaded_at"),
  ]);
  if (!order)
    return NextResponse.json({ error: "Draft unavailable." }, { status: 404 });
  const { data: quote } = await supabase
    .from("order_quotes")
    .select("usd_value, fees, exchange_rate, price_source, price_updated_at")
    .eq("id", order.quote_id)
    .eq("user_id", session.sub)
    .single();
  const config = getQuickSellConfig();
  return NextResponse.json({
    order,
    quote,
    starUsdRate: config.quickSellUsdPerStar,
    platformFeePercent: config.platformFeeRate,
    evidence: evidence ?? [],
  });
}
