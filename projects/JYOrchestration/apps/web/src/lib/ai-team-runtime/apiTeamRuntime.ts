import { prisma } from "@/lib/prisma";
import {
  buildTeamRuntimeSummaryFromRun,
  type TaskExecutionRunForTeamRuntime,
  type TeamRuntimeSummary,
} from "./serialize";
import {
  loadTeamRuntimeTaskContext,
  type TeamRuntimeTaskContext,
} from "./teamRuntimeTaskContext";
import { buildAiTeamRuntimeTimelineSafe } from "./timeline";

export type { TeamRuntimeTaskContext } from "./teamRuntimeTaskContext";
export { loadTeamRuntimeTaskContext, loadTeamRuntimeTaskContextMap } from "./teamRuntimeTaskContext";

export async function loadRequireApprovalBeforeApply(projectId: string): Promise<boolean> {
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { requireApprovalBeforeApply: true },
  });
  return setup?.requireApprovalBeforeApply === true;
}

export type TeamRuntimeAdditiveFields = Readonly<{
  teamExecutionStatus: string | null | undefined;
  teamRuntimeStatus: TeamRuntimeSummary["status"];
  teamRuntime: TeamRuntimeSummary;
}>;

export function buildTeamRuntimeAdditiveFields(
  run: TaskExecutionRunForTeamRuntime,
  requireApproval: boolean,
  task?: TeamRuntimeTaskContext
): TeamRuntimeAdditiveFields {
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

/** Loads approval policy + task workflow context, then builds `teamRuntime` for a single run. */
export async function buildTeamRuntimeForExecutionRun(
  projectId: string,
  run: TaskExecutionRunForTeamRuntime | null | undefined
): Promise<TeamRuntimeSummary | null> {
  if (!run) return null;

  const [requireApproval, taskContext] = await Promise.all([
    loadRequireApprovalBeforeApply(projectId),
    loadTeamRuntimeTaskContext(projectId, run.taskId),
  ]);

  return buildTeamRuntimeAdditiveFields(run, requireApproval, taskContext).teamRuntime;
}
