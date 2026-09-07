import { DefaultWalletAddressValidator } from "@house-of-stars/wallet-validation";
import { type NextRequest, NextResponse } from "next/server";
import { getQuickSellConfig } from "../../../../../../config/server";
import { fragmentDetailsSchema } from "../../../../../../lib/fragment-sell";
import { calculateQuoteValues } from "../../../../../../lib/quote";
import { getServerSessionContext } from "../../../../../../lib/server-session";
import { resolvePayoutAssetPrice } from "../../../../../../lib/payout-asset-pricing";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const parsed = fragmentDetailsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Complete all order details." },
      { status: 400 },
    );
  const config = getQuickSellConfig();
  const asset = config.payoutAssets.find(
    (item) => item.asset === parsed.data.payoutAsset,
  );
  if (!asset)
    return NextResponse.json(
      { error: "Unsupported payout asset." },
      { status: 400 },
    );
  const wallet = new DefaultWalletAddressValidator(
    config.payoutAssets,
  ).validateAddress({
    asset: asset.asset,
    network: asset.network,
    address: parsed.data.walletAddress,
  });
  if (wallet.status !== "valid")
    return NextResponse.json(wallet, { status: 400 });
  let values;
  try {
    values = calculateQuoteValues(
      parsed.data.starsAmount,
      await resolvePayoutAssetPrice(asset),
      config,
      false,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to price payout asset." },
      { status: 503 },
    );
  }
  const expiresAt = new Date(
    Date.now() + config.quickSellQuoteTtlSeconds * 1000,
  ).toISOString();
  const { data: quote, error: quoteError } = await supabase
    .from("order_quotes")
    .insert({
      user_id: session.sub,
      stars_amount: values.starsAmount,
      usd_value: values.usdValue,
      payout_asset: values.payoutAsset,
      payout_network: values.payoutNetwork,
      expected_payout_amount: values.payoutAmount,
      exchange_rate: values.exchangeRate,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (quoteError || !quote)
    return NextResponse.json(
      { error: "Unable to create quote." },
      { status: 500 },
    );
  const { data, error } = await supabase.rpc(
    "prepare_fragment_verified_order",
    {
      p_user_id: session.sub,
      p_quote_id: quote.id,
      p_wallet_address: wallet.normalizedAddress,
    },
  );
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order)
    return NextResponse.json(
      { error: "Unable to prepare the verified order." },
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
  return NextResponse.json(
    {
      orderNumber: String(order.order_number),
      quote: { quoteId: quote.id, ...values, expiresAt },
    },
    { status: 201 },
  );
}
