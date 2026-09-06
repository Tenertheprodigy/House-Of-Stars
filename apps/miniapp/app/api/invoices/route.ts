import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const envBotUrl =
  process.env.BOT_API_URL ?? process.env.NEXT_PUBLIC_BOT_API_URL;

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
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const resp = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Bot API returned a non-JSON response (HTTP ${resp.status})`,
        },
        { status: 502 },
      );
    }

    if (!result || typeof result !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: `Bot API returned an invalid response (HTTP ${resp.status})`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result, { status: resp.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Proxy request failed: ${message}` },
      { status: 502 },
    );
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
