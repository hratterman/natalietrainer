import { afterEach, describe, expect, it } from "vitest";
import { expectedAuthToken } from "@/lib/auth";

afterEach(() => {
  delete process.env.APP_PIN;
});

function jsonRequest(body: unknown): Request {
  return new Request("http://test/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth routes", () => {
  it("rejects a wrong PIN with 401, no cookie, and a flat delay", async () => {
    const { POST } = await import("./login/route");
    const started = Date.now();
    const res = await POST(jsonRequest({ pin: "0000" }));
    expect(Date.now() - started).toBeGreaterThanOrEqual(350);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("accepts the right PIN and sets a hardened year-long cookie", async () => {
    const { POST } = await import("./login/route");
    const res = await POST(jsonRequest({ pin: "1234" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`nt_auth=${await expectedAuthToken("1234")}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Max-Age=31536000");
  });

  it("respects APP_PIN when set", async () => {
    process.env.APP_PIN = "8642";
    const { POST } = await import("./login/route");
    expect((await POST(jsonRequest({ pin: "1234" }))).status).toBe(401);
    expect((await POST(jsonRequest({ pin: "8642" }))).status).toBe(200);
  });

  it("400s malformed bodies", async () => {
    const { POST } = await import("./login/route");
    const res = await POST(jsonRequest({ nope: true }));
    expect(res.status).toBe(400);
  });

  it("logout expires the cookie", async () => {
    const { POST } = await import("./logout/route");
    const res = await POST();
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("nt_auth=");
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
