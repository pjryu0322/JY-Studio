import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { withNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";
import { appendReviewMessage, getImprovementItems, getReviewThread, setImprovementItems } from "@/lib/prototype/prototypeReviewStore";
import { generateImprovementItemsForRun } from "@/lib/prototype/prototypeReviewImprovementsGenerator";

/** 보완작업 생성: 저장된 개선안을 Task 초안으로 추가 */
export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { projectId?: string; runId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const runId = String(body.runId ?? "").trim();
  if (!projectId || !runId) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermissionById(projectId, userId, "canGenerateTask", "POST /api/prototype-review/follow-up-drafts");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  let items = getImprovementItems(projectId, runId);
  if (!items?.length) {
    /** 채팅 후 개선안이 비워진 경우 등 — 대화·실행 맥락으로 목록을 한 번 채운 뒤 초안 생성 */
    const gen = await generateImprovementItemsForRun(projectId, runId);
    if (!gen.ok) {
      return NextResponse.json({ success: false, message: gen.message }, { status: 400 });
    }
    setImprovementItems(projectId, runId, gen.items);
    items = gen.items;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { currentSpecVersionId: true },
  });
  const specVersionId = project?.currentSpecVersionId?.trim() ?? "";
  if (!specVersionId) {
    return NextResponse.json(
      { success: false, message: "확정된 스펙 버전이 없습니다. 생성 준비에서 스펙을 저장한 뒤 다시 시도해 주세요." },
      { status: 400 },
    );
  }

  const createdIds: string[] = [];
  let y = 0;
  for (const it of items) {
    const title = withNodeTypePrefix("task", `${it.title}`.slice(0, 500));
    const description = `${it.detail}\n\n(출처: 프로토타입 검토 · 실행 ${runId.slice(0, 8)}…)`.slice(0, 8000);
    const row = await prisma.taskDraft.create({
      data: {
        projectId,
        specVersionId,
        title,
        description,
        priority: "MEDIUM",
        acceptanceCriteria: [],
        dependsOn: [],
        dependsOnIds: [],
        positionX: 0,
        positionY: y,
        stage: "Build",
        createdByType: "USER",
        status: "DRAFT",
        createdByUserId: userId,
      },
    });
    createdIds.push(row.id);
    y += 80;
  }

  appendReviewMessage(
    projectId,
    runId,
    "planner",
    `보완 작업 초안 ${createdIds.length}건을 추가했습니다. 「작업 정리」단계에서 확인·확정할 수 있습니다.`,
  );

  return NextResponse.json({
    success: true,
    data: {
      draftIds: createdIds,
      messages: getReviewThread(projectId, runId),
      improvementItems: getImprovementItems(projectId, runId),
    },
  });
}
