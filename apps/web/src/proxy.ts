import { NextResponse, type NextRequest } from "next/server";

/** Public aliases share the leaderboard. Sign-in and account pages use the configured OAuth
 * host, so PKCE/session cookies and an existing GitHub callback stay on the same domain. */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const accountRoute = ["/sign-in", "/dashboard", "/api/auth"].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  // The existing GitHub OAuth app is registered on this production origin. Vercel's
  // deployment currently has no AUTH_URL, so retain that callback host for aliases.
  const authOrigin = process.env.AUTH_URL || (process.env.VERCEL_ENV === "production" ? "https://token-maxxer-ten.vercel.app" : undefined);
  if (!accountRoute || !authOrigin) return NextResponse.next();
  const canonical = new URL(authOrigin);
  if (canonical.host === request.nextUrl.host) return NextResponse.next();
  return NextResponse.redirect(new URL(`${path}${request.nextUrl.search}`, canonical.origin));
}

export const config = {
  matcher: ["/sign-in/:path*", "/dashboard/:path*", "/api/auth/:path*"],
};
