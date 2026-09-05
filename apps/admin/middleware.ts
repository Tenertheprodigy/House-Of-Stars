import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "./lib/admin-session";
import {
  enforceAdminRateLimit,
  rejectCrossOriginMutation,
} from "./lib/request-security";
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const csrfFailure = rejectCrossOriginMutation(request);
  if (csrfFailure) return csrfFailure;
  if (request.nextUrl.pathname === "/api/admin/auth/login") {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    return (
      (await enforceAdminRateLimit(request, `ip:${ip}`, 5)) ??
      NextResponse.next()
    );
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (
    !secret ||
    secret.length < 32 ||
    !token ||
    !(await verifyAdminSession(token, secret))
  ) {
    if (!request.nextUrl.pathname.startsWith("/api/"))
      return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.json(
      { error: "Administrator authentication required" },
      { status: 401 },
    );
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const limited = await enforceAdminRateLimit(
      request,
      `session:${token}`,
      request.method === "GET" ? 120 : 20,
    );
    if (limited) return limited;
  }
  return NextResponse.next();
}
export const config = { matcher: ["/", "/orders/:path*", "/api/admin/:path*"] };
