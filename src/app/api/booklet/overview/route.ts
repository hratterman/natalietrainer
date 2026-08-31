import { NextResponse } from "next/server";
import { getOverview } from "@/lib/booklet/engine";
import { errorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getOverview());
  } catch (err) {
    return errorResponse(err);
  }
}
