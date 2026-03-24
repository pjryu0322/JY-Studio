import { prisma } from "@/lib/prisma";
import {
  getSelfHealingStrategies,
  getSelfHealingStrategyMessage,
  type SelfHealingAction,
} from "@/lib/execution/selfHealingStrategy";

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
}): Promise<{
  created: boolean;
  strategies: SelfHealingAction[];
  createdTasks: Array<{ strategy: SelfHealingAction; taskId: string }>;
  reason?: string;
}> {
  const failureTypeKey = params.failureType ?? "UNKNOWN";
  const strategies = getSelfHealingStrategies(params.failureType);

  const projectSpecUploadId = await resolveProjectSpecUpload(params.projectId);
  if (!projectSpecUploadId) {
    return { created: false, strategies, createdTasks: [], reason: "NO_PROJECT_SPEC_UPLOAD" };
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { ownerUserId: true },
  });
  if (!projectRow) {
    return { created: false, strategies, createdTasks: [], reason: "PROJECT_NOT_FOUND" };
  }

  const detailJsonText = JSON.stringify(params.detailJson ?? null, null, 2);

  // 여러 전략이 생성되므로 order를 한 번 계산해 증가시킨다.
  let nextOrder = await resolveNextOrder(params.projectId);

  const createdTasks: Array<{ strategy: SelfHealingAction; taskId: string }> = [];
  for (const strategy of strategies) {
    // 1) 전략까지 포함한 중복 방지(changeReason 기반)
    const changeReason = `AUTO_HEALING:${failureTypeKey}:${strategy}:${params.jobId}`;
    const existing = await prisma.task.findFirst({
      where: { projectId: params.projectId, changeReason },
      select: { id: true },
    });
    if (existing) continue;

    const reasonMessage = getSelfHealingStrategyMessage(strategy);
    const description = [
      "자동 복구 작업이 생성되었습니다.",
      `failureType: ${failureTypeKey}`,
      `action: ${strategy}`,
      `reason: ${reasonMessage}`,
      "원인 로그:",
      detailJsonText,
    ].join("\n");

    const created = await prisma.task.create({
      data: {
        projectId: params.projectId,
        ownerUserId: projectRow.ownerUserId,
        projectSpecUploadId,
        name: `[AUTO][${strategy}] Recover from ${failureTypeKey}`,
        description,
        taskKind: "AUTO_HEALING",
        status: "TODO",
        order: nextOrder,
        parentTaskId: params.sourceTaskId ?? null,
        changeReason,
      },
      select: { id: true },
    });

    createdTasks.push({ strategy, taskId: created.id });
    nextOrder++;
  }

  if (createdTasks.length === 0) {
    return { created: false, strategies, createdTasks: [], reason: "ALREADY_CREATED" };
  }

  // created=true는 "적어도 1개 이상 생성"을 의미한다.
  return { created: true, strategies, createdTasks };
}

