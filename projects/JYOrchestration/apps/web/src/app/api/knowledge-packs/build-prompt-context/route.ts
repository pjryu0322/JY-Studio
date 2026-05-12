import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  buildKnowledgePackContextForDeveloperTask,
  buildMergedKnowledgePackPromptContext,
} from "@/lib/knowledge-packs/knowledgePackPromptInjectionAdapter";

export const runtime = "nodejs";

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const query = String(body.query ?? "").trim();
  const taskTitle = String(body.taskTitle ?? "").trim() || undefined;
  const taskDescription = String(body.taskDescription ?? "").trim() || undefined;
  const agentRole = String(body.agentRole ?? "AI_DEVELOPER").trim() || "AI_DEVELOPER";
  const limitRaw = body.limit ?? body.topK;
  const limit = limitRaw != null ? Number(limitRaw) : 5;

  const ids = parseIdList(body.knowledgePackIds);
  if (ids.length) {
    if (!query) {
      return NextResponse.json({ ok: false, message: "query가 필요합니다." }, { status: 400 });
    }
    try {
      const merged = await buildMergedKnowledgePackPromptContext({
        userId,
        knowledgePackIds: ids,
        query,
        taskTitle,
        taskDescription,
        agentRole,
        limitPerPack: Number.isFinite(limit) ? limit : 5,
        maxTotalChars: 7500,
      });
      return NextResponse.json({
        ok: true,
        contextText: merged.contextText,
        diagnostics: merged.diagnostics,
        usedKnowledgePackIds: merged.usedKnowledgePackIds,
      });
    } catch {
      return NextResponse.json({ ok: false, message: "컨텍스트 생성 실패" }, { status: 500 });
    }
  }

  const knowledgePackId = String(body.knowledgePackId ?? "").trim();
  if (!knowledgePackId) {
    return NextResponse.json(
      { ok: false, message: "knowledgePackIds 또는 knowledgePackId가 필요합니다." },
      { status: 400 },
    );
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
      agentRole,
    });
    return NextResponse.json({
      ok: true,
      contextText,
      diagnostics,
      usedKnowledgePackIds: contextText.trim() ? [knowledgePackId] : [],
    });
  } catch {
    return NextResponse.json({ ok: false, message: "컨텍스트 생성 실패" }, { status: 500 });
  }
}
