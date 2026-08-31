import { NextResponse } from "next/server";
import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { parseLocalDate } from "@/lib/booklet/scheduler";
import { errorResponse, parseBody } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  superdayDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dailyMinutes: z.number().int().min(15).max(360),
});

export async function POST(request: Request) {
  const body = await parseBody(request, settingsSchema);
  if (!body.ok) return body.response;
  try {
    if (body.data.superdayDate && parseLocalDate(body.data.superdayDate) == null) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    repo.saveBookletSettings(body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
