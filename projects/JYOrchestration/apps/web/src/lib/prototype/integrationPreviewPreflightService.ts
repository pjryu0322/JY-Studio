import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import type { AutoGenerationCheckResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { runPreviewDeploymentPreflight } from "@/lib/prototype/previewDeploymentPreflightService";

export type IntegrationPreviewPreflightFailureKindV1 =
  | "github_preview_permission_required"
  | "github_pages_setup_required";

export type IntegrationPreviewPreflightOutcomeV1 =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly kind: IntegrationPreviewPreflightFailureKindV1;
      readonly userSafeMessage: string;
      readonly remediationCode: string;
      readonly checks: readonly AutoGenerationCheckResultV1[];
    }>;

const PERMISSION_KEYS = new Set([
  "workflow_file_write",
  "actions_workflow_dispatch",
  "gh_pages_branch_write",
]);

const PERMISSION_USER_MESSAGE =
  "GitHub Actions 실행 권한이 필요합니다.\nGitHub Token 권한에서 Actions와 Workflows를 Read/Write로 설정한 뒤 다시 통합 및 Preview 준비를 실행해 주세요.";

const PAGES_USER_MESSAGE =
  "GitHub Pages 설정이 필요합니다.\n저장소 Settings → Pages에서 gh-pages branch를 활성화한 뒤 다시 실행해 주세요.";

function isFailedOrBlocked(c: AutoGenerationCheckResultV1): boolean {
  return c.status === "failed" || (c.required && c.status === "unknown");
}

function classifyPreviewPreflightFailure(
  checks: readonly AutoGenerationCheckResultV1[],
): IntegrationPreviewPreflightOutcomeV1 {
  const permissionFailed = checks.filter((c) => PERMISSION_KEYS.has(c.key) && isFailedOrBlocked(c));
  if (permissionFailed.length > 0) {
    const remediationCode =
      permissionFailed.find((c) => c.remediationCode !== "none")?.remediationCode ??
      "enable_actions_permission";
    return {
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: PERMISSION_USER_MESSAGE,
      remediationCode,
      checks,
    };
  }

  const pagesRows = checks.filter(
    (c) =>
      (c.key === "pages_status_read" || c.key === "pages_configuration") &&
      (c.status === "failed" || c.status === "warning" || (c.required && c.status === "unknown")),
  );
  if (pagesRows.length > 0) {
    return {
      ok: false,
      kind: "github_pages_setup_required",
      userSafeMessage: PAGES_USER_MESSAGE,
      remediationCode: "enable_pages",
      checks,
    };
  }

  const anyRequiredFailed = checks.some((c) => c.required && isFailedOrBlocked(c));
  if (anyRequiredFailed) {
    return {
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: PERMISSION_USER_MESSAGE,
      remediationCode: "enable_actions_permission",
      checks,
    };
  }

  return { ok: true };
}

export async function runIntegrationPreviewPreflight(input: {
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly projectId?: string;
  readonly integrationBranch?: string | null;
}): Promise<IntegrationPreviewPreflightOutcomeV1> {
  console.info(
    JSON.stringify({
      action: "integration_preview_preflight_started",
      projectId: input.projectId ?? null,
      repositoryFullName: input.ownerRepo,
      integrationBranch: input.integrationBranch ?? null,
    }),
  );

  let checks: readonly AutoGenerationCheckResultV1[];
  try {
    checks = await runPreviewDeploymentPreflight({
      ownerRepo: input.ownerRepo,
      defaultBranch: input.defaultBranch,
      githubToken: input.githubToken,
      capabilitySnapshot: input.capabilitySnapshot ?? null,
    });
  } catch (thrownError) {
    const operatorMessage =
      thrownError instanceof Error ? thrownError.message.slice(0, 200) : "preflight_error";
    console.info(
      JSON.stringify({
        action: "integration_preview_preflight_permission_required",
        projectId: input.projectId ?? null,
        repositoryFullName: input.ownerRepo,
        remediationCode: "enable_actions_permission",
        operatorMessage,
      }),
    );
    return {
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: PERMISSION_USER_MESSAGE,
      remediationCode: "enable_actions_permission",
      checks: [],
    };
  }

  const outcome = classifyPreviewPreflightFailure(checks);
  if (outcome.ok) {
    console.info(
      JSON.stringify({
        action: "integration_preview_preflight_completed",
        projectId: input.projectId ?? null,
        repositoryFullName: input.ownerRepo,
      }),
    );
    return outcome;
  }

  console.info(
    JSON.stringify({
      action:
        outcome.kind === "github_pages_setup_required"
          ? "integration_preview_preflight_pages_setup_required"
          : "integration_preview_preflight_permission_required",
      projectId: input.projectId ?? null,
      repositoryFullName: input.ownerRepo,
      remediationCode: outcome.remediationCode,
      requiredPermission: outcome.kind,
    }),
  );
  return outcome;
}
