import type { ImplementationLlmProviderConfigV1 } from "@/lib/prototype/implementationLlmProviderConfigWire";
import {
  fetchExecutionSetup,
  patchExecutionSetup as patchExecutionSetupApi,
  type ExecutionSetupDto,
} from "@/components/project-spec/apis/executionSetupApi";

export type { ExecutionSetupDto };

/** PATCH body for `/api/projects/:projectId/execution-setup` (client). */
export type ExecutionSetupPatchBody = Partial<{
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string | null;
  baseBranch: string;
  branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
  branchPrefix: string | null;
  cursorApiUrl: string;
  cursorApiToken: string | null;
  githubAccessToken: string | null;
  openaiPlannerApiKey: string | null;
  enableLlmCodeTaskRefinement: boolean;
  implementationLlmProviderConfig: ImplementationLlmProviderConfigV1 | null;
  workspacePath: string;
  allowedPathGlobs: string[];
  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireApprovalBeforeApply: boolean;
  requireTestsBeforePush: boolean;
  dryRunAllowed: boolean;
  autoAdvanceToNextTask: boolean;
  maxAutoRetriesPerTask: number;
  stopOnTestFailure: boolean;
  stopOnRepeatedFailure: boolean;
  stopOnOutOfScopeChange: boolean;
  requireApprovalForSensitiveTasks: boolean;
}>;

export async function patchExecutionSetup(projectId: string, body: ExecutionSetupPatchBody) {
  return patchExecutionSetupApi(projectId, body);
}

export { fetchExecutionSetup };
