import { NextResponse } from "next/server";

export type ReadSessionIdOk = { ok: true; sessionId: string };
export type ReadSessionIdFail = { ok: false; response: NextResponse };

/** Shared POST body parsing for collaboration generation routes. */
export async function readCollaborationSessionIdFromRequest(req: Request): Promise<ReadSessionIdOk | ReadSessionIdFail> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false as const, error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const sessionId =
    typeof body === "object" && body !== null && "sessionId" in body && typeof (body as { sessionId: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";

  if (!sessionId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false as const, error: "sessionId is required" }, { status: 400 }),
    };
  }

  return { ok: true, sessionId };
}
