import { NextResponse } from "next/server";
import { voiceAvailable } from "@/lib/voice/openai";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ available: voiceAvailable() });
}
