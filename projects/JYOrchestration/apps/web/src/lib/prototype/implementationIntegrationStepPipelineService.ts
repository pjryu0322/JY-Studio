import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { buildImplementationIntegrationPipelineContext } from "@/lib/prototype/implementationIntegrationPipelineContextBuilder";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { resolveIntegrationStepsForRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import {
  runProjectIntegrationPipeline,
  type ProjectIntegrationPipelineResultV1,
} from "@/lib/prototype/projectIntegrationPipelineService";
import type { ProjectIntegrationPipelineTriggerV1 } from "@/lib/prototype/integrationPipelineContext";

export type RunImplementationIntegrationStepPipelineResultV1 = Omit<
  ProjectIntegrationPipelineResultV1,
  "status" | "eligibilityReasonCode"
> &
  Readonly<{
    readonly status: Exclude<
      ProjectIntegrationPipelineResultV1["status"],
      "pipeline_blocked"
    >;
  }>;

function mapLegacyTrigger(
  trigger: "manual_integration_button" | "auto_after_codetasks_verified",
): ProjectIntegrationPipelineTriggerV1 {
  return trigger === "auto_after_codetasks_verified"
    ? "auto_after_codetasks_verified"
    : "manual_integration_button";
}

/**
 * Implementation-stage compatibility wrapper. Prefer runProjectIntegrationPipeline().
 */
export async function runImplementationIntegrationStepPipeline(input: {
  readonly projectId: string;
  readonly trigger: "manual_integration_button" | "auto_after_codetasks_verified";
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly githubToken: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly storedIntegrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly createPullRequest?: boolean;
  readonly nowIso?: string;
}): Promise<RunImplementationIntegrationStepPipelineResultV1> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();

  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};

  const summary = buildImplementationExecutionSummaryCounts({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.codeTaskRuns,
  });

  const integrationSteps = resolveIntegrationStepsForRuntimeSnapshot({
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
  });

  const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(
    summary.runtimeSnapshot,
  );

  const context = buildImplementationIntegrationPipelineContext({
    projectId: pid,
    trigger: mapLegacyTrigger(input.trigger),
    baseBranch: input.baseBranch,
    snapshot: summary.runtimeSnapshot,
    codeTaskPlan: input.codeTaskPlan,
    integrationSteps,
    createPullRequest: input.createPullRequest,
    nowIso,
  });

  const outcome = await runProjectIntegrationPipeline({
    context,
    eligibility,
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    storedIntegrationPlan: input.storedIntegrationPlan,
    integrationSteps,
    requirementsState: state,
  });

  const { eligibilityReasonCode: _ignored, ...rest } = outcome;
  return rest as RunImplementationIntegrationStepPipelineResultV1;
}
