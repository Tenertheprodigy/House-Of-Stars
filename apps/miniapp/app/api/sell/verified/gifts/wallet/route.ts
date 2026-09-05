import { DefaultWalletAddressValidator } from "@house-of-stars/wallet-validation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickSellConfig } from "../../../../../../config/server";
import { getServerSessionContext } from "../../../../../../lib/server-session";
const schema = z
  .object({ address: z.string().min(1), networkConfirmed: z.literal(true) })
  .strict();
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Confirm the wallet network." },
      { status: 400 },
    );
  const { data: state } = await supabase
    .from("sell_sessions")
    .select("quote_id")
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .maybeSingle();
  if (!state?.quote_id)
    return NextResponse.json({ error: "Quote unavailable." }, { status: 404 });
  const { data: quote } = await supabase
    .from("order_quotes")
    .select("payout_asset, payout_network")
    .eq("id", state.quote_id)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (!quote)
    return NextResponse.json({ error: "Quote unavailable." }, { status: 404 });
  const config = getQuickSellConfig();
  const wallet = new DefaultWalletAddressValidator(
    config.payoutAssets,
  ).validateAddress({
    asset: quote.payout_asset,
    network: quote.payout_network,
    address: parsed.data.address,
  });
  if (wallet.status !== "valid")
    return NextResponse.json(wallet, { status: 400 });
  const { data, error } = await supabase.rpc("prepare_gift_verified_order", {
    p_user_id: session.sub,
    p_quote_id: state.quote_id,
    p_wallet_address: wallet.normalizedAddress,
    p_settlement_days: config.giftSettlementDays,
  });
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order)
    return NextResponse.json(
      { error: "The quote expired or the gift session is unavailable." },
      { status: 409 },
    );
  const { data: walletMarked } = await supabase.rpc(
    "mark_order_wallet_validated",
    {
      p_order_id: order.order_id,
      p_wallet_address: wallet.normalizedAddress,
      p_network: wallet.network,
    },
  );
  if (!walletMarked)
    return NextResponse.json(
      { error: "Unable to record wallet validation." },
      { status: 500 },
    );
  return NextResponse.json({
    orderNumber: String(order.order_number),
    normalizedAddress: wallet.normalizedAddress,
  });
}
