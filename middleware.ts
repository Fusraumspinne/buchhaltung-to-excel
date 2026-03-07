import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthorized, LOGIN_PATH } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaticFile = /\.[^/]+$/.test(pathname);
  const isLoginRoute = pathname === LOGIN_PATH;
  const isAuthApiRoute = pathname.startsWith("/api/auth/");
  const isFrameworkAsset = pathname.startsWith("/_next");

  if (isStaticFile || isFrameworkAsset || isAuthApiRoute) {
    return NextResponse.next();
  }

  const authorized = isRequestAuthorized(request);

  if (!authorized && !isLoginRoute) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (authorized && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
