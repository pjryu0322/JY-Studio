import { readCollaborationSessionIdFromRequest } from "@/lib/workflow/collaborationGenerationApiRequest";
import { generateMinutesForSession } from "@/lib/workflow/collaborationGenerationService";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const parsed = await readCollaborationSessionIdFromRequest(req);
  if (!parsed.ok) {
    return parsed.response;
  }

  const result = await generateMinutesForSession(parsed.sessionId);
  return NextResponse.json({ ok: true as const, result });
}
