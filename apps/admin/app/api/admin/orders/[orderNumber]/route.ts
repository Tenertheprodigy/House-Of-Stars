import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "../../../../../lib/admin-session";
import { getPayoutEligibility } from "../../../../../lib/admin-order-policy";

const numberSchema = z.coerce.number().int().positive();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
): Promise<NextResponse> {
  const { admin, supabase } = await getAuthorizedAdmin(request);
  if (!admin)
    return NextResponse.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const parsed = numberSchema.safeParse((await context.params).orderNumber);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid order number" },
      { status: 400 },
    );
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,user_id,stars_amount,payout_asset,payout_network,wallet_address,wallet_validated_at,wallet_validation_network,expected_payout_amount,status,type,source,quote_id,settlement_available_at,created_at,updated_at,users!orders_user_id_fkey(telegram_user_id,username,first_name,last_name),order_quotes!orders_quote_owner_fk(id,stars_amount,payout_asset,payout_network,expected_payout_amount,expires_at,created_at),order_events(id,event_type,from_status,to_status,payload,created_at,actor_user_id),order_evidence(id,storage_bucket,storage_path,evidence_type,sha256,mime_type,size,uploaded_at),payouts(id,status,created_at)",
    )
    .eq("order_number", parsed.data)
    .order("created_at", { referencedTable: "order_events", ascending: true })
    .maybeSingle();
  if (error) {
    console.error("Admin order query failed", error.code);
    return NextResponse.json(
      { error: "Unable to load order" },
      { status: 500 },
    );
  }
  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const [{ count: priorOrderCount }, { count: priorCompletedOrderCount }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", order.user_id)
        .lt("created_at", order.created_at),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", order.user_id)
        .eq("status", "paid")
        .lt("created_at", order.created_at),
    ]);
  const evidence = await Promise.all(
    order.order_evidence.map(async (item) => {
      const { data } = await supabase.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60);
      return {
        id: item.id,
        evidenceType: item.evidence_type,
        sha256: item.sha256,
        mimeType: item.mime_type,
        size: item.size,
        uploadedAt: item.uploaded_at,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
  const payoutEligibility = getPayoutEligibility({
    status: order.status,
    settlementAvailableAt: order.settlement_available_at,
    hasPayout: order.payouts.length > 0,
    walletValidated:
      order.wallet_validated_at !== null &&
      order.wallet_validation_network === order.payout_network,
  });
  return NextResponse.json({
    order: {
      ...order,
      order_evidence: undefined,
      evidence,
      priorOrderCount: priorOrderCount ?? 0,
      priorCompletedOrderCount: priorCompletedOrderCount ?? 0,
      payoutEligibility,
    },
  });
}
