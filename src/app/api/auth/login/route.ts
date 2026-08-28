import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, AUTH_MAX_AGE, appPin, expectedAuthToken } from "@/lib/auth";
import { parseBody } from "@/lib/api/validate";

const loginSchema = z.object({ pin: z.string().min(1).max(32) });

export async function POST(request: Request) {
  const body = await parseBody(request, loginSchema);
  if (!body.ok) return body.response;
  if (body.data.pin !== appPin()) {
    // Flat delay on every wrong attempt: slows brute force, no timing oracle.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedAuthToken(body.data.pin), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
    // No `secure` flag: the target deployment may serve plain HTTP on
    // localhost/Tailscale; the reverse proxy adds HTTPS on the public host.
  });
  return res;
}
