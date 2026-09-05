import { type NextRequest, NextResponse } from "next/server";
import { getAuthorizedAdmin } from "../../../../lib/admin-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { admin, supabase } = await getAuthorizedAdmin(request);
  if (!admin)
    return NextResponse.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  try {
    const results = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_evidence"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["payout_queued", "payout_broadcast"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .gt("settlement_available_at", new Date().toISOString()),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "paid")
        .gte("updated_at", today.toISOString()),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const [
      pendingReview,
      awaitingUser,
      approved,
      payoutQueue,
      delayedSettlement,
      completedToday,
    ] = results.map((result) => result.count ?? 0);
    return NextResponse.json({
      metrics: {
        pendingReview,
        awaitingUser,
        approved,
        payoutQueue,
        delayedSettlement,
        completedToday,
      },
    });
  } catch (error) {
    console.error(
      "Admin metrics failed",
      error instanceof Error ? error.name : "unknown_error",
    );
    return NextResponse.json(
      { error: "Unable to load dashboard metrics." },
      { status: 500 },
    );
  }
}
