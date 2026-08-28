import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { errorResponse } from "@/lib/api/validate";
import { fixitView } from "@/lib/api/fixitView";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const fixit = repo.getFixit(id);
    if (!fixit) return NextResponse.json({ error: "Fixit not found." }, { status: 404 });
    return NextResponse.json({ fixit: fixitView(fixit) });
  } catch (err) {
    return errorResponse(err);
  }
}
