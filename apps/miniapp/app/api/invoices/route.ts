import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const envBotUrl = process.env.BOT_API_URL ?? process.env.NEXT_PUBLIC_BOT_API_URL;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!envBotUrl) {
    return NextResponse.json(
      { ok: false, error: "Bot API URL not configured on the server" },
      { status: 500 },
    );
  }

  const target = envBotUrl.replace(/\/+$/, "") + "/invoices";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const resp = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    const contentType = resp.headers.get("content-type") ?? "application/json";
    const headers: Record<string, string> = { "content-type": contentType };
    return new NextResponse(text, { status: resp.status, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Proxy request failed: ${message}` }, { status: 502 });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
