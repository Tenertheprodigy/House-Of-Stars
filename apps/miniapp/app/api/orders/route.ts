import { orderStatusGroups } from "@house-of-stars/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionContext } from "../../../lib/server-session";

const PAGE_SIZE = 10;
const querySchema = z.object({
  tab: z
    .enum(["all", "processing", "completed", "needs_action"])
    .default("all"),
  page: z.coerce.number().int().positive().default(1),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid pagination request." },
      { status: 400 },
    );
  const { tab, page } = parsed.data;
  const statuses =
    tab === "processing"
      ? orderStatusGroups.processing
      : tab === "completed"
        ? orderStatusGroups.completed
        : tab === "needs_action"
          ? orderStatusGroups.needsAction
          : null;
  let query = supabase
    .from("orders")
    .select("order_number, stars_amount, payout_asset, status, created_at", {
      count: "exact",
    })
    .eq("user_id", session.sub);
  if (statuses) query = query.in("status", [...statuses]);
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("Orders list query failed", error.code);
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    orders: (data ?? []).map((order) => ({
      orderNumber: String(order.order_number),
      starsAmount: Number(order.stars_amount),
      payoutAsset: order.payout_asset,
      status: order.status,
      createdAt: order.created_at,
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    },
  });
}
