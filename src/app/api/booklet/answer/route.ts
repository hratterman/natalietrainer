import { NextResponse } from "next/server";
import { z } from "zod";
import { submitRecall } from "@/lib/booklet/engine";
import { errorResponse, parseBody } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const answerSchema = z
  .object({
    itemId: z.string().min(1),
    answer: z.string().max(20_000).default(""),
    msSpent: z.number().int().min(0).max(3_600_000).nullable().default(null),
    giveUp: z.boolean().default(false),
  })
  .refine((body) => body.giveUp || body.answer.trim().length > 0, {
    message: "answer must not be empty",
    path: ["answer"],
  });

export async function POST(request: Request) {
  const body = await parseBody(request, answerSchema);
  if (!body.ok) return body.response;
  try {
    const outcome = await submitRecall({
      itemId: body.data.itemId,
      answer: body.data.answer.trim(),
      msSpent: body.data.msSpent,
      giveUp: body.data.giveUp,
    });
    if (!outcome) {
      return NextResponse.json({ error: "Unknown booklet item." }, { status: 404 });
    }
    return NextResponse.json(outcome);
  } catch (err) {
    return errorResponse(err);
  }
}
