import { prisma } from "@/lib/prisma";
import {
  buildTeamRuntimeSummaryFromRun,
  type TaskExecutionRunTeamRuntimeSource,
  type TeamRuntimeSummary,
} from "./serialize";

export async function loadRequireApprovalBeforeApply(projectId: string): Promise<boolean> {
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { requireApprovalBeforeApply: true },
  });
  return setup?.requireApprovalBeforeApply === true;
}

export function buildTeamRuntimeAdditiveFields(
  run: TaskExecutionRunTeamRuntimeSource & { teamExecutionStatus?: string | null },
  requireApproval: boolean
): Readonly<{
  teamExecutionStatus: string | null | undefined;
  teamRuntimeStatus: TeamRuntimeSummary["status"];
  teamRuntime: TeamRuntimeSummary;
}> {
  const teamRuntime = buildTeamRuntimeSummaryFromRun(run, { requireApproval });
  return {
    teamExecutionStatus: run.teamExecutionStatus,
    teamRuntimeStatus: teamRuntime.status,
    teamRuntime,
  };
}
