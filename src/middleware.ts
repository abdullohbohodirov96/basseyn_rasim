import { NextRequest, NextResponse } from "next/server";

// Lightweight presence check only (Edge middleware can't use Node crypto/Prisma).
// Full HMAC verification happens in getAdminSession() on the server components.
const COOKIE_NAME = "admin_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const hasCookie = req.cookies.has(COOKIE_NAME);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
