import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { prisma } from "@/lib/prisma";
import { withTaskExecutionRunSchemaHealRetry } from "@/lib/prisma/taskExecutionRunColumnsHeal";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { AI_TEAM_EXECUTION_STATUS_LABEL_KO, type AiTeamExecutionStatus } from "./status";
import { assertTeamExecutionTransition } from "./transition";
import { resolveTeamExecutionStatusFromRun, type TaskExecutionRunTeamRuntimeSource } from "./serialize";

export async function readTeamExecutionStatus(execRunId: string): Promise<AiTeamExecutionStatus | null> {
  const row = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { teamExecutionStatus: true, status: true },
  });
  if (!row) return null;
  return resolveTeamExecutionStatusFromRun(row as TaskExecutionRunTeamRuntimeSource);
}

export async function patchTeamExecutionStatus(input: Readonly<{
  execRunId: string;
  projectId: string;
  taskId: string;
  actorUserId: string;
  to: AiTeamExecutionStatus;
  historySummaryKo?: string;
  historyDetail?: Record<string, unknown>;
}>): Promise<void> {
  const current = await readTeamExecutionStatus(input.execRunId);
  assertTeamExecutionTransition(current, input.to);

  await withTaskExecutionRunSchemaHealRetry(() =>
    prisma.taskExecutionRun.update({
      where: { id: input.execRunId },
      data: { teamExecutionStatus: input.to },
    })
  );

  const summary =
    input.historySummaryKo ?? `AI Team Runtime: ${AI_TEAM_EXECUTION_STATUS_LABEL_KO[input.to]}`;
  await appendTaskHistory({
    projectId: input.projectId,
    taskId: input.taskId,
    actorType: TaskHistoryActorType.SYSTEM,
    actorId: input.actorUserId,
    eventType: TaskHistoryEventType.EXECUTION_LOOP_TASK_STEP,
    summary,
    detailJson: {
      teamExecutionStatus: input.to,
      previousTeamExecutionStatus: current,
      ...input.historyDetail,
    },
  });
}
