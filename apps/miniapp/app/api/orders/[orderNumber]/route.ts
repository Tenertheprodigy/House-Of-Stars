import { type NextRequest, NextResponse } from "next/server";
import { getQuickSellConfig } from "../../../../config/server";
import { buildPublicTimeline } from "../../../../lib/order-detail";
import { getServerSessionContext } from "../../../../lib/server-session";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { orderNumber } = await context.params;
  if (!/^\d+$/.test(orderNumber))
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, stars_amount, payout_asset, payout_network, wallet_address, expected_payout_amount, status, source, created_at, settlement_available_at",
    )
    .eq("order_number", orderNumber)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const [{ data: events }, { data: payout }] = await Promise.all([
    supabase
      .from("order_events")
      .select("id, event_type, to_status, created_at")
      .eq("order_id", data.id)
      .order("id", { ascending: true }),
    supabase
      .from("payouts")
      .select("public_transaction_id, public_transaction_url")
      .eq("order_id", data.id)
      .maybeSingle(),
  ]);
  const config = getQuickSellConfig();
  return NextResponse.json({
    order: {
      orderNumber: String(data.order_number),
      starsAmount: Number(data.stars_amount),
      payoutAsset: data.payout_asset,
      payoutNetwork: data.payout_network,
      walletAddress: data.wallet_address,
      estimatedAmount: data.expected_payout_amount,
      status: data.status,
      source: data.source,
      createdAt: data.created_at,
      settlementAvailableAt: data.settlement_available_at,
    },
    timeline: buildPublicTimeline(events ?? []),
    transaction:
      payout?.public_transaction_id && payout.public_transaction_url
        ? {
            id: payout.public_transaction_id,
            url: payout.public_transaction_url,
          }
        : null,
    estimatedProcessingDays: config.estimatedProcessingDays ?? null,
  });
}
