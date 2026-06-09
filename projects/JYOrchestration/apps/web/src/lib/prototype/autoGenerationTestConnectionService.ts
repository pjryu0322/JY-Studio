import type { ExecutionSetupDto } from "@/components/project-spec/api";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import { parseGitHubRepoFullName } from "@/lib/executionSetup/hardening";
import { getLatestEnvironmentTestTask } from "@/lib/service/environmentConnectionTestService";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import {
  buildAutoGenerationSettingsConnectionTestResult,
  type AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import type { EnvcheckConnectionTestSourceV1 } from "@/lib/prototype/envcheckConnectionTestService";

function normalizeWorkflow(w: string | null | undefined): string {
  return String(w ?? "").trim().toLowerCase();
}

function mapEnvTestLastToSource(last: Awaited<ReturnType<typeof getLatestEnvironmentTestTask>>): EnvcheckConnectionTestSourceV1 | null {
  if (!last) return null;
  const wf = normalizeWorkflow(last.workflowStatus);
  const mergeMode = last.connectionTestMergeMode === "skip" ? "skip" : "auto";
  const terminalOk =
    wf === EXECUTION_WORKFLOW.MERGED ||
    (wf === EXECUTION_WORKFLOW.PR_OPENED && mergeMode === "skip");
  return {
    workflowStatus: last.workflowStatus,
    envTestStage1FailureLine: last.envTestStage1FailureLine ?? null,
    connectionTestMergeMode: mergeMode,
    branchName: last.branchName ?? null,
    lastEvalSummary: null,
    terminalOk,
  };
}

export async function runAutoGenerationTestConnectionForProject(input: {
  readonly projectId: string;
  readonly viewerUserId: string;
  readonly executionSetup: ExecutionSetupDto & {
    readonly githubAccessToken?: string | null;
    readonly gitRepoUrl?: string | null;
    readonly baseBranch?: string | null;
    readonly cursorApiToken?: string | null;
    readonly repoConnectionOk?: boolean | null;
    readonly githubAuthConnectionOk?: boolean | null;
    readonly cursorApiConnectionOk?: boolean | null;
  };
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
}): Promise<AutoGenerationSettingsConnectionTestResultV1> {
  const checkedAt = new Date().toISOString();
  const parsed = parseGitHubRepoFullName(String(input.executionSetup.gitRepoUrl ?? "").trim());
  const token = String(input.executionSetup.githubAccessToken ?? "").trim();

  if (!parsed || !token) {
    return normalizeAutoGenerationConnectionTestResult({
      executionSetupForBasic: input.executionSetup as ExecutionSetupDto,
      checkedAt,
    });
  }

  try {
    const last = await getLatestEnvironmentTestTask(input.projectId, {
      viewerUserId: input.viewerUserId,
    });
    const envSource = mapEnvTestLastToSource(last);
    const basicFails =
      input.executionSetup.repoConnectionOk !== true ||
      input.executionSetup.githubAuthConnectionOk !== true;

    return await buildAutoGenerationSettingsConnectionTestResult({
      executionSetup: input.executionSetup as ExecutionSetupDto,
      envcheckSource: envSource,
      ownerRepo: parsed,
      defaultBranch: String(input.executionSetup.baseBranch ?? "main").trim() || "main",
      githubToken: token,
      capabilitySnapshot: input.capabilitySnapshot ?? null,
      cursorApiConfigured: Boolean(String(input.executionSetup.cursorApiToken ?? "").trim()),
      envcheckBlocked: basicFails,
    });
  } catch (thrownError) {
    console.info(
      JSON.stringify({
        action: "auto_generation_connection_test_normalized_after_error",
        projectId: input.projectId,
      }),
    );
    return normalizeAutoGenerationConnectionTestResult({
      thrownError,
      executionSetupForBasic: input.executionSetup as ExecutionSetupDto,
      checkedAt,
      preflightException: true,
      envcheckException: true,
    });
  }
}
