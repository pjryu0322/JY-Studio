import { NextResponse } from "next/server";
import { appendFeedbackEvent } from "@/lib/templateFeedback/feedbackRepository";
import type { TemplateFeedbackEvent } from "@/lib/templateFeedback/feedbackTypes";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TemplateFeedbackEvent | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.eventType || !body.family || !body.docType || !body.docId) {
    return NextResponse.json(
      { error: "eventType/family/docType/docId are required" },
      { status: 400 }
    );
  }
  await appendFeedbackEvent(body);
  return NextResponse.json({ ok: true });
}
