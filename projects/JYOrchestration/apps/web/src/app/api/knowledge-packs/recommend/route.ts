import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { recommendKnowledgePacks } from "@/lib/knowledge-packs/knowledgePackRecommendationService";

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

  const text = String(body.text ?? "").trim();
  const projectId = body.projectId != null ? String(body.projectId).trim() || undefined : undefined;
  const agentRole = body.agentRole != null ? String(body.agentRole).trim() || undefined : undefined;
  const categoryHintsRaw = body.categoryHints;
  const categoryHints = Array.isArray(categoryHintsRaw)
    ? categoryHintsRaw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : undefined;
  const limitRaw = body.limit;
  const limit = limitRaw != null ? Number(limitRaw) : 5;

  if (!text) {
    return NextResponse.json({ ok: false, message: "text가 필요합니다." }, { status: 400 });
  }

  try {
    const { recommendations, diagnostics } = await recommendKnowledgePacks({
      userId,
      projectId,
      text,
      agentRole,
      categoryHints,
      limit: Number.isFinite(limit) ? limit : 5,
    });
    return NextResponse.json({ ok: true, recommendations, diagnostics });
  } catch {
    return NextResponse.json({ ok: false, message: "추천 처리 실패" }, { status: 500 });
  }
}
