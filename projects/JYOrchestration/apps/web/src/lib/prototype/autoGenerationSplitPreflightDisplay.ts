import type { PrototypeEnvReadinessTone } from "@/lib/project/prototypeEnvSettingsReadiness";
import type {
  AutoGenerationCheckResultV1,
  AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

export type SplitPreflightTableRow = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly status: string;
  readonly statusTone: PrototypeEnvReadinessTone;
  readonly currentValue: string;
  readonly detailMessage?: string | null;
}>;

const ENVCHECK_COMPACT_KEYS = new Set([
  "branch_create",
  "file_write",
  "pull_request_create_or_update",
]);

export function compactEnvcheckDisplayValue(
  key: string,
  status: AutoGenerationCheckResultV1["status"],
): string {
  switch (status) {
    case "passed":
      if (key === "branch_create") return "생성됨";
      if (key === "file_write") return "완료";
      if (key === "pull_request_create_or_update") return "생성/갱신됨";
      return "완료";
    case "failed":
      return "실패";
    case "warning":
      return "확인 필요";
    case "skipped":
      return "건너뜀";
    default:
      return "확인 필요";
  }
}

const ENVCHECK_LABELS: Record<string, string> = {
  branch_create: "Branch 생성",
  file_write: "파일 생성/수정",
  pull_request_create_or_update: "PR 생성/갱신",
};

const PREVIEW_LABELS: Record<string, string> = {
  workflow_file_write: "Workflow 파일 생성",
  actions_workflow_dispatch: "GitHub Actions 실행",
  gh_pages_branch_write: "GitHub Pages 배포 branch",
  pages_status_read: "GitHub Pages 설정",
  pages_configuration: "GitHub Pages 설정",
};

function toneForCheck(c: AutoGenerationCheckResultV1): {
  readonly status: string;
  readonly tone: PrototypeEnvReadinessTone;
  readonly value: string;
} {
  const msg = String(c.userSafeMessage ?? "").trim();
  switch (c.status) {
    case "passed":
      return { status: "정상", tone: "ok", value: msg || "통과" };
    case "failed":
      if (
        c.key === "actions_workflow_dispatch" ||
        c.key === "workflow_file_write" ||
        c.remediationCode === "enable_actions_permission" ||
        c.remediationCode === "enable_workflow_permission"
      ) {
        return { status: "권한 필요", tone: "warn", value: msg || "권한 보완 필요" };
      }
      return { status: "실패", tone: "fail", value: msg || "확인 필요" };
    case "warning":
      return { status: "설정 필요", tone: "warn", value: msg || "확인 필요" };
    case "skipped":
      return { status: "건너뜀", tone: "neutral", value: msg || "—" };
    default:
      return { status: "확인 필요", tone: "neutral", value: msg || "연결 테스트 필요" };
  }
}

function rowsForChecks(
  checks: readonly AutoGenerationCheckResultV1[],
  labels: Record<string, string>,
  order: readonly string[],
  options?: Readonly<{ readonly compactEnvcheckValues?: boolean }>,
): readonly SplitPreflightTableRow[] {
  const byKey = new Map(checks.map((c) => [c.key, c]));
  return order.map((key) => {
    const c = byKey.get(key);
    const pres = c
      ? toneForCheck(c)
      : { status: "확인 필요", tone: "neutral" as const, value: "연결 테스트 필요" };
    const detailMessage = c ? String(c.userSafeMessage ?? "").trim() || null : null;
    const useCompact = options?.compactEnvcheckValues === true && ENVCHECK_COMPACT_KEYS.has(key) && c;
    const currentValue = useCompact ? compactEnvcheckDisplayValue(key, c!.status) : pres.value;
    return {
      key,
      label: labels[key] ?? key,
      status: pres.status,
      statusTone: pres.tone,
      currentValue,
      detailMessage: useCompact ? detailMessage ?? pres.value : detailMessage,
    };
  });
}

export function buildEnvcheckTableRows(
  result: AutoGenerationSettingsConnectionTestResultV1 | null,
): readonly SplitPreflightTableRow[] {
  const normalized = result ? normalizeAutoGenerationConnectionTestResult({
    basicConnection: result.basicConnection,
    envcheck: result.envcheck,
    previewDeploymentPreflight: result.previewDeploymentPreflight,
    checkedAt: result.checkedAt,
    settingsConnectionTestOnly: true,
  }) : null;
  if (!normalized) return [];
  return rowsForChecks(normalized.envcheck, ENVCHECK_LABELS, [
    "branch_create",
    "file_write",
    "pull_request_create_or_update",
  ], { compactEnvcheckValues: true });
}

export function buildEnvcheckFallbackDisplayRows(): readonly SplitPreflightTableRow[] {
  const normalized = normalizeAutoGenerationConnectionTestResult({
    checkedAt: new Date().toISOString(),
  });
  return buildEnvcheckTableRows(normalized);
}

export function buildPreviewPreflightTableRows(
  result: AutoGenerationSettingsConnectionTestResultV1 | null,
): readonly SplitPreflightTableRow[] {
  const normalized = result ? normalizeAutoGenerationConnectionTestResult({
    basicConnection: result.basicConnection,
    envcheck: result.envcheck,
    previewDeploymentPreflight: result.previewDeploymentPreflight,
    checkedAt: result.checkedAt,
    settingsConnectionTestOnly: true,
  }) : null;
  if (!normalized) return [];
  const checks = normalized.previewDeploymentPreflight.filter(
    (c) => c.key !== "pages_configuration" || !normalized.previewDeploymentPreflight.some((x) => x.key === "pages_status_read"),
  );
  const order = [
    "workflow_file_write",
    "actions_workflow_dispatch",
    "gh_pages_branch_write",
    "pages_status_read",
  ];
  const filtered = checks.filter((c) => order.includes(c.key) || c.key === "pages_configuration");
  const displayChecks =
    filtered.some((c) => c.key === "pages_status_read")
      ? filtered.filter((c) => c.key !== "pages_configuration")
      : filtered;
  return rowsForChecks(displayChecks, PREVIEW_LABELS, order);
}

export function buildPreviewFallbackDisplayRows(): readonly SplitPreflightTableRow[] {
  const normalized = normalizeAutoGenerationConnectionTestResult({
    checkedAt: new Date().toISOString(),
  });
  return buildPreviewPreflightTableRows(normalized);
}

const SUMMARY_ACTIONABLE: ReadonlySet<AutoGenerationCheckResultV1["status"]> = new Set([
  "failed",
  "unknown",
  "warning",
]);

export function shouldShowBasicConnectionSummaryCard(
  basic: readonly AutoGenerationCheckResultV1[],
): boolean {
  return basic.some((row) => SUMMARY_ACTIONABLE.has(row.status));
}

export function shouldShowEnvcheckSummaryCard(
  envcheck: readonly AutoGenerationCheckResultV1[],
): boolean {
  return envcheck.some((row) => row.required && SUMMARY_ACTIONABLE.has(row.status));
}

export function shouldShowGithubTokenResetButton(
  result: AutoGenerationSettingsConnectionTestResultV1 | null,
): boolean {
  if (!result) return false;
  const token = result.basicConnection.find((c) => c.key === "github_token");
  if (token && SUMMARY_ACTIONABLE.has(token.status)) return true;
  const repo = result.basicConnection.find((c) => c.key === "github_repository");
  if (repo && SUMMARY_ACTIONABLE.has(repo.status)) return true;
  return result.envcheck.some(
    (c) =>
      c.required &&
      (c.status === "failed" || c.status === "warning") &&
      (c.key === "pull_request_create_or_update" ||
        c.key === "branch_create" ||
        c.key === "file_write" ||
        c.remediationCode === "enable_pull_request_permission" ||
        c.remediationCode === "enable_contents_permission"),
  );
}

export function splitPreflightNeedsRemediation(
  result: AutoGenerationSettingsConnectionTestResultV1 | null,
): boolean {
  if (!result) return false;
  return !result.autoGenerationReady;
}
