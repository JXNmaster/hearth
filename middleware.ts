import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/feature-flags")
  ) {
    return NextResponse.next();
  }

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for NextAuth session token (JWT strategy stores in cookie)
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.otf$|fonts/).*)",
  ],
};
