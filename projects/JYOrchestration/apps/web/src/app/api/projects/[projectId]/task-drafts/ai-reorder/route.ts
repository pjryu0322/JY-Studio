import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { reorderTaskDraftWorkflowWithOpenAI } from "@/lib/project-spec/reorderTaskDraftWorkflowWithOpenAI";

function jsonArrayFromDb(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

function hasCycle(nodes: string[], depsById: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const dfs = (id: string): boolean => {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    for (const dep of depsById.get(id) ?? []) {
      if (dfs(dep)) return true;
    }
    inStack.delete(id);
    return false;
  };
  return nodes.some((id) => dfs(id));
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canGenerateTask",
        "POST /api/projects/[projectId]/task-drafts/ai-reorder"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    let body: { model?: string | null };
    try {
      body = (await request.json()) as { model?: string | null };
    } catch {
      body = {};
    }

    const project = await prisma.project.findUnique({
      where: { id: pid },
      select: { name: true, currentSpecVersionId: true },
    });
    if (!project) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const drafts = await prisma.taskDraft.findMany({
      where: { projectId: pid, status: "DRAFT" },
      orderBy: [{ createdAt: "asc" }],
      take: 400,
      include: { specVersion: { select: { version: true } } },
    });
    if (drafts.length === 0) {
      return NextResponse.json({ success: false, message: "DRAFT 초안이 없습니다." }, { status: 400 });
    }

    const specVersionNumber = drafts[0]?.specVersion?.version ?? null;
    const payloadTasks = drafts.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      priority: d.priority,
      acceptanceCriteria: jsonArrayFromDb(d.acceptanceCriteria),
      dependsOnIds: jsonArrayFromDb((d as unknown as { dependsOnIds?: unknown }).dependsOnIds),
    }));

    const ai = await reorderTaskDraftWorkflowWithOpenAI({
      projectName: project.name,
      specVersionNumber,
      tasks: payloadTasks,
      modelFromRequest: body.model ?? null,
    });

    const allowedIds = new Set(drafts.map((d) => d.id));
    const nextDepsById = new Map<string, string[]>();
    for (const s of ai.suggestion) {
      if (!allowedIds.has(s.id)) continue;
      const deps = (s.dependsOnIds ?? []).filter((x) => allowedIds.has(x) && x !== s.id).slice(0, 50);
      nextDepsById.set(s.id, deps);
    }

    const nodes = drafts.map((d) => d.id);
    const cycle = hasCycle(nodes, nextDepsById);

    return NextResponse.json({
      success: true,
      message: cycle
        ? "AI가 순환 의존성을 제안하여, 의존성 변경 없이 레이아웃만 적용 후보로 반환합니다."
        : "AI 워크플로우 재정렬 추천을 생성했습니다.",
      data: {
        model: ai.model,
        usage: ai.usage,
        cycleDetected: cycle,
        tasks: ai.suggestion
          .filter((t) => allowedIds.has(t.id))
          .map((t) => ({
            id: t.id,
            dependsOnIds: cycle ? undefined : nextDepsById.get(t.id) ?? [],
            positionX: t.positionX,
            positionY: t.positionY,
          })),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/task-drafts/ai-reorder error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "OPENAI_API_KEY_NOT_CONFIGURED") {
      return NextResponse.json(
        { success: false, message: "OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY를 구성하세요." },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, message: "AI 재정렬 중 오류가 발생했습니다." }, { status: 500 });
  }
}

