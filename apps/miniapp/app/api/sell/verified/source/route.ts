import { type NextRequest, NextResponse } from "next/server";
import { getServerSessionContext } from "../../../../../lib/server-session";
import {
  verifiedSellSourceDestinations,
  verifiedSellSourceRequestSchema,
} from "../../../../../lib/verified-sell-source";

export const runtime = "nodejs";
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const { data, error } = await supabase
    .from("sell_sessions")
    .select("selected_source, expires_at")
    .eq("user_id", session.sub)
    .eq("flow", "verified")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("Verified sell session lookup failed", error.code);
    return NextResponse.json(
      { error: "Unable to load sell session" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    source: data?.selected_source ?? null,
    expiresAt: data?.expires_at ?? null,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, supabase } = await getServerSessionContext(request);
  if (!session)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  const parsed = verifiedSellSourceRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Select a valid Stars source" },
      { status: 400 },
    );
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  const { error } = await supabase.from("sell_sessions").upsert(
    {
      user_id: session.sub,
      flow: "verified",
      selected_source: parsed.data.source,
      expires_at: expiresAt,
      quote_id: null,
      order_id: null,
      wallet_address: null,
      wallet_confirmed: false,
      settlement_notice_accepted_at: null,
    },
    { onConflict: "user_id,flow" },
  );
  if (error) {
    console.error("Verified sell session update failed", error.code);
    return NextResponse.json(
      { error: "Unable to save your selection" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    source: parsed.data.source,
    expiresAt,
    nextPath: verifiedSellSourceDestinations[parsed.data.source],
  });
}
