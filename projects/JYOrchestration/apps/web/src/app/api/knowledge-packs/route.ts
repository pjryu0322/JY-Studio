import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { filterMergedKnowledgePacks, mergeStaticAndDbKnowledgePacks, parseLines } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { createKnowledgePack, mergeKnowledgePackListForUser } from "@/lib/knowledge-packs/knowledgePackDbService";
import { DEVELOPER_SEED_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerKnowledgePacks";
import type { KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";
import { prisma } from "@/lib/prisma";

function parseScopeForCreate(scope: string, globalRole: string): { ok: true; scope: string } | { ok: false; message: string } {
  const s = scope.trim().toUpperCase();
  if (s === "ORGANIZATION") {
    return { ok: false, message: "ORGANIZATION 범위는 아직 지원하지 않습니다." };
  }
  if (s === "PLATFORM") {
    if (globalRole === "ADMIN" || globalRole === "SUPER_ADMIN") {
      return { ok: true, scope: s };
    }
    return { ok: false, message: "PLATFORM 범위는 플랫폼 관리자만 등록할 수 있습니다." };
  }
  if (s === "USER" || s === "PROJECT") return { ok: true, scope: s };
  return { ok: false, message: "유효하지 않은 scope 입니다." };
}

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const agent = (searchParams.get("agent") ?? "ALL") as KnowledgePackAgent | "ALL";
  const category = (searchParams.get("category") ?? "ALL") as KnowledgePackCategory | "ALL";

  try {
    const merged = await mergeKnowledgePackListForUser(userId);
    const filtered = filterMergedKnowledgePacks(merged, { agent, category });
    return NextResponse.json({ ok: true, packs: filtered });
  } catch {
    const merged = mergeStaticAndDbKnowledgePacks(DEVELOPER_SEED_KNOWLEDGE_PACKS, []);
    const filtered = filterMergedKnowledgePacks(merged, { agent, category });
    return NextResponse.json({ ok: true, packs: filtered, degraded: true });
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
  const globalRole = user?.globalRole ?? "USER";

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const scopeRaw = String(body.scope ?? "USER");
  const scopeCheck = parseScopeForCreate(scopeRaw, globalRole);
  if (!scopeCheck.ok) {
    return NextResponse.json({ ok: false, message: scopeCheck.message }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "이름이 필요합니다." }, { status: 400 });

  const category = String(body.category ?? "GRID").trim();
  const summary = String(body.summary ?? "").trim();
  const description = String(body.description ?? "");
  const vendor = String(body.vendor ?? "");
  const licenseType = String(body.licenseType ?? "UNKNOWN").trim();
  const status = String(body.status ?? "DRAFT").trim();
  const licenseNotesText = String(body.licenseNotes ?? "");
  const licenseNotes = parseLines(licenseNotesText);
  const agentsRaw = body.agents;
  const agents = Array.isArray(agentsRaw) ? agentsRaw.map((a) => String(a)) : ["AI_DEVELOPER"];

  const sections = (body.sections ?? {}) as Record<string, string>;

  try {
    const pack = await createKnowledgePack(userId, {
      scope: scopeCheck.scope,
      category,
      name,
      summary,
      description,
      vendor,
      licenseType,
      status,
      licenseNotes,
      agents,
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
    const msg = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
