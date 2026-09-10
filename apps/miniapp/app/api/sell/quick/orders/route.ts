import { DefaultWalletAddressValidator } from "@house-of-stars/wallet-validation";
import { type NextRequest, NextResponse } from "next/server";
import { getQuickSellConfig } from "../../../../../config/server";
import { determineQuickSellEligibility } from "../../../../../lib/quick-sell-eligibility";
import { quickSellOrderRequestSchema } from "../../../../../lib/quick-sell-order";
import { getServerSessionContext } from "../../../../../lib/server-session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  let body;
  try {
    body = quickSellOrderRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid order confirmation." },
      { status: 400 },
    );
  }
  const config = getQuickSellConfig();
  const [{ data: quote }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase
        .from("order_quotes")
        .select(
          "stars_amount, payout_asset, payout_network, expires_at, consumed_at",
        )
        .eq("id", body.quoteId)
        .eq("user_id", session.sub)
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id, order_number, status, updated_at, quote_id, wallet_address, wallet_validated_at, wallet_validation_network, payout_network",
        )
        .eq("user_id", session.sub)
        .eq("type", "quick"),
    ]);
  if (!quote || ordersError)
    return NextResponse.json(
      { error: "Quote is unavailable or does not belong to this user." },
      { status: 400 },
    );
  const { data: payment, error: paymentError } = await supabase
    .from("payment_charges")
    .select("id")
    .eq("user_id", session.sub)
    .eq("status", "paid")
    .eq("currency", "XTR")
    .eq("total_amount", quote.stars_amount)
    .contains("payload", { pr: "q", o: body.quoteId })
    .limit(1)
    .maybeSingle();
  if (paymentError) {
    console.error("Quick Sell payment verification failed", paymentError.code);
    return NextResponse.json(
      { error: "Unable to verify the Telegram payment." },
      { status: 500 },
    );
  }
  if (!payment) {
    return NextResponse.json(
      { error: "Telegram payment confirmation is still processing." },
      { status: 425 },
    );
  }
  const existingForQuote = (orders ?? []).find(
    (order) => order.quote_id === body.quoteId,
  );
  if (!existingForQuote) {
    if (quote.consumed_at || Date.parse(quote.expires_at) <= Date.now())
      return NextResponse.json(
        { error: "Quote has expired or was already used." },
        { status: 409 },
      );
    const eligibility = determineQuickSellEligibility(
      (orders ?? []).map((order) => ({
        status: order.status,
        updatedAt: order.updated_at,
      })),
      config,
    );
    if (eligibility.status !== "eligible")
      return NextResponse.json({ error: eligibility.reason }, { status: 409 });
  }
  const configured = config.payoutAssets.some(
    (item) =>
      item.asset === quote.payout_asset &&
      item.network === quote.payout_network,
  );
  if (!configured)
    return NextResponse.json(
      { error: "Quote payout network is no longer supported." },
      { status: 400 },
    );
  const wallet = new DefaultWalletAddressValidator(
    config.payoutAssets,
  ).validateAddress({
    asset: quote.payout_asset,
    network: quote.payout_network,
    address: body.walletAddress,
  });
  if (wallet.status !== "valid")
    return NextResponse.json(wallet, { status: 400 });
  if (existingForQuote) {
    if (
      existingForQuote.wallet_address !== wallet.normalizedAddress ||
      existingForQuote.payout_network !== wallet.network
    )
      return NextResponse.json(
        {
          error:
            "This paid quote already created an order with a different destination. Open the existing order instead.",
          orderNumber: String(existingForQuote.order_number),
        },
        { status: 409 },
      );
    if (
      existingForQuote.wallet_validated_at &&
      existingForQuote.wallet_validation_network === wallet.network
    )
      return NextResponse.json(
        { orderNumber: String(existingForQuote.order_number) },
        { status: 200 },
      );
  }
  const { data, error } = await supabase.rpc("create_quick_sell_order", {
    p_user_id: session.sub,
    p_quote_id: body.quoteId,
    p_wallet_address: wallet.normalizedAddress,
    p_max_usd: config.quickSellMaxUsd,
    p_cooldown_days: config.quickSellCooldownDays,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result) {
    console.error("Quick Sell order transaction failed", error?.code);
    return NextResponse.json(
      { error: "The quote changed, expired, or is no longer eligible." },
      { status: 409 },
    );
  }
  const { data: walletMarked } = await supabase.rpc(
    "mark_order_wallet_validated",
    {
      p_order_id: result.order_id,
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
    { orderNumber: String(result.order_number) },
    { status: 201 },
  );
}
