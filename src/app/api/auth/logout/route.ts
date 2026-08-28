import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

/** POST-only: a GET logout would be triggered by link prefetching. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
