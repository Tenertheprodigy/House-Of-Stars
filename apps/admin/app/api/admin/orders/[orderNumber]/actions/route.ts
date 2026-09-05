import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "../../../../../../lib/admin-session";

const numberSchema = z.coerce.number().int().positive();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal("request_more_evidence"),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal("add_note"),
    reason: z.string().trim().min(1).max(5000),
  }),
  z.object({ action: z.literal("queue_payout") }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
): Promise<NextResponse> {
  const { admin, supabase } = await getAuthorizedAdmin(request);
  if (!admin)
    return NextResponse.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const number = numberSchema.safeParse((await context.params).orderNumber);
  const body = actionSchema.safeParse(await request.json().catch(() => null));
  if (!number.success || !body.success)
    return NextResponse.json(
      { error: "Invalid action request" },
      { status: 400 },
    );
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", number.data)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let result;
  if (body.data.action === "add_note")
    result = await supabase.rpc("admin_add_order_note", {
      p_admin_user_id: admin.sub,
      p_order_id: order.id,
      p_body: body.data.reason,
    });
  else if (body.data.action === "queue_payout")
    result = await supabase.rpc("admin_queue_payout", {
      p_admin_user_id: admin.sub,
      p_order_id: order.id,
      p_idempotency_key: `order:${order.id}:payout`,
    });
  else
    result = await supabase.rpc("admin_transition_order", {
      p_admin_user_id: admin.sub,
      p_order_id: order.id,
      p_action: body.data.action,
      p_reason: "reason" in body.data ? body.data.reason : null,
    });
  if (result.error) {
    console.error("Admin action failed", result.error.code);
    return NextResponse.json(
      { error: "The requested action is not allowed in the current state." },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true });
}
