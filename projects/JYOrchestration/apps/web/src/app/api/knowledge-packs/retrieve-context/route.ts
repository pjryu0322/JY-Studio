import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { retrieveKnowledgePackKeywordRetrievalResult } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const knowledgePackId = String(body.knowledgePackId ?? "").trim();
  const query = String(body.query ?? "").trim();
  const limitRaw = body.limit ?? body.topK;
  const limit = limitRaw != null ? Number(limitRaw) : 8;

  if (!knowledgePackId) return NextResponse.json({ ok: false, message: "knowledgePackId가 필요합니다." }, { status: 400 });
  if (!query) return NextResponse.json({ ok: false, message: "query가 필요합니다." }, { status: 400 });

  try {
    const result = await retrieveKnowledgePackKeywordRetrievalResult(
      userId,
      knowledgePackId,
      query,
      Number.isFinite(limit) ? limit : 8
    );
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      knowledgePackId: result.knowledgePackId,
      query: result.query,
      chunks: result.chunks,
      promptContext: result.promptContext,
      diagnostics: result.diagnostics,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "검색 실패" }, { status: 500 });
  }
}
