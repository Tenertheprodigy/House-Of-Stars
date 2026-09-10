import { type NextRequest, NextResponse } from "next/server";
import { getServerSessionContext } from "../../../../../../lib/server-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { data: sellSession } = await supabase
    .from("sell_sessions")
    .select("order_id")
    .eq("user_id", session.sub)
    .eq("flow", "verified")
    .eq("selected_source", "fragment_other")
    .maybeSingle();
  if (!sellSession?.order_id)
    return NextResponse.json(
      { error: "Complete order details first." },
      { status: 404 },
    );
  const [{ data: order }, { data: evidence }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, stars_amount, payout_asset, payout_network, wallet_address, expected_payout_amount, status, quote_id",
      )
      .eq("id", sellSession.order_id)
      .eq("user_id", session.sub)
      .single(),
    supabase
      .from("order_evidence")
      .select("id, evidence_type, mime_type, size, uploaded_at")
      .eq("order_id", sellSession.order_id)
      .eq("user_id", session.sub)
      .order("uploaded_at"),
  ]);
  if (!order)
    return NextResponse.json({ error: "Draft unavailable." }, { status: 404 });
  return NextResponse.json({ order, evidence: evidence ?? [] });
}
