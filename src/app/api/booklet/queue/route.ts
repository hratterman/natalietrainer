import { NextResponse } from "next/server";
import { getTodayQueue } from "@/lib/booklet/engine";
import { errorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getTodayQueue());
  } catch (err) {
    return errorResponse(err);
  }
}
