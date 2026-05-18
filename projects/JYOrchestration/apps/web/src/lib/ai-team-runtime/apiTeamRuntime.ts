import { prisma } from "@/lib/prisma";
import {
  buildTeamRuntimeSummaryFromRun,
  type TaskExecutionRunForTeamRuntime,
  type TeamRuntimeSummary,
} from "./serialize";
import { buildAiTeamRuntimeTimelineSafe } from "./timeline";

export async function loadRequireApprovalBeforeApply(projectId: string): Promise<boolean> {
  const setup = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { requireApprovalBeforeApply: true },
  });
  return setup?.requireApprovalBeforeApply === true;
}

export function buildTeamRuntimeAdditiveFields(
  run: TaskExecutionRunForTeamRuntime,
  requireApproval: boolean
): Readonly<{
  teamExecutionStatus: string | null | undefined;
  teamRuntimeStatus: TeamRuntimeSummary["status"];
  teamRuntime: TeamRuntimeSummary;
}> {
  const summary = buildTeamRuntimeSummaryFromRun(run, { requireApproval });
  const timeline = buildAiTeamRuntimeTimelineSafe({ run, requireApproval });
  const teamRuntime: TeamRuntimeSummary = { ...summary, timeline };
  return {
    teamExecutionStatus: run.teamExecutionStatus,
    teamRuntimeStatus: teamRuntime.status,
    teamRuntime,
  };
}
