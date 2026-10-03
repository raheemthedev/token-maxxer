import { NextResponse, type NextRequest } from "next/server";

/** Public aliases share the leaderboard. Sign-in and account pages use the configured OAuth
 * host, so PKCE/session cookies and an existing GitHub callback stay on the same domain. */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const accountRoute = ["/sign-in", "/dashboard", "/api/auth"].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  if (!accountRoute || !process.env.AUTH_URL) return NextResponse.next();
  const canonical = new URL(process.env.AUTH_URL);
  if (canonical.host === request.nextUrl.host) return NextResponse.next();
  return NextResponse.redirect(new URL(`${path}${request.nextUrl.search}`, canonical.origin));
}

export const config = {
  matcher: ["/sign-in/:path*", "/dashboard/:path*", "/api/auth/:path*"],
};
