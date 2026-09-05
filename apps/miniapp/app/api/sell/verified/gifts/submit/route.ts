import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionContext } from "../../../../../../lib/server-session";
const schema = z.object({ confirmed: z.literal(true) }).strict();
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  if (!schema.safeParse(await request.json().catch(() => null)).success)
    return NextResponse.json(
      { error: "Confirmation is required." },
      { status: 400 },
    );
  const { data, error } = await supabase.rpc("submit_gift_verified_order", {
    p_user_id: session.sub,
  });
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order)
    return NextResponse.json(
      { error: "Required gift evidence is missing." },
      { status: 409 },
    );
  return NextResponse.json({ orderNumber: String(order.order_number) });
}
