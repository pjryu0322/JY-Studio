import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import type { AutoGenerationCheckResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { mergeLiveIntegrationPreviewPreflightIntoCapabilityJson } from "@/lib/prototype/integrationPreviewPreflightCapability";
import {
  isPreviewDeploymentPreflightSnapshotStale,
  readPreviewDeploymentPreflightCheckedAtFromCapability,
  resolvePreviewDeploymentPreflightStaleReason,
} from "@/lib/prototype/integrationPreviewPreflightState";
import { derivePreviewDeploymentReadyFromPreflight } from "@/lib/prototype/githubProviderPreflightService";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";
import { runPreviewDeploymentPreflightWithGithubResult } from "@/lib/prototype/previewDeploymentPreflightService";

export type IntegrationPreviewPreflightFailureKindV1 =
  | "github_preview_permission_required"
  | "github_pages_setup_required";

export type IntegrationPreviewPreflightOutcomeV1 =
  | Readonly<{
      readonly ok: true;
      readonly checkedAt: string;
      readonly capabilityPatch?: Record<string, unknown>;
    }>
  | Readonly<{
      readonly ok: false;
      readonly kind: IntegrationPreviewPreflightFailureKindV1;
      readonly userSafeMessage: string;
      readonly remediationCode: string;
      readonly checks: readonly AutoGenerationCheckResultV1[];
      readonly checkedAt: string;
      readonly capabilityPatch?: Record<string, unknown>;
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

export const INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE =
  "Preview 배포 권한을 다시 확인하는 중입니다...";

export const INTEGRATION_PREVIEW_PREFLIGHT_CONFIRMED_USER_MESSAGE =
  "Preview 배포 권한이 확인되었습니다. GitHub Pages Preview를 준비합니다.";

function isFailedOrBlocked(c: AutoGenerationCheckResultV1): boolean {
  return c.status === "failed" || (c.required && c.status === "unknown");
}

function classifyPreviewPreflightFailure(
  checks: readonly AutoGenerationCheckResultV1[],
): IntegrationPreviewPreflightOutcomeV1 | Readonly<{ readonly ok: true }> {
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
    } as const;
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
    } as const;
  }

  const anyRequiredFailed = checks.some((c) => c.required && isFailedOrBlocked(c));
  if (anyRequiredFailed) {
    return {
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: PERMISSION_USER_MESSAGE,
      remediationCode: "enable_actions_permission",
      checks,
    } as const;
  }

  return { ok: true };
}

function buildCapabilityPatch(input: {
  readonly capabilitySnapshot: Record<string, unknown> | null;
  readonly checks: readonly AutoGenerationCheckResultV1[];
  readonly preflight: GithubProviderPreflightResultV1;
  readonly checkedAt: string;
  readonly previewDeploymentReady: boolean;
  readonly failure?: Readonly<{ readonly key: string; readonly remediationCode: string }> | null;
}): Record<string, unknown> | undefined {
  if (!input.capabilitySnapshot) return undefined;
  return mergeLiveIntegrationPreviewPreflightIntoCapabilityJson({
    capability: input.capabilitySnapshot,
    previewDeploymentPreflight: input.checks,
    previewDeploymentReady: input.previewDeploymentReady,
    checkedAt: input.checkedAt,
    githubProviderPreflight: input.preflight,
    failure: input.failure
      ? {
          key: input.failure.key,
          remediationCode: input.failure.remediationCode,
          checkedAt: input.checkedAt,
        }
      : null,
  });
}

export async function runIntegrationPreviewPreflight(input: {
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly projectId?: string;
  readonly integrationBranch?: string | null;
  readonly integrationRunStartedAt?: string | null;
}): Promise<IntegrationPreviewPreflightOutcomeV1> {
  const runStartedAt = input.integrationRunStartedAt ?? new Date().toISOString();
  const capRecord =
    input.capabilitySnapshot && typeof input.capabilitySnapshot === "object"
      ? (input.capabilitySnapshot as Record<string, unknown>)
      : null;
  const previousCheckedAt = readPreviewDeploymentPreflightCheckedAtFromCapability(capRecord);
  const staleReason = resolvePreviewDeploymentPreflightStaleReason({
    checkedAt: previousCheckedAt,
    currentRunStartedAt: runStartedAt,
    tokenUpdatedAt: capRecord?.githubTokenUpdatedAt as string | null | undefined,
    repoUpdatedAt: capRecord?.repoValidatedAt as string | null | undefined,
  });

  console.info(
    JSON.stringify({
      action: "integration_preview_preflight_live_refresh_started",
      projectId: input.projectId ?? null,
      repositoryFullName: input.ownerRepo,
      integrationBranch: input.integrationBranch ?? null,
      previousCheckedAt,
      staleReason,
    }),
  );

  if (staleReason) {
    console.info(
      JSON.stringify({
        action: "integration_preview_preflight_stale_snapshot_ignored",
        projectId: input.projectId ?? null,
        repositoryFullName: input.ownerRepo,
        previousCheckedAt,
        staleReason,
      }),
    );
  }

  let checks: readonly AutoGenerationCheckResultV1[];
  let githubPreflight: GithubProviderPreflightResultV1;
  const checkedAt = new Date().toISOString();
  try {
    const live = await runPreviewDeploymentPreflightWithGithubResult({
      ownerRepo: input.ownerRepo,
      defaultBranch: input.defaultBranch,
      githubToken: input.githubToken,
      capabilitySnapshot: input.capabilitySnapshot ?? null,
      mode: "before_integration_preview",
    });
    checks = live.checks;
    githubPreflight = live.preflight;
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
        currentCheckedAt: checkedAt,
      }),
    );
    return {
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: PERMISSION_USER_MESSAGE,
      remediationCode: "enable_actions_permission",
      checks: [],
      checkedAt,
    };
  }

  const classified = classifyPreviewPreflightFailure(checks);
  const previewDeploymentReady =
    classified.ok === true && derivePreviewDeploymentReadyFromPreflight(githubPreflight);

  const failureRow = !classified.ok
    ? classified.checks.find((c) => isFailedOrBlocked(c))
    : null;

  const capabilityPatch = buildCapabilityPatch({
    capabilitySnapshot: capRecord,
    checks,
    preflight: githubPreflight,
    checkedAt,
    previewDeploymentReady,
    failure: failureRow
      ? { key: String(failureRow.key), remediationCode: String(failureRow.remediationCode ?? "none") }
      : null,
  });

  if (!classified.ok) {
    console.info(
      JSON.stringify({
        action:
          classified.kind === "github_pages_setup_required"
            ? "integration_preview_preflight_pages_setup_required"
            : "integration_preview_preflight_permission_required",
        projectId: input.projectId ?? null,
        repositoryFullName: input.ownerRepo,
        remediationCode: classified.remediationCode,
        requiredPermission: classified.kind,
        previousCheckedAt,
        currentCheckedAt: checkedAt,
        staleReason,
      }),
    );
    return {
      ...classified,
      checkedAt,
      capabilityPatch,
    };
  }

  console.info(
    JSON.stringify({
      action: "integration_preview_preflight_live_refresh_completed",
      projectId: input.projectId ?? null,
      repositoryFullName: input.ownerRepo,
      previousCheckedAt,
      currentCheckedAt: checkedAt,
      staleReason,
    }),
  );
  if (staleReason && capabilityPatch) {
    console.info(
      JSON.stringify({
        action: "integration_preview_preflight_stale_snapshot_replaced",
        projectId: input.projectId ?? null,
        repositoryFullName: input.ownerRepo,
        previousCheckedAt,
        currentCheckedAt: checkedAt,
        staleReason,
      }),
    );
  }

  return {
    ok: true,
    checkedAt,
    capabilityPatch,
  };
}

export { isPreviewDeploymentPreflightSnapshotStale };
