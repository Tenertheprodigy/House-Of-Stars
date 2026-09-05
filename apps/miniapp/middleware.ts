import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifyApplicationSession } from "./lib/session";
import {
  enforceDistributedRateLimit,
  rejectCrossOriginMutation,
  requestIpSubject,
} from "./lib/request-security";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const csrfFailure = rejectCrossOriginMutation(request);
  if (csrfFailure) return csrfFailure;
  if (request.nextUrl.pathname === "/api/auth/telegram") {
    const limited = await enforceDistributedRateLimit(
      request,
      `ip:${requestIpSubject(request)}`,
      10,
    );
    return limited ?? NextResponse.next();
  }
  const secret = process.env.APP_SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (
    !secret ||
    secret.length < 32 ||
    !token ||
    !(await verifyApplicationSession(token, secret))
  ) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const limited = await enforceDistributedRateLimit(
    request,
    `session:${token}`,
    request.method === "GET" ? 120 : 30,
  );
  return limited ?? NextResponse.next();
}

export const config = {
  matcher: [
    "/api/me/:path*",
    "/api/dashboard/:path*",
    "/api/sell/:path*",
    "/api/orders/:path*",
    "/api/auth/telegram",
  ],
};
