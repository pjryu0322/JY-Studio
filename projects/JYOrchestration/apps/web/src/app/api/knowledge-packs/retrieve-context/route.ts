import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { retrieveKnowledgePackContextByKeywords } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

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
  const topK = body.topK != null ? Number(body.topK) : 8;

  if (!knowledgePackId) return NextResponse.json({ ok: false, message: "knowledgePackId가 필요합니다." }, { status: 400 });
  if (!query) return NextResponse.json({ ok: false, message: "query가 필요합니다." }, { status: 400 });

  try {
    const chunks = await retrieveKnowledgePackContextByKeywords(userId, knowledgePackId, query, topK);
    return NextResponse.json({
      ok: true,
      mode: "keyword",
      chunks,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "검색 실패" }, { status: 500 });
  }
}
