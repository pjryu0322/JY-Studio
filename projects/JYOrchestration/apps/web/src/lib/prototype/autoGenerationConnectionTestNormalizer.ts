import {
  buildBasicConnectionChecks,
  buildConnectionTestUserSummary,
  deriveAutoGenerationReadyFromConnectionTest,
  deriveConnectionTestLevel,
  derivePreviewDeploymentReadyFromConnectionTest,
  type AutoGenerationCheckResultV1,
  type AutoGenerationCheckStatusV1,
  type AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";

export type AutoGenerationConnectionTestSectionSummariesV1 = Readonly<{
  readonly basicConnection: string;
  readonly envcheck: string;
  readonly previewDeploymentPreflight: string;
}>;

const BASIC_KEYS = ["github_repository", "github_token", "cursor_api"] as const;
const ENVCHECK_KEYS = ["branch_create", "file_write", "pull_request_create_or_update"] as const;
const PREVIEW_KEYS = [
  "workflow_file_write",
  "actions_workflow_dispatch",
  "gh_pages_branch_write",
  "pages_status_read",
  "pages_configuration",
] as const;

function row(
  key: string,
  status: AutoGenerationCheckStatusV1,
  userSafeMessage: string | null,
  input?: {
    readonly required?: boolean;
    readonly remediationCode?: AutoGenerationCheckResultV1["remediationCode"];
    readonly operatorMessage?: string | null;
  },
): AutoGenerationCheckResultV1 {
  return {
    key,
    status,
    required: input?.required ?? true,
    userSafeMessage,
    operatorMessage: input?.operatorMessage ?? null,
    remediationCode: input?.remediationCode ?? "none",
  };
}

function operatorFromThrown(thrownError: unknown): string | null {
  if (!thrownError) return null;
  const raw =
    thrownError instanceof Error ? thrownError.message : String(thrownError);
  const sanitized = raw
    .replace(/github_pat_[\w]+/gi, "[redacted]")
    .replace(/stack\s+at\s+.+/gi, "")
    .trim();
  return sanitized.slice(0, 200) || "connection_test_error";
}

function basicConnectionPassed(basic: readonly AutoGenerationCheckResultV1[]): boolean {
  return basic.every((c) => c.status === "passed");
}

function envcheckPassed(envcheck: readonly AutoGenerationCheckResultV1[]): boolean {
  return envcheck.every((c) => c.required && c.status === "passed");
}

function fillBasicConnection(
  partial: readonly AutoGenerationCheckResultV1[] | null | undefined,
): AutoGenerationCheckResultV1[] {
  const byKey = new Map((partial ?? []).map((c) => [c.key, c]));
  return BASIC_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const userMsg =
      key === "cursor_api"
        ? "Cursor API 확인 결과를 가져오지 못했습니다."
        : key === "github_token"
          ? "GitHub Token 확인 결과를 가져오지 못했습니다."
          : "GitHub 저장소 확인 결과를 가져오지 못했습니다.";
    return row(key, "unknown", userMsg, {
      remediationCode:
        key === "cursor_api" ? "check_cursor_api" : key === "github_token" ? "check_token" : "check_repository",
    });
  });
}

function fillEnvcheck(
  partial: readonly AutoGenerationCheckResultV1[] | null | undefined,
  basicOk: boolean,
  envcheckException: boolean,
): AutoGenerationCheckResultV1[] {
  const byKey = new Map((partial ?? []).map((c) => [c.key, c]));
  const skippedMsg = "기본 GitHub 연결 실패로 실행되지 않음";
  const pendingMsg = "기본 연결 결과를 확인한 뒤 실행됩니다.";
  const exceptionMsg = "자동 생성 기본 점검 중 오류가 발생했습니다. 연결 테스트를 다시 실행해 주세요.";

  return ENVCHECK_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    if (!basicOk) {
      return row(key, "skipped", skippedMsg);
    }
    if (envcheckException) {
      return row(key, "unknown", exceptionMsg, { operatorMessage: "envcheck_exception" });
    }
    return row(key, "unknown", pendingMsg);
  });
}

function fillPreview(
  partial: readonly AutoGenerationCheckResultV1[] | null | undefined,
  envOk: boolean,
  preflightException: boolean,
): AutoGenerationCheckResultV1[] {
  const byKey = new Map((partial ?? []).map((c) => [c.key, c]));
  const skippedMsg = "자동 생성 기본 점검 실패로 미실행";
  const afterEnvMsg = "자동 생성 기본 점검 후 실행됩니다.";
  const exceptionMsg = "Preview 배포 사전점검 중 오류가 발생했습니다. 연결 테스트를 다시 실행해 주세요.";

  return PREVIEW_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const required = key !== "pages_configuration";
    if (!envOk) {
      return row(key, "skipped", skippedMsg, { required });
    }
    if (preflightException) {
      return row(key, "unknown", exceptionMsg, {
        required,
        operatorMessage: "preview_preflight_exception",
      });
    }
    return row(key, "skipped", afterEnvMsg, { required });
  });
}

export function buildBasicConnectionSectionSummary(
  basic: readonly AutoGenerationCheckResultV1[],
): string {
  const failed = basic.filter((c) => c.status === "failed" || c.status === "unknown");
  if (!failed.length) return "기본 연결이 정상입니다.";
  if (failed.some((c) => c.key === "github_repository")) {
    return "GitHub 저장소 연결을 확인해 주세요.";
  }
  if (failed.some((c) => c.key === "github_token")) {
    return "GitHub Token 권한을 확인해 주세요.";
  }
  return "기본 연결 상태를 확인해 주세요.";
}

export function buildEnvcheckSectionSummary(envcheck: readonly AutoGenerationCheckResultV1[]): string {
  const failed = envcheck.filter((c) => c.required && (c.status === "failed" || c.status === "unknown"));
  const skipped = envcheck.every((c) => c.status === "skipped");
  if (skipped) return "기본 연결 완료 후 자동 생성 기본 점검이 실행됩니다.";
  if (!failed.length) return "자동 생성 기본 점검이 정상입니다.";
  const pr = failed.find((c) => c.key === "pull_request_create_or_update");
  if (pr?.userSafeMessage) return pr.userSafeMessage;
  return failed[0]?.userSafeMessage ?? "자동 생성 기본 점검에 문제가 있습니다.";
}

export function buildPreviewSectionSummary(
  preview: readonly AutoGenerationCheckResultV1[],
): string {
  const skippedAll = preview.filter((c) => c.required).every((c) => c.status === "skipped");
  if (skippedAll) return "자동 생성 기본 점검 후 Preview 배포 사전점검이 실행됩니다.";
  const failed = preview.filter(
    (c) =>
      c.status === "failed" ||
      (c.status === "warning" && c.required) ||
      (c.status === "unknown" && c.required),
  );
  if (!failed.length) return "Preview 배포 사전점검이 정상입니다.";
  const actions = failed.find((c) => c.key === "actions_workflow_dispatch");
  if (actions?.userSafeMessage) {
    return actions.userSafeMessage.replace(/\n/g, " ");
  }
  const pages = failed.find((c) => c.key === "pages_status_read" || c.key === "pages_configuration");
  if (pages?.userSafeMessage) return pages.userSafeMessage;
  return failed[0]?.userSafeMessage ?? "Preview 배포 사전점검을 완료해 주세요.";
}

export function normalizeAutoGenerationConnectionTestResult(input: {
  readonly basicConnection?: readonly AutoGenerationCheckResultV1[] | null;
  readonly envcheck?: readonly AutoGenerationCheckResultV1[] | null;
  readonly previewDeploymentPreflight?: readonly AutoGenerationCheckResultV1[] | null;
  readonly thrownError?: unknown;
  readonly envcheckException?: boolean;
  readonly preflightException?: boolean;
  readonly ownerRepo?: string | null;
  readonly defaultBranch?: string | null;
  readonly checkedAt: string;
  readonly executionSetupForBasic?: Parameters<typeof buildBasicConnectionChecks>[0];
}): AutoGenerationSettingsConnectionTestResultV1 {
  void input.ownerRepo;
  void input.defaultBranch;

  const operatorMsg = operatorFromThrown(input.thrownError);
  const basicPartial =
    input.basicConnection?.length
      ? input.basicConnection
      : input.executionSetupForBasic
        ? buildBasicConnectionChecks(input.executionSetupForBasic)
        : null;

  const basicConnection = fillBasicConnection(basicPartial).map((c) =>
    input.thrownError && c.status === "unknown" && !c.operatorMessage
      ? { ...c, operatorMessage: operatorMsg }
      : c,
  );

  const basicOk = basicConnectionPassed(basicConnection);
  const envcheck = fillEnvcheck(
    input.envcheck,
    basicOk,
    input.envcheckException === true || Boolean(input.thrownError && !input.envcheck?.length),
  );
  const envOk = envcheckPassed(envcheck);
  const previewFilled = fillPreview(
    input.previewDeploymentPreflight,
    envOk,
    input.preflightException === true,
  );
  const previewDeploymentPreflight = previewFilled.filter(
    (c) => c.key !== "pages_configuration" || !previewDeploymentPreflightHasPagesRead(input.previewDeploymentPreflight),
  );

  const autoGenerationReady = deriveAutoGenerationReadyFromConnectionTest({
    basicConnection,
    envcheck,
  });
  const previewDeploymentReady = derivePreviewDeploymentReadyFromConnectionTest(
    previewDeploymentPreflight,
  );
  const level = deriveConnectionTestLevel({ autoGenerationReady, previewDeploymentReady });
  const sectionSummaries: AutoGenerationConnectionTestSectionSummariesV1 = {
    basicConnection: buildBasicConnectionSectionSummary(basicConnection),
    envcheck: buildEnvcheckSectionSummary(envcheck),
    previewDeploymentPreflight: buildPreviewSectionSummary(previewDeploymentPreflight),
  };
  const userSummary = buildConnectionTestUserSummary({ autoGenerationReady, previewDeploymentReady });

  return {
    basicConnection,
    envcheck,
    previewDeploymentPreflight,
    autoGenerationReady,
    previewDeploymentReady,
    level,
    userSummary,
    checkedAt: input.checkedAt,
    sectionSummaries,
  };
}

function previewDeploymentPreflightHasPagesRead(
  partial: readonly AutoGenerationCheckResultV1[] | null | undefined,
): boolean {
  return Boolean(partial?.some((c) => c.key === "pages_status_read"));
}

/** Ensure stored or partial results always have full row sets for UI. */
export function coerceNormalizedConnectionTestResult(
  raw: AutoGenerationSettingsConnectionTestResultV1 | null | undefined,
): AutoGenerationSettingsConnectionTestResultV1 | null {
  if (!raw) return null;
  return normalizeAutoGenerationConnectionTestResult({
    basicConnection: raw.basicConnection,
    envcheck: raw.envcheck,
    previewDeploymentPreflight: raw.previewDeploymentPreflight,
    checkedAt: raw.checkedAt || new Date().toISOString(),
  });
}
