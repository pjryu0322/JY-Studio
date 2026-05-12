import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { parseLines } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { getMergedKnowledgePackById, patchKnowledgePack } from "@/lib/knowledge-packs/knowledgePackDbService";
import { parsePrecheckSummaryForHistory } from "@/lib/knowledge-packs/knowledgePackPrecheckHttpBody";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();
  try {
    const pack = await getMergedKnowledgePackById(packId, userId);
    if (!pack) return NextResponse.json({ ok: false, message: "찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, pack });
  } catch {
    return NextResponse.json({ ok: false, message: "조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;
  const { id } = await ctx.params;
  const packId = decodeURIComponent(id).trim();

  if (isStaticKnowledgePackId(packId)) {
    return NextResponse.json(
      { ok: false, message: "플랫폼 기본 지식팩은 직접 수정할 수 없습니다. 복제 기능은 다음 단계에서 제공됩니다." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "이름이 필요합니다." }, { status: 400 });
  const summary = String(body.summary ?? "").trim();
  const description = String(body.description ?? "");
  const vendor = String(body.vendor ?? "");
  const licenseType = String(body.licenseType ?? "UNKNOWN").trim();
  const status = String(body.status ?? "DRAFT").trim();
  const changeSummary = String(body.changeSummary ?? "").trim();
  const licenseNotes = parseLines(String(body.licenseNotes ?? ""));
  const agentsRaw = body.agents;
  const agents = Array.isArray(agentsRaw) ? agentsRaw.map((a) => String(a)) : ["AI_DEVELOPER"];
  const sections = (body.sections ?? {}) as Record<string, string>;

  try {
    const pack = await patchKnowledgePack(packId, userId, {
      name,
      summary,
      description,
      vendor,
      licenseType,
      status,
      changeSummary,
      licenseNotes,
      agents,
      precheckHistoryLine: parsePrecheckSummaryForHistory(body),
      sections: {
        recommendedUseCases: sections.recommendedUseCases,
        notRecommendedUseCases: sections.notRecommendedUseCases,
        capabilities: sections.capabilities,
        constraints: sections.constraints,
        implementationGuidelines: sections.implementationGuidelines,
        cursorPromptRules: sections.cursorPromptRules,
        forbiddenPatterns: sections.forbiddenPatterns,
        reviewChecklist: sections.reviewChecklist,
        securityChecklist: sections.securityChecklist,
        alternatives: sections.alternatives,
        references: sections.references,
        previewSpec: sections.previewSpec,
      },
    });
    return NextResponse.json({ ok: true, pack });
  } catch (e) {
    const msg = e instanceof Error && e.message === "NOT_FOUND" ? "찾을 수 없습니다." : e instanceof Error ? e.message : "저장 실패";
    const code = e instanceof Error && e.message === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status: code });
  }
}
