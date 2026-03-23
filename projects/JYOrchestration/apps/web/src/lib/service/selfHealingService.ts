import { prisma } from "@/lib/prisma";
import { getSelfHealingAction } from "@/lib/execution/selfHealingStrategy";

async function resolveLatestProjectSpecUploadAndNextOrder(projectId: string): Promise<{
  projectSpecUploadId: string;
  nextOrder: number;
} | null> {
  const latest = await prisma.task.findFirst({
    where: { projectId },
    select: { projectSpecUploadId: true, order: true },
    orderBy: { order: "desc" },
  });

  if (!latest) return null;
  return { projectSpecUploadId: latest.projectSpecUploadId, nextOrder: latest.order + 1 };
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

  const spec = await resolveLatestProjectSpecUploadAndNextOrder(params.projectId);
  if (!spec) {
    return { created: false, reason: "NO_PROJECT_SPEC_UPLOAD" };
  }

  const actionInfo = getSelfHealingAction(params.failureType);
  const action = actionInfo.action;

  const description = [
    "자동 복구 작업이 생성되었습니다.",
    `action: ${action}`,
    `reason: ${actionInfo.message}`,
  ].join("\n");

  const created = await prisma.task.create({
    data: {
      projectId: params.projectId,
      projectSpecUploadId: spec.projectSpecUploadId,
      name: `[AUTO] Recover from ${failureTypeKey}`,
      description,
      taskKind: "AUTO_HEALING",
      status: "TODO",
      order: spec.nextOrder,
      parentTaskId: params.sourceTaskId ?? null,
      changeReason,
    },
    select: { id: true },
  });

  return { created: true, taskId: created.id };
}

