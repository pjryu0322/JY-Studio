import { prisma } from "@/lib/prisma";
import { getSelfHealingAction } from "@/lib/execution/selfHealingStrategy";

async function resolveProjectSpecUpload(projectId: string): Promise<string | null> {
  const upload = await prisma.projectSpecUpload.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return upload?.id ?? null;
}

async function resolveNextOrder(projectId: string): Promise<number> {
  const maxOrder = await prisma.task.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  return (maxOrder._max.order ?? 0) + 1;
}

export async function triggerSelfHealingLite(params: {
  jobId: string;
  projectId: string;
  failureType?: string | null;
  detailJson?: unknown;
  sourceTaskId?: string | null;
}): Promise<{ created: boolean; taskId?: string; reason?: string }> {
  const failureTypeKey = params.failureType ?? "UNKNOWN";
  const changeReason = `AUTO_HEALING:${failureTypeKey}:${params.jobId}`;

  // 1) 중복 생성 방지: jobId가 포함된 changeReason 기반으로 체크
  const existing = await prisma.task.findFirst({
    where: { projectId: params.projectId, changeReason },
    select: { id: true },
  });
  if (existing) {
    return { created: false, reason: "ALREADY_CREATED" };
  }

  const projectSpecUploadId = await resolveProjectSpecUpload(params.projectId);
  if (!projectSpecUploadId) {
    return { created: false, reason: "NO_PROJECT_SPEC_UPLOAD" };
  }

  const actionInfo = getSelfHealingAction(params.failureType);
  const action = actionInfo.action;
  const reasonMessage = actionInfo.message;
  const detailJsonText = JSON.stringify(params.detailJson ?? null, null, 2);
  const description = [
    "자동 복구 작업이 생성되었습니다.",
    `failureType: ${failureTypeKey}`,
    `action: ${action}`,
    `reason: ${reasonMessage}`,
    "원인 로그:",
    detailJsonText,
  ].join("\n");

  const nextOrder = await resolveNextOrder(params.projectId);
  const created = await prisma.task.create({
    data: {
      projectId: params.projectId,
      projectSpecUploadId,
      name: `[AUTO] Recover from ${failureTypeKey}`,
      description,
      taskKind: "AUTO_HEALING",
      status: "TODO",
      order: nextOrder,
      parentTaskId: params.sourceTaskId ?? null,
      changeReason,
    },
    select: { id: true },
  });

  return { created: true, taskId: created.id };
}

