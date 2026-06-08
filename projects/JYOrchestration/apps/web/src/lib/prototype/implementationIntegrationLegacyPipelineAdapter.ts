import { runIntegrationBranchPipeline } from "@/lib/prototype/implementationIntegrationPipelineService";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

/** @deprecated legacy_runtime — primary path uses IntegrationStep pipeline; adapter only. */
export async function runLegacyIntegrationBranchPipelineAsFinalWiringAdapter(input: {
  readonly projectId: string;
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
}): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly plan: CodeTaskIntegrationPlanV1;
    readonly timeline: readonly RequirementsPromptTimelineEntry[];
    readonly message: string;
    readonly integrationBranch: string | null;
  }>
> {
  const outcome = await runIntegrationBranchPipeline({
    projectId: input.projectId,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    githubToken: input.githubToken,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    createPullRequest: input.createPullRequest,
    storedIntegrationPlan: input.storedIntegrationPlan,
    nowIso: input.nowIso,
  });
  const integrationBranch =
    String(outcome.plan.integrationBranch ?? "").trim() || null;
  return {
    ok: outcome.ok,
    plan: outcome.plan,
    timeline: outcome.timeline,
    message: outcome.message,
    integrationBranch,
  };
}
