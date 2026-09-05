import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuickSellConfig } from "../../../../../config/server";
import { calculateQuoteValues } from "../../../../../lib/quote";
import { determineQuickSellEligibility } from "../../../../../lib/quick-sell-eligibility";
import { getServerSessionContext } from "../../../../../lib/server-session";

const requestSchema = z
  .object({
    starsAmount: z.number().int().positive(),
    payoutAsset: z.string().min(1).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Enter a positive whole number of Stars." },
      { status: 400 },
    );
  }
  const config = getQuickSellConfig();
  const asset =
    config.payoutAssets.find((entry) => entry.asset === body.payoutAsset) ??
    (body.payoutAsset ? undefined : config.payoutAssets[0]);
  if (!asset)
    return NextResponse.json(
      { error: "Unsupported payout asset." },
      { status: 400 },
    );
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("status, updated_at")
    .eq("user_id", session.sub)
    .eq("type", "quick");
  if (ordersError)
    return NextResponse.json(
      { error: "Unable to check eligibility." },
      { status: 500 },
    );
  const eligibility = determineQuickSellEligibility(
    (orders ?? []).map((order) => ({
      status: order.status,
      updatedAt: order.updated_at,
    })),
    config,
  );
  if (eligibility.status !== "eligible")
    return NextResponse.json(
      { error: eligibility.reason, eligibility },
      { status: 409 },
    );
  let values;
  try {
    values = calculateQuoteValues(body.starsAmount, asset, config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid amount." },
      { status: 400 },
    );
  }
  const expiresAt = new Date(
    Date.now() + config.quickSellQuoteTtlSeconds * 1000,
  ).toISOString();
  const { data: quote, error } = await supabase
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
  if (error || !quote)
    return NextResponse.json(
      { error: "Unable to create quote." },
      { status: 500 },
    );
  return NextResponse.json({
    quoteId: quote.id,
    starsAmount: values.starsAmount,
    usdValue: values.usdValue,
    payoutAsset: values.payoutAsset,
    payoutNetwork: values.payoutNetwork,
    payoutAmount: values.payoutAmount,
    exchangeRate: values.exchangeRate,
    expiresAt,
  });
}
