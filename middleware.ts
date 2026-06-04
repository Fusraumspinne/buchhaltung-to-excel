import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE_NAME,
  PROFILE_SESSION_COOKIE_NAME,
  getProfilePath,
} from "@/lib/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaticFile = /\.[^/]+$/.test(pathname);
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApiRoute =
    pathname.startsWith("/api/profiles") || pathname === "/api/auth/logout";
  const isFrameworkAsset = pathname.startsWith("/_next");
  const activeProfileId = request.cookies.get(ACTIVE_PROFILE_COOKIE_NAME)?.value;
  const hasProfileSession = Boolean(
    request.cookies.get(PROFILE_SESSION_COOKIE_NAME)?.value
  );

  if (isStaticFile || isFrameworkAsset || isPublicApiRoute) {
    return NextResponse.next();
  }

  if (!hasProfileSession && isApiRoute) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (isApiRoute) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && hasProfileSession && activeProfileId) {
    return NextResponse.redirect(new URL(getProfilePath(activeProfileId), request.url));
  }

  if (pathname.startsWith("/profiles/")) {
    if (!hasProfileSession || !activeProfileId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const requestedProfileId = decodeURIComponent(pathname.split("/")[2] || "");
    if (requestedProfileId && requestedProfileId !== activeProfileId) {
      return NextResponse.redirect(new URL(getProfilePath(activeProfileId), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
