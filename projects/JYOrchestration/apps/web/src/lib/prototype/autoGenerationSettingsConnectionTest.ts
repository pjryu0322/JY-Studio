import type { ExecutionSetupDto } from "@/components/project-spec/api";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import {
  buildEnvcheckResultsFromSources,
  type EnvcheckConnectionTestSourceV1,
} from "@/lib/prototype/envcheckConnectionTestService";
import {
  mapPreviewPreflightChecksToAutoGenerationResults,
  runPreviewDeploymentPreflight,
} from "@/lib/prototype/previewDeploymentPreflightService";
import { parseGithubProviderPreflightV1 } from "@/lib/prototype/githubProviderPreflightParse";
import { GITHUB_PROVIDER_PREFLIGHT_JSON_KEY } from "@/lib/prototype/githubProviderPreflightTypes";

export type AutoGenerationBasicConnectionCheckKeyV1 = "github_repository" | "github_token" | "cursor_api";

export type AutoGenerationEnvcheckKeyV1 =
  | "branch_create"
  | "file_write"
  | "pull_request_create_or_update";

export type PreviewDeploymentPreflightKeyV1 =
  | "workflow_file_write"
  | "actions_workflow_dispatch"
  | "gh_pages_branch_write"
  | "pages_status_read"
  | "pages_configuration";

export type AutoGenerationCheckStatusV1 = "passed" | "failed" | "warning" | "skipped" | "unknown";

export type AutoGenerationRemediationCodeV1 =
  | "none"
  | "check_repository"
  | "check_token"
  | "check_cursor_api"
  | "reauthorize_github"
  | "enable_contents_permission"
  | "enable_pull_request_permission"
  | "enable_workflow_permission"
  | "enable_actions_permission"
  | "enable_pages"
  | "manual_setup_required";

export type AutoGenerationCheckResultV1 = Readonly<{
  readonly key: string;
  readonly status: AutoGenerationCheckStatusV1;
  readonly required: boolean;
  readonly userSafeMessage: string | null;
  readonly operatorMessage: string | null;
  readonly remediationCode: AutoGenerationRemediationCodeV1;
}>;

import {
  normalizeAutoGenerationConnectionTestResult,
  type AutoGenerationConnectionTestSectionSummariesV1,
} from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

export type { AutoGenerationConnectionTestSectionSummariesV1 };

export type AutoGenerationSettingsConnectionTestResultV1 = Readonly<{
  readonly basicConnection: readonly AutoGenerationCheckResultV1[];
  readonly envcheck: readonly AutoGenerationCheckResultV1[];
  readonly previewDeploymentPreflight: readonly AutoGenerationCheckResultV1[];
  readonly autoGenerationReady: boolean;
  readonly previewDeploymentReady: boolean;
  readonly level: "ready" | "warning" | "blocked";
  readonly userSummary: string;
  readonly sectionSummaries: AutoGenerationConnectionTestSectionSummariesV1;
  readonly checkedAt: string;
}>;

export const AUTO_GENERATION_CONNECTION_TEST_JSON_KEY = "autoGenerationConnectionTestV1" as const;

function check(
  key: string,
  status: AutoGenerationCheckStatusV1,
  input: {
    readonly required?: boolean;
    readonly userSafeMessage?: string | null;
    readonly operatorMessage?: string | null;
    readonly remediationCode?: AutoGenerationRemediationCodeV1;
  },
): AutoGenerationCheckResultV1 {
  return {
    key,
    status,
    required: input.required ?? true,
    userSafeMessage: input.userSafeMessage ?? null,
    operatorMessage: input.operatorMessage ?? null,
    remediationCode: input.remediationCode ?? "none",
  };
}

export function buildBasicConnectionChecks(es: ExecutionSetupDto | null): readonly AutoGenerationCheckResultV1[] {
  const repoName = String(es?.gitRepoName ?? "").trim();
  const repoOk = es?.repoConnectionOk === true && Boolean(repoName);
  const cap = es?.githubCapabilityValidation ?? null;
  const tokenOk = es?.githubAuthConnectionOk === true && cap?.githubOperableOk === true;
  const cursorOk = es?.cursorApiConnectionOk === true;

  return [
    check("github_repository", !repoName ? "unknown" : repoOk ? "passed" : "failed", {
      userSafeMessage: repoOk ? null : "GitHub 저장소 연결을 확인해 주세요.",
      remediationCode: "check_repository",
    }),
    check("github_token", tokenOk ? "passed" : es?.hasGithubAccessToken ? "failed" : "unknown", {
      userSafeMessage: tokenOk ? null : "GitHub Token 권한을 확인해 주세요.",
      remediationCode: "check_token",
    }),
    check("cursor_api", cursorOk ? "passed" : es?.hasCursorToken ? "unknown" : "unknown", {
      userSafeMessage: cursorOk ? null : "Cursor API 연결을 확인해 주세요.",
      remediationCode: "check_cursor_api",
      required: true,
    }),
  ];
}

function allRequiredPassed(rows: readonly AutoGenerationCheckResultV1[], keys: readonly string[]): boolean {
  const set = new Set(keys);
  for (const row of rows) {
    if (!set.has(row.key)) continue;
    if (!row.required) continue;
    if (row.status !== "passed") return false;
  }
  return true;
}

export function deriveAutoGenerationReadyFromConnectionTest(
  result: Pick<
    AutoGenerationSettingsConnectionTestResultV1,
    "basicConnection" | "envcheck"
  >,
): boolean {
  const basicKeys: AutoGenerationBasicConnectionCheckKeyV1[] = [
    "github_repository",
    "github_token",
    "cursor_api",
  ];
  const envKeys: AutoGenerationEnvcheckKeyV1[] = [
    "branch_create",
    "file_write",
    "pull_request_create_or_update",
  ];
  return (
    allRequiredPassed(result.basicConnection, basicKeys) &&
    allRequiredPassed(result.envcheck, envKeys)
  );
}

export function derivePreviewDeploymentReadyFromConnectionTest(
  previewRows: readonly AutoGenerationCheckResultV1[],
): boolean {
  const required: PreviewDeploymentPreflightKeyV1[] = [
    "workflow_file_write",
    "actions_workflow_dispatch",
    "gh_pages_branch_write",
  ];
  if (!allRequiredPassed(previewRows, required)) return false;
  const pagesOk =
    previewRows.find((r) => r.key === "pages_status_read")?.status === "passed" ||
    previewRows.find((r) => r.key === "pages_configuration")?.status === "passed";
  return pagesOk;
}

export function deriveConnectionTestLevel(input: {
  readonly autoGenerationReady: boolean;
  readonly previewDeploymentReady: boolean;
}): "ready" | "warning" | "blocked" {
  if (!input.autoGenerationReady) return "blocked";
  if (!input.previewDeploymentReady) return "warning";
  return "ready";
}

export function buildConnectionTestUserSummary(input: {
  readonly autoGenerationReady: boolean;
  readonly previewDeploymentReady: boolean;
}): string {
  if (input.autoGenerationReady && input.previewDeploymentReady) {
    return "자동 생성과 Preview 배포 준비가 완료되었습니다.";
  }
  if (input.autoGenerationReady && !input.previewDeploymentReady) {
    return "자동 생성 연결은 정상입니다. Preview 배포에는 GitHub Actions 실행 권한이 추가로 필요합니다.";
  }
  return "자동 생성 기본 연결에 문제가 있습니다. GitHub 저장소/토큰/Cursor API 설정을 확인해 주세요.";
}

export function buildSettingsScopeConnectionTestUserSummary(
  autoGenerationReady: boolean,
): string {
  if (autoGenerationReady) {
    return "자동 생성 기본 연결이 정상입니다.\nAI 개발자가 GitHub branch와 PR을 생성할 수 있습니다.";
  }
  return "자동 생성 기본 연결에 문제가 있습니다. GitHub 저장소/토큰/Cursor API 설정을 확인해 주세요.";
}

export const SETTINGS_DEFERRED_PREVIEW_PREFLIGHT_MESSAGE =
  "통합 및 Preview 준비 단계에서 확인됩니다." as const;

export function buildEnvcheckSummaryLine(envcheck: readonly AutoGenerationCheckResultV1[]): string {
  const failed = envcheck.filter((c) => c.required && c.status === "failed");
  if (!failed.length) return "정상입니다.";
  const pr = failed.find((c) => c.key === "pull_request_create_or_update");
  if (pr?.userSafeMessage) return pr.userSafeMessage;
  const first = failed[0]?.userSafeMessage;
  return first ?? "자동 생성 기본 점검에 실패했습니다. GitHub 저장소 권한을 확인해 주세요.";
}

export function buildPreviewPreflightSummaryLine(
  preview: readonly AutoGenerationCheckResultV1[],
): string {
  const actionable = preview.filter(
    (c) => c.status === "failed" || c.status === "warning",
  );
  if (!actionable.length) return "정상입니다.";
  const actions = actionable.find((c) => c.key === "actions_workflow_dispatch");
  if (actions?.userSafeMessage) return actions.userSafeMessage.replace(/\n/g, " ");
  const pages = actionable.find((c) => c.key === "pages_status_read" || c.key === "pages_configuration");
  if (pages?.userSafeMessage) return pages.userSafeMessage;
  return actionable[0]?.userSafeMessage ?? "Preview 배포 사전점검을 완료해 주세요.";
}

export function parseAutoGenerationConnectionTestV1(
  raw: unknown,
): AutoGenerationSettingsConnectionTestResultV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const readRows = (v: unknown): AutoGenerationCheckResultV1[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === "object")
      .map((x) => x as AutoGenerationCheckResultV1);
  };
  const basicConnection = readRows(o.basicConnection);
  const envcheck = readRows(o.envcheck);
  const previewDeploymentPreflight = readRows(o.previewDeploymentPreflight);
  const level = o.level;
  const checkedAt = String(o.checkedAt ?? new Date().toISOString());
  if (level !== "ready" && level !== "warning" && level !== "blocked") {
    return normalizeAutoGenerationConnectionTestResult({
      basicConnection,
      envcheck,
      previewDeploymentPreflight,
      checkedAt,
    });
  }
  return normalizeAutoGenerationConnectionTestResult({
    basicConnection,
    envcheck,
    previewDeploymentPreflight,
    checkedAt,
  });
}

export function extractConnectionTestFromCapabilityJson(
  raw: unknown,
): AutoGenerationSettingsConnectionTestResultV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const nested = (raw as Record<string, unknown>)[AUTO_GENERATION_CONNECTION_TEST_JSON_KEY];
  const parsed = parseAutoGenerationConnectionTestV1(nested);
  if (!parsed) return null;
  return normalizeAutoGenerationConnectionTestResult({
    basicConnection: parsed.basicConnection,
    envcheck: parsed.envcheck,
    previewDeploymentPreflight: parsed.previewDeploymentPreflight,
    checkedAt: parsed.checkedAt,
    settingsConnectionTestOnly: true,
  });
}

export function mergeCapabilityWithConnectionTest(
  capability: Record<string, unknown>,
  connectionTest: AutoGenerationSettingsConnectionTestResultV1,
): Record<string, unknown> {
  return { ...capability, [AUTO_GENERATION_CONNECTION_TEST_JSON_KEY]: connectionTest };
}

export async function buildAutoGenerationSettingsConnectionTestResult(input: {
  readonly executionSetup: ExecutionSetupDto | null;
  readonly envcheckSource: EnvcheckConnectionTestSourceV1;
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly cursorApiConfigured?: boolean;
  readonly envcheckBlocked?: boolean;
  /** When false (default), preview preflight runs only for advanced checks — not settings gate. */
  readonly includePreviewPreflight?: boolean;
}): Promise<AutoGenerationSettingsConnectionTestResultV1> {
  const basicConnection = buildBasicConnectionChecks(input.executionSetup);
  const envcheck = buildEnvcheckResultsFromSources({
    source: input.envcheckSource,
    capability: input.capabilitySnapshot ?? input.executionSetup?.githubCapabilityValidation ?? null,
    envcheckBlocked: input.envcheckBlocked === true,
  });

  const includePreviewPreflight = input.includePreviewPreflight === true;
  let previewDeploymentPreflight: AutoGenerationCheckResultV1[] = [];
  let preflightException = false;
  const settingsConnectionTestOnly = !includePreviewPreflight;

  if (!includePreviewPreflight) {
    previewDeploymentPreflight = [];
  } else if (input.envcheckBlocked) {
    previewDeploymentPreflight = [
      check("workflow_file_write", "skipped", { userSafeMessage: "자동 생성 기본 점검 실패로 미실행" }),
      check("actions_workflow_dispatch", "skipped", { userSafeMessage: "자동 생성 기본 점검 실패로 미실행" }),
      check("gh_pages_branch_write", "skipped", { userSafeMessage: "자동 생성 기본 점검 실패로 미실행" }),
      check("pages_status_read", "skipped", { userSafeMessage: "자동 생성 기본 점검 실패로 미실행" }),
      check("pages_configuration", "skipped", { userSafeMessage: "자동 생성 기본 점검 실패로 미실행", required: false }),
    ];
  } else {
    try {
      const previewChecks = await runPreviewDeploymentPreflight({
        ownerRepo: input.ownerRepo,
        defaultBranch: input.defaultBranch,
        githubToken: input.githubToken,
        capabilitySnapshot: input.capabilitySnapshot ?? null,
      });
      previewDeploymentPreflight = [...previewChecks];
    } catch {
      preflightException = true;
    }
  }

  const checkedAt = new Date().toISOString();
  return normalizeAutoGenerationConnectionTestResult({
    basicConnection,
    envcheck,
    previewDeploymentPreflight,
    preflightException,
    checkedAt,
    executionSetupForBasic: input.executionSetup,
    settingsConnectionTestOnly,
  });
}

/** Rebuild preview section from stored github preflight v1 (validate path). */
export function connectionTestPreviewFromStoredPreflight(
  capabilityRaw: unknown,
): readonly AutoGenerationCheckResultV1[] {
  if (!capabilityRaw || typeof capabilityRaw !== "object") return [];
  const preflight = parseGithubProviderPreflightV1(
    (capabilityRaw as Record<string, unknown>)[GITHUB_PROVIDER_PREFLIGHT_JSON_KEY],
  );
  if (!preflight) return [];
  return mapPreviewPreflightChecksToAutoGenerationResults(preflight.checks);
}

const ENVCHECK_MERGE_KEYS: readonly AutoGenerationEnvcheckKeyV1[] = [
  "branch_create",
  "file_write",
  "pull_request_create_or_update",
];

const ENVCHECK_STATUS_RANK: Record<AutoGenerationCheckStatusV1, number> = {
  passed: 5,
  warning: 4,
  failed: 3,
  unknown: 2,
  skipped: 1,
};

const BASIC_MERGE_KEYS = ["github_repository", "github_token", "cursor_api"] as const;

function mergeCheckRowByRank(
  evidence: AutoGenerationCheckResultV1,
  server: AutoGenerationCheckResultV1,
): AutoGenerationCheckResultV1 {
  const e = ENVCHECK_STATUS_RANK[evidence.status] ?? 0;
  const s = ENVCHECK_STATUS_RANK[server.status] ?? 0;
  return e >= s ? evidence : server;
}

/** Keep envcheck rows from a live environment test when server connection test is stale or skipped. */
export function mergeConnectionTestPreservingEnvcheckEvidence(
  evidenceFirst: AutoGenerationSettingsConnectionTestResultV1,
  server: AutoGenerationSettingsConnectionTestResultV1 | null | undefined,
): AutoGenerationSettingsConnectionTestResultV1 {
  if (!server) {
    return normalizeAutoGenerationConnectionTestResult({
      basicConnection: evidenceFirst.basicConnection,
      envcheck: evidenceFirst.envcheck,
      previewDeploymentPreflight: evidenceFirst.previewDeploymentPreflight,
      checkedAt: evidenceFirst.checkedAt,
      settingsConnectionTestOnly: true,
    });
  }
  const mergedEnvcheck = ENVCHECK_MERGE_KEYS.map((key) => {
    const fromEvidence = evidenceFirst.envcheck.find((c) => c.key === key);
    const fromServer = server.envcheck.find((c) => c.key === key);
    if (fromEvidence && fromServer) return mergeCheckRowByRank(fromEvidence, fromServer);
    return fromEvidence ?? fromServer ?? check(key, "unknown", { userSafeMessage: "envcheck 결과를 확인하지 못했습니다." });
  });
  const mergedBasic = BASIC_MERGE_KEYS.map((key) => {
    const fromEvidence = evidenceFirst.basicConnection.find((c) => c.key === key);
    const fromServer = server.basicConnection.find((c) => c.key === key);
    if (fromEvidence && fromServer) return mergeCheckRowByRank(fromEvidence, fromServer);
    return (
      fromEvidence ??
      fromServer ??
      check(key, "unknown", {
        userSafeMessage:
          key === "cursor_api"
            ? "Cursor API 확인 결과를 가져오지 못했습니다."
            : key === "github_token"
              ? "GitHub Token 확인 결과를 가져오지 못했습니다."
              : "GitHub 저장소 확인 결과를 가져오지 못했습니다.",
      })
    );
  });
  return normalizeAutoGenerationConnectionTestResult({
    basicConnection: mergedBasic,
    envcheck: mergedEnvcheck,
    previewDeploymentPreflight: server.previewDeploymentPreflight,
    checkedAt: server.checkedAt || evidenceFirst.checkedAt,
    settingsConnectionTestOnly: true,
  });
}
