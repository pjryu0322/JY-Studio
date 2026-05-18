import { prisma } from "@/lib/prisma";

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

type TeamRuntimeTaskContextRow = {
  executionWorkflowStatus: string | null;
  lastEvalResult: string | null;
  lastEvalSummary: string | null;
};

function pickTeamRuntimeTaskContext(row: TeamRuntimeTaskContextRow): TeamRuntimeTaskContext {
  return {
    executionWorkflowStatus: row.executionWorkflowStatus,
    lastEvalResult: row.lastEvalResult,
    lastEvalSummary: row.lastEvalSummary,
  };
}

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

  return new Map(rows.map((row) => [row.id, pickTeamRuntimeTaskContext(row)]));
}

export async function loadTeamRuntimeTaskContext(
  projectId: string,
  taskId: string | null | undefined
): Promise<TeamRuntimeTaskContext> {
  const id = String(taskId ?? "").trim();
  if (!id) return null;

  const row = await prisma.task.findFirst({
    where: { id, projectId },
    select: TEAM_RUNTIME_TASK_CONTEXT_SELECT,
  });

  return row ? pickTeamRuntimeTaskContext(row) : null;
}
