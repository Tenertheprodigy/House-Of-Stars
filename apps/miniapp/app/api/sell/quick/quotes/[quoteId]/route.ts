import { type NextRequest, NextResponse } from "next/server";
import { getServerSessionContext } from "../../../../../../lib/server-session";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { quoteId } = await params;
  const { data, error } = await supabase
    .from("order_quotes")
    .select(
      "id, stars_amount, usd_value, payout_asset, payout_network, expected_payout_amount, exchange_rate, expires_at, consumed_at",
    )
    .eq("id", quoteId)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  return NextResponse.json({
    quoteId: data.id,
    starsAmount: Number(data.stars_amount),
    usdValue: data.usd_value,
    payoutAsset: data.payout_asset,
    payoutNetwork: data.payout_network,
    payoutAmount: data.expected_payout_amount,
    exchangeRate: data.exchange_rate,
    expiresAt: data.expires_at,
    consumed: data.consumed_at !== null,
  });
}
