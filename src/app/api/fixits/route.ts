import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { fixitView } from "@/lib/api/fixitView";
import { errorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const active = repo.listActiveFixits().map(fixitView);
    return NextResponse.json({
      open: active.filter((f) => f.status === "open"),
      due: active.filter((f) => f.dueForCheck),
      pending: active.filter((f) => f.status === "resolved" && !f.dueForCheck),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
