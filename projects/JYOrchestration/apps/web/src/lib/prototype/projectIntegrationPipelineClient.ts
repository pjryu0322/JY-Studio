import {
  runIntegrationBranchPipelineClient,
  type RunIntegrationBranchPipelineClientResult,
} from "@/lib/prototype/implementationIntegrationClient";

export type ProjectIntegrationPipelineClientResult = RunIntegrationBranchPipelineClientResult;

/** Integration prepare button only — no completed CodeTask preview build or legacy timeline. */
export async function runProjectIntegrationPrepareOnly(input: {
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly createPullRequest?: boolean;
  readonly boardSelectionSummary?: import("@/lib/prototype/implementationCodeTaskBoardState").ImplementationCodeTaskSelectionSummaryV1 | null;
}): Promise<ProjectIntegrationPipelineClientResult> {
  return runIntegrationBranchPipelineClient(input);
}
