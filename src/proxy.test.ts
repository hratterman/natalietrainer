import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";
import { expectedAuthToken } from "@/lib/auth";

afterEach(() => {
  delete process.env.APP_PIN;
});

function req(url: string, cookie?: string): NextRequest {
  const headers = cookie ? { cookie: `nt_auth=${cookie}` } : undefined;
  return new NextRequest(url, { headers });
}

describe("PIN gate proxy", () => {
  it("has a matcher that skips login, auth routes, and static assets", () => {
    // The matcher is path-to-regexp with one embedded lookahead — mirror it.
    expect(config.matcher).toHaveLength(1);
    const re = /^\/(?!login|api\/auth|_next\/static|_next\/image|favicon\.ico|icon\.svg).*$/;
    expect(re.test("/login")).toBe(false);
    expect(re.test("/api/auth/login")).toBe(false);
    expect(re.test("/_next/static/x.css")).toBe(false);
    expect(re.test("/icon.svg")).toBe(false);
    expect(re.test("/")).toBe(true);
    expect(re.test("/history")).toBe(true);
    expect(re.test("/api/progress")).toBe(true);
    expect(re.test("/api/sessions/abc/answer")).toBe(true);
  });

  it("401s API requests without the cookie (JSON, not a redirect)", async () => {
    const res = await proxy(req("http://test/api/progress"));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("redirects pages without the cookie to /login with a from param", async () => {
    const res = await proxy(req("http://test/history"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe("/history");
  });

  it("redirects the root without a from param", async () => {
    const res = await proxy(req("http://test/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).searchParams.get("from")).toBeNull();
  });

  it("passes through with the correct cookie", async () => {
    const token = await expectedAuthToken("1234");
    const res = await proxy(req("http://test/api/progress", token));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("derives different tokens for different PINs (a restart invalidates old cookies)", async () => {
    expect(await expectedAuthToken("9999")).not.toBe(await expectedAuthToken("1234"));
  });
});
