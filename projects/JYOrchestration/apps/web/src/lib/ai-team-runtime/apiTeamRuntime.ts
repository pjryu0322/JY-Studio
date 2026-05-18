import { prisma } from "@/lib/prisma";
import {
  buildTeamRuntimeSummaryFromRun,
  type TaskExecutionRunForTeamRuntime,
  type TeamRuntimeSummary,
} from "./serialize";
import { buildAiTeamRuntimeTimelineSafe } from "./timeline";

export type TeamRuntimeTaskContext = Readonly<{
  executionWorkflowStatus?: string | null;
  lastEvalResult?: string | null;
  lastEvalSummary?: string | null;
}> | null;

const TEAM_RUNTIME_TASK_CONTEXT_SELECT = {
  executionWorkflowStatus: true,
  lastEvalResult: true,
  lastEvalSummary: true,
} as const;

export async function loadTeamRuntimeTaskContextMap(
  projectId: string,
  taskIds: readonly string[]
): Promise<Map<string, TeamRuntimeTaskContext>> {
  const ids = [...new Set(taskIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.task.findMany({
    where: { projectId, id: { in: ids } },
    select: { id: true, ...TEAM_RUNTIME_TASK_CONTEXT_SELECT },
  });

  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadTeamRuntimeTaskContext(
  projectId: string,
  taskId: string | null | undefined
): Promise<TeamRuntimeTaskContext> {
  const id = String(taskId ?? "").trim();
  if (!id) return null;

  return prisma.task.findFirst({
    where: { id, projectId },
    select: TEAM_RUNTIME_TASK_CONTEXT_SELECT,
  });
}

export async function loadRequireApprovalBeforeApply(projectId: string): Promise<boolean> {
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { requireApprovalBeforeApply: true },
  });
  return setup?.requireApprovalBeforeApply === true;
}

export function buildTeamRuntimeAdditiveFields(
  run: TaskExecutionRunForTeamRuntime,
  requireApproval: boolean,
  task?: TeamRuntimeTaskContext
): Readonly<{
  teamExecutionStatus: string | null | undefined;
  teamRuntimeStatus: TeamRuntimeSummary["status"];
  teamRuntime: TeamRuntimeSummary;
}> {
  const summary = buildTeamRuntimeSummaryFromRun(run, { requireApproval });
  const timeline = buildAiTeamRuntimeTimelineSafe({
    run,
    task: task ?? null,
    requireApproval,
  });
  const teamRuntime: TeamRuntimeSummary = { ...summary, timeline };
  return {
    teamExecutionStatus: run.teamExecutionStatus,
    teamRuntimeStatus: teamRuntime.status,
    teamRuntime,
  };
}
