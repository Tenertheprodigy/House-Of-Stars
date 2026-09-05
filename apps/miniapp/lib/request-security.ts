import { NextResponse, type NextRequest } from "next/server";

export function rejectCrossOriginMutation(
  request: NextRequest,
): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return origin === request.nextUrl.origin
    ? null
    : NextResponse.json(
        { error: "Cross-origin request rejected" },
        { status: 403 },
      );
}

export async function enforceDistributedRateLimit(
  request: NextRequest,
  subject: string,
  limit: number,
  windowSeconds = 60,
): Promise<NextResponse | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Service configuration unavailable" },
      { status: 503 },
    );
  const material = `${request.nextUrl.pathname}:${subject}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  const keyHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/consume_api_rate_limit`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Rate limit service unavailable" },
      { status: 503 },
    );
  }
  if (!response.ok)
    return NextResponse.json(
      { error: "Rate limit service unavailable" },
      { status: 503 },
    );
  const rows = (await response.json()) as Array<{
    allowed: boolean;
    remaining: number;
    reset_at: string;
  }>;
  const result = rows[0];
  if (!result?.allowed)
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "retry-after": String(
            Math.max(
              1,
              Math.ceil(
                (Date.parse(result?.reset_at ?? "") - Date.now()) / 1000,
              ),
            ),
          ),
        },
      },
    );
  return null;
}

export function requestIpSubject(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
