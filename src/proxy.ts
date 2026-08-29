import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, appPin, expectedAuthToken } from "@/lib/auth";

/**
 * The PIN gate (Next 16 proxy convention — the file formerly known as
 * middleware). Every request outside the matcher's exclusions must carry the
 * auth cookie: pages bounce to /login, API calls get 401 JSON (an HTML
 * redirect would poison the client's SSE/JSON parsing).
 */

let tokenPromise: Promise<string> | null = null; // computed once per process

export async function proxy(request: NextRequest) {
  tokenPromise ??= expectedAuthToken(appPin());
  const expected = await tokenPromise;
  if (request.cookies.get(AUTH_COOKIE)?.value === expected) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // opengraph-image stays public: link-preview crawlers fetch it unauthenticated.
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|icon\\.svg|opengraph-image).*)",
  ],
};
