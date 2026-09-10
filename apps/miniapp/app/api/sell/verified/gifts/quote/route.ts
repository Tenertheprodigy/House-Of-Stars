import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickSellConfig } from "../../../../../../config/server";
import { calculateQuoteValues } from "../../../../../../lib/quote";
import { getServerSessionContext } from "../../../../../../lib/server-session";
import { resolvePayoutAssetPrice } from "../../../../../../lib/payout-asset-pricing";
const schema = z
  .object({
    starsAmount: z.number().int().positive(),
    payoutAsset: z.string().min(1).optional(),
  })
  .strict();
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { data: state, error: stateError } = await supabase
    .from("sell_sessions")
    .select("quote_id")
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .maybeSingle();
  if (stateError) {
    console.error("Gift quote session lookup failed", stateError.code);
    return NextResponse.json(
      { error: "Unable to load the Gift quote session." },
      { status: 500 },
    );
  }
  if (!state?.quote_id)
    return NextResponse.json({ error: "Quote unavailable." }, { status: 404 });
  const { data } = await supabase
    .from("order_quotes")
    .select(
      "id, stars_amount, usd_value, payout_asset, payout_network, expected_payout_amount, exchange_rate, expires_at",
    )
    .eq("id", state.quote_id)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (!data)
    return NextResponse.json({ error: "Quote unavailable." }, { status: 404 });
  return NextResponse.json({
    quoteId: data.id,
    starsAmount: Number(data.stars_amount),
    usdValue: data.usd_value,
    payoutAsset: data.payout_asset,
    payoutNetwork: data.payout_network,
    payoutAmount: data.expected_payout_amount,
    exchangeRate: data.exchange_rate,
    expiresAt: data.expires_at,
  });
}
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
      { error: "Enter a positive whole number of Stars." },
      { status: 400 },
    );
  const { data: state, error: stateError } = await supabase
    .from("sell_sessions")
    .select("id, settlement_notice_accepted_at, order_id")
    .eq("user_id", session.sub)
    .eq("selected_source", "gifts")
    .maybeSingle();
  if (stateError) {
    console.error("Gift sell session lookup failed", stateError.code);
    return NextResponse.json(
      { error: "Unable to load the Gift sell session." },
      { status: 500 },
    );
  }
  if (!state?.settlement_notice_accepted_at || state.order_id)
    return NextResponse.json(
      { error: "Gift settlement step is incomplete." },
      { status: 409 },
    );
  const config = getQuickSellConfig();
  const asset =
    config.payoutAssets.find((i) => i.asset === parsed.data.payoutAsset) ??
    (!parsed.data.payoutAsset ? config.payoutAssets[0] : undefined);
  if (!asset)
    return NextResponse.json(
      { error: "Unsupported payout asset." },
      { status: 400 },
    );
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to price payout asset.",
      },
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
  if (quoteError || !quote) {
    console.error("Gift quote creation failed", quoteError?.code);
    return NextResponse.json(
      { error: "Unable to create quote." },
      { status: 500 },
    );
  }
  const { error: sessionError } = await supabase
    .from("sell_sessions")
    .update({
      quote_id: quote.id,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq("id", state.id);
  if (sessionError) {
    console.error("Gift quote session update failed", sessionError.code);
    return NextResponse.json(
      { error: "Unable to save the Gift quote." },
      { status: 500 },
    );
  }
  return NextResponse.json({ quoteId: quote.id, ...values, expiresAt });
}
