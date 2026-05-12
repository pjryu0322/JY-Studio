import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { buildKnowledgePackContextForDeveloperTask } from "@/lib/knowledge-packs/knowledgePackPromptInjectionAdapter";

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
  const taskTitle = String(body.taskTitle ?? "").trim() || undefined;
  const taskDescription = String(body.taskDescription ?? "").trim() || undefined;
  const limitRaw = body.limit ?? body.topK;
  const limit = limitRaw != null ? Number(limitRaw) : 5;

  if (!knowledgePackId.startsWith("kp_")) {
    return NextResponse.json({ ok: false, message: "유효한 knowledgePackId(kp_…)가 필요합니다." }, { status: 400 });
  }
  if (!query) {
    return NextResponse.json({ ok: false, message: "query가 필요합니다." }, { status: 400 });
  }

  try {
    const { contextText, diagnostics } = await buildKnowledgePackContextForDeveloperTask({
      userId,
      knowledgePackId,
      query,
      taskTitle,
      taskDescription,
      limit: Number.isFinite(limit) ? limit : 5,
      agentRole: "AI_DEVELOPER",
    });
    return NextResponse.json({ ok: true, contextText, diagnostics });
  } catch {
    return NextResponse.json({ ok: false, message: "컨텍스트 생성 실패" }, { status: 500 });
  }
}
