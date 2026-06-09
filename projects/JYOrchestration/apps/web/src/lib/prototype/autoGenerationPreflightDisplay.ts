import type { PrototypeEnvReadinessTone } from "@/lib/project/prototypeEnvSettingsReadiness";
import type {
  GithubPreflightCheckKeyV1,
  GithubPreflightCheckResultV1,
  GithubProviderPreflightResultV1,
} from "@/lib/prototype/githubProviderPreflightTypes";

export type AutoGenerationPreflightDisplayKeyV1 =
  | "repository_access"
  | "contents_write"
  | "branch_create"
  | "pull_request_create"
  | "workflow_file_write"
  | "actions_workflow_dispatch"
  | "gh_pages_branch_write"
  | "pages_status_read";

export type AutoGenerationPreflightTableRow = Readonly<{
  readonly key: AutoGenerationPreflightDisplayKeyV1;
  readonly helpKey: GithubPreflightCheckKeyV1;
  readonly label: string;
  readonly status: string;
  readonly statusTone: PrototypeEnvReadinessTone;
  readonly currentValue: string;
}>;

const DISPLAY_ORDER: readonly AutoGenerationPreflightDisplayKeyV1[] = [
  "repository_access",
  "contents_write",
  "branch_create",
  "pull_request_create",
  "workflow_file_write",
  "actions_workflow_dispatch",
  "gh_pages_branch_write",
  "pages_status_read",
];

const LABELS: Record<AutoGenerationPreflightDisplayKeyV1, string> = {
  repository_access: "저장소 접근",
  contents_write: "파일 생성/수정 권한",
  branch_create: "Branch 생성 권한",
  pull_request_create: "PR 생성 권한",
  workflow_file_write: "Workflow 파일 생성 권한",
  actions_workflow_dispatch: "GitHub Actions 실행 권한",
  gh_pages_branch_write: "GitHub Pages 배포 branch",
  pages_status_read: "GitHub Pages 설정",
};

function findCheck(
  preflight: GithubProviderPreflightResultV1 | null,
  key: GithubPreflightCheckKeyV1,
): GithubPreflightCheckResultV1 | null {
  if (!preflight) return null;
  return preflight.checks.find((c) => c.key === key) ?? null;
}

function statusPresentation(check: GithubPreflightCheckResultV1 | null): {
  readonly status: string;
  readonly tone: PrototypeEnvReadinessTone;
  readonly value: string;
} {
  if (!check) {
    return { status: "확인 필요", tone: "neutral", value: "연결 테스트 필요" };
  }
  const msg = String(check.userSafeMessage ?? "").trim();
  switch (check.status) {
    case "passed":
      return { status: "정상", tone: "ok", value: msg || "통과" };
    case "failed":
      if (check.remediationCode === "enable_pages" || check.key === "pages_status_read") {
        return { status: "설정 필요", tone: "warn", value: msg || "Pages 설정 확인 필요" };
      }
      if (
        check.remediationCode === "enable_actions_permission" ||
        check.remediationCode === "enable_workflow_permission" ||
        check.remediationCode === "reauthorize_github"
      ) {
        return { status: "권한 필요", tone: "warn", value: msg || "권한 보완 필요" };
      }
      return { status: "실패", tone: "fail", value: msg || "확인 필요" };
    case "warning":
      return { status: "확인 필요", tone: "warn", value: msg || "확인 필요" };
    case "skipped":
      return { status: "건너뜀", tone: "neutral", value: msg || "—" };
    default:
      return { status: "확인 필요", tone: "neutral", value: msg || "연결 테스트 필요" };
  }
}

export function buildAutoGenerationPreflightTableRows(input: {
  readonly preflight: GithubProviderPreflightResultV1 | null;
}): readonly AutoGenerationPreflightTableRow[] {
  return DISPLAY_ORDER.map((key) => {
    const check = findCheck(input.preflight, key);
    const pres = statusPresentation(check);
    return {
      key,
      helpKey: key,
      label: LABELS[key],
      status: pres.status,
      statusTone: pres.tone,
      currentValue: pres.value,
    };
  });
}

export function preflightHasRemediationBlockers(preflight: GithubProviderPreflightResultV1 | null): boolean {
  if (!preflight) return false;
  if (preflight.level === "blocked") return true;
  return preflight.checks.some(
    (c) => c.required && c.status === "failed" && c.key !== "pull_request_create",
  );
}
