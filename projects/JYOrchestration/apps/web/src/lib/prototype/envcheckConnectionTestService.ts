import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { lastEvalSummaryLooksLikeEnvTestPrFailure } from "@/lib/service/envTestUserFacingMessages";
import type { AutoGenerationCheckResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";

export type EnvcheckConnectionTestSourceV1 = Readonly<{
  readonly workflowStatus: string | null;
  readonly envTestStage1FailureLine: string | null;
  readonly connectionTestMergeMode?: "auto" | "skip" | null;
  readonly branchName: string | null;
  readonly lastEvalSummary?: string | null;
  readonly terminalOk?: boolean;
}>;

export const ENVCHECK_PR_FAIL_USER_MESSAGE =
  "PR 생성/갱신에 실패했습니다. GitHub 저장소 권한 또는 branch 상태를 확인해 주세요.";

export const ENVCHECK_BRANCH_FAIL_USER_MESSAGE =
  "Branch 생성에 실패했습니다. GitHub Token Contents 권한과 branch protection을 확인해 주세요.";

export const ENVCHECK_FILE_FAIL_USER_MESSAGE =
  "파일 생성/수정에 실패했습니다. GitHub Token Contents 권한을 확인해 주세요.";

function row(
  key: string,
  status: AutoGenerationCheckResultV1["status"],
  userSafeMessage: string | null,
  operatorMessage?: string | null,
): AutoGenerationCheckResultV1 {
  return {
    key,
    status,
    required: true,
    userSafeMessage,
    operatorMessage: operatorMessage ?? null,
    remediationCode:
      key === "pull_request_create_or_update"
        ? "enable_pull_request_permission"
        : "enable_contents_permission",
  };
}

function normalizeWorkflow(w: string | null | undefined): string {
  return String(w ?? "").trim().toUpperCase();
}

export function buildEnvcheckResultsFromSources(input: {
  readonly source: EnvcheckConnectionTestSourceV1 | null;
  readonly capability: GithubCapabilityValidationSnapshot | null | undefined;
  readonly envcheckBlocked?: boolean;
}): readonly AutoGenerationCheckResultV1[] {
  if (input.envcheckBlocked) {
    return [
      row("branch_create", "skipped", "기본 GitHub 연결 실패로 실행되지 않음"),
      row("file_write", "skipped", null),
      row("pull_request_create_or_update", "skipped", null),
    ];
  }

  const src = input.source;
  const cap = input.capability ?? null;
  const wf = normalizeWorkflow(src?.workflowStatus);
  const failLine = String(src?.envTestStage1FailureLine ?? "").trim();
  const prSummaryFail = lastEvalSummaryLooksLikeEnvTestPrFailure(src?.lastEvalSummary ?? null);

  const mergeMode = src?.connectionTestMergeMode ?? "auto";
  const terminalOk =
    src?.terminalOk === true ||
    wf === EXECUTION_WORKFLOW.MERGED ||
    (wf === EXECUTION_WORKFLOW.PR_OPENED && mergeMode === "skip");

  const branchFromCap = cap?.steps?.some((s) => s.step === "repo_compare_self" && s.ok) ?? false;
  const prFromCap = cap?.prCreateOk === true;

  if (!src && !cap) {
    return [
      row("branch_create", "unknown", "연결 테스트를 실행해 주세요."),
      row("file_write", "unknown", null),
      row("pull_request_create_or_update", "unknown", null),
    ];
  }

  if (failLine || prSummaryFail) {
    const isPr =
      /\bPR\b/i.test(failLine) ||
      prSummaryFail ||
      wf === EXECUTION_WORKFLOW.FAILED;
    return [
      row(
        "branch_create",
        isPr ? "passed" : "failed",
        isPr ? null : ENVCHECK_BRANCH_FAIL_USER_MESSAGE,
        failLine || src?.lastEvalSummary || null,
      ),
      row(
        "file_write",
        isPr ? "passed" : "failed",
        isPr ? null : ENVCHECK_FILE_FAIL_USER_MESSAGE,
        null,
      ),
      row(
        "pull_request_create_or_update",
        "failed",
        ENVCHECK_PR_FAIL_USER_MESSAGE,
        src?.lastEvalSummary ?? failLine,
      ),
    ];
  }

  if (terminalOk) {
    return [
      row("branch_create", "passed", "envcheck branch 생성 가능"),
      row("file_write", "passed", "임시 파일 생성/갱신 가능"),
      row("pull_request_create_or_update", "passed", "envcheck PR 생성/갱신 가능"),
    ];
  }

  if (branchFromCap && prFromCap) {
    return [
      row("branch_create", "passed", "저장소 branch 생성 가능"),
      row("file_write", "passed", "파일 생성/수정 가능"),
      row("pull_request_create_or_update", "passed", "PR 생성 가능"),
    ];
  }

  if (wf === EXECUTION_WORKFLOW.COMMITTED || Boolean(src?.branchName?.trim())) {
    return [
      row("branch_create", "passed", "envcheck branch 생성 가능"),
      row("file_write", "passed", "임시 파일 생성/갱신 가능"),
      row("pull_request_create_or_update", "warning", "PR 생성/갱신 확인 중입니다."),
    ];
  }

  return [
    row("branch_create", branchFromCap ? "passed" : "unknown", branchFromCap ? null : "연결 테스트를 실행해 주세요."),
    row("file_write", branchFromCap ? "passed" : "unknown", null),
    row(
      "pull_request_create_or_update",
      prFromCap ? "passed" : "unknown",
      prFromCap ? null : "연결 테스트를 실행해 주세요.",
    ),
  ];
}
