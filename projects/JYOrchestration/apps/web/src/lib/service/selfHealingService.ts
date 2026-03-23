import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSelfHealingAction } from "@/lib/execution/selfHealingStrategy";
import { logExecutionEvent } from "@/lib/service/executionEventService";

export const AUTO_HEALING_ENABLED = false;
export const AUTO_HEALING_MAX_DEPTH = 2;

async function getProjectSpecUploadIdAndNextOrder(projectId: string): Promise<{
  projectSpecUploadId: string;
  nextOrder: number;
}> {
  const [anyTask, maxOrderRow] = await Promise.all([
    prisma.task.findFirst({
      where: { projectId },
      select: { projectSpecUploadId: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findFirst({
      where: { projectId },
      select: { order: true },
      orderBy: { order: "desc" },
    }),
  ]);

  if (!anyTask) {
    // 프로젝트 내부에 Task가 없으면 AUTO_HEALING Task를 생성할 수 없다.
    // (이 경우, 상위 작업/정합성 문제이므로 실패 조용히 반환한다.)
    throw new Error(`No task exists for projectId=${projectId} (cannot create auto-healing task).`);
  }

  const nextOrder = (maxOrderRow?.order ?? 0) + 1;
  return { projectSpecUploadId: anyTask.projectSpecUploadId, nextOrder };
}

export async function triggerSelfHealing(params: {
  job: { id: string; projectId: string; healingDepth?: number | null };
  failureType: string;
  detailJson?: unknown;
}): Promise<void> {
  const currentDepth = params.job.healingDepth ?? 0;
  if (currentDepth >= AUTO_HEALING_MAX_DEPTH) return;

  const action = getSelfHealingAction(params.failureType);

  // 1) EventLog 기록
  await logExecutionEvent({
    projectId: params.job.projectId,
    executionJobId: params.job.id,
    stage: "SELF_HEALING",
    status: "STARTED",
    detailJson: {
      failureType: params.failureType,
      action: action.action,
      depth: currentDepth,
    } as Prisma.InputJsonValue,
  });

  // 2) Infinite loop 방지 depth bump
  await prisma.executionJob.update({
    where: { id: params.job.id },
    data: { healingDepth: currentDepth + 1 },
  });

  // 3) AUTO_HEALING Task 생성 (스키마 필수값(projectSpecUploadId, order) 포함)
  //    - 가능하면 실행의 원인이 된 GitChangeRequest Task를 기반으로 생성.
  const executionJob = await prisma.executionJob.findUnique({
    where: { id: params.job.id },
    select: { payload: true },
  });

  const payload = (executionJob?.payload ?? {}) as unknown as Record<string, unknown>;
  const gitChangeRequestId =
    typeof payload?.gitChangeRequestId === "string" && payload.gitChangeRequestId.trim()
      ? payload.gitChangeRequestId.trim()
      : null;

  let projectSpecUploadId: string | null = null;
  if (gitChangeRequestId) {
    const gcr = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { task: { select: { projectSpecUploadId: true } } },
    });
    projectSpecUploadId = gcr?.task?.projectSpecUploadId ?? null;
  }

  // projectSpecUploadId가 GitChangeRequest에서 파생되지 않으면,
  // 프로젝트 내 기존 Task로부터 안정적으로 파생한다.

  const orderDerived = await getProjectSpecUploadIdAndNextOrder(params.job.projectId);
  if (!projectSpecUploadId) projectSpecUploadId = orderDerived.projectSpecUploadId;
  const { nextOrder } = orderDerived;

  await prisma.task.create({
    data: {
      projectId: params.job.projectId,
      projectSpecUploadId,
      name: `[AUTO] Recover from ${params.failureType}`,
      description: JSON.stringify(params.detailJson ?? null),
      taskKind: "AUTO_HEALING",
      status: "TODO",
      order: nextOrder,
    },
  });

  // 4) (Optional) Auto re-execution is intentionally disabled for safety.
  if (AUTO_HEALING_ENABLED) {
    // Future extension: enqueueExecution(...) using existing job.payload.
  }
}

