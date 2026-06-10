import type { EnvironmentTestLastDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import type { AutoGenerationCheckResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { ENVCHECK_PR_FAIL_USER_MESSAGE } from "@/lib/prototype/envcheckConnectionTestService";

function envRow(
  key: AutoGenerationCheckResultV1["key"],
  status: AutoGenerationCheckResultV1["status"],
  userSafeMessage: string | null,
  remediationCode: AutoGenerationCheckResultV1["remediationCode"] = "none",
): AutoGenerationCheckResultV1 {
  return {
    key,
    status,
    required: true,
    userSafeMessage,
    operatorMessage: null,
    remediationCode,
  };
}

function normalizeWorkflow(w: string | null | undefined): string {
  return String(w ?? "").trim().toUpperCase();
}

function inferBranchName(last: EnvironmentTestLastDto | null | undefined): string {
  const direct = String(last?.branchName ?? "").trim();
  if (direct) return direct;
  const prUrl = String(last?.prUrl ?? "").trim();
  if (!prUrl) return "";
  try {
    const u = new URL(prUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const pullIdx = parts.indexOf("pull");
    if (pullIdx > 0) return "";
    const treeIdx = parts.indexOf("tree");
    if (treeIdx >= 0 && parts[treeIdx + 1]) return decodeURIComponent(parts[treeIdx + 1]!);
  } catch {
    return "";
  }
  return "";
}

function wfIs(workflowStatus: string | null | undefined, expected: string): boolean {
  return normalizeWorkflow(workflowStatus) === normalizeWorkflow(expected);
}

function hasFileWriteEvidence(last: EnvironmentTestLastDto | null | undefined, branchName: string): boolean {
  if (String(last?.mergeCommitSha ?? "").trim()) return true;
  const sig = last?.stage2CursorSignal;
  if (String(sig?.headShaHint ?? "").trim() || String(sig?.commitHashHint ?? "").trim()) return true;
  if (branchName && (last?.stage2PlatformStatus?.prCreated === true || String(last?.prUrl ?? "").trim())) {
    return true;
  }
  if (
    wfIs(last?.workflowStatus, EXECUTION_WORKFLOW.COMMITTED) ||
    wfIs(last?.workflowStatus, EXECUTION_WORKFLOW.PR_OPENED) ||
    wfIs(last?.workflowStatus, EXECUTION_WORKFLOW.MERGED)
  ) {
    return Boolean(branchName);
  }
  return false;
}

function hasPrEvidence(last: EnvironmentTestLastDto | null | undefined): boolean {
  if (String(last?.prUrl ?? "").trim()) return true;
  if (last?.stage2PlatformStatus?.prCreated === true) return true;
  return (
    wfIs(last?.workflowStatus, EXECUTION_WORKFLOW.PR_OPENED) ||
    wfIs(last?.workflowStatus, EXECUTION_WORKFLOW.MERGED)
  );
}

export function buildEnvcheckResultsFromEnvironmentTest(input: {
  readonly responseOk: boolean;
  readonly apiSuccess: boolean;
  readonly taskId?: string | null;
  readonly last?: EnvironmentTestLastDto | null;
  readonly message?: string | null;
}): readonly AutoGenerationCheckResultV1[] {
  void input.responseOk;
  void input.apiSuccess;
  void input.taskId;
  void input.message;

  const last = input.last ?? null;
  const branchName = inferBranchName(last);
  const branchOk = Boolean(branchName);
  const fileOk = hasFileWriteEvidence(last, branchName);
  const prOk = hasPrEvidence(last);

  if (!last && !branchOk && !prOk) {
    return [
      envRow("branch_create", "unknown", "envcheck 결과를 확인하지 못했습니다."),
      envRow("file_write", "unknown", "envcheck 결과를 확인하지 못했습니다."),
      envRow("pull_request_create_or_update", "unknown", "envcheck 결과를 확인하지 못했습니다."),
    ];
  }

  const failLine = String(last?.envTestStage1FailureLine ?? "").trim();
  if (failLine && prOk) {
    return [
      envRow("branch_create", "passed", "envcheck branch가 생성되었습니다."),
      envRow("file_write", "passed", "임시 파일 생성/수정이 완료되었습니다."),
      envRow(
        "pull_request_create_or_update",
        "failed",
        ENVCHECK_PR_FAIL_USER_MESSAGE,
        "enable_pull_request_permission",
      ),
    ];
  }

  if (branchOk && fileOk && prOk) {
    return [
      envRow("branch_create", "passed", "envcheck branch가 생성되었습니다."),
      envRow("file_write", "passed", "임시 파일 생성/수정이 완료되었습니다."),
      envRow("pull_request_create_or_update", "passed", "envcheck PR이 생성 또는 갱신되었습니다."),
    ];
  }

  if (branchOk && fileOk && !prOk) {
    return [
      envRow("branch_create", "passed", "envcheck branch가 생성되었습니다."),
      envRow("file_write", "passed", "임시 파일 생성/수정이 완료되었습니다."),
      envRow(
        "pull_request_create_or_update",
        "warning",
        "PR 생성/갱신을 확인하지 못했습니다. 도움말을 확인해 주세요.",
        "enable_pull_request_permission",
      ),
    ];
  }

  if (branchOk && !fileOk && !prOk) {
    return [
      envRow("branch_create", "passed", "envcheck branch가 생성되었습니다."),
      envRow("file_write", "warning", "파일 생성/수정 결과를 확인하지 못했습니다."),
      envRow(
        "pull_request_create_or_update",
        "failed",
        ENVCHECK_PR_FAIL_USER_MESSAGE,
        "enable_pull_request_permission",
      ),
    ];
  }

  if (!branchOk) {
    return [
      envRow("branch_create", "failed", "Branch 생성 결과를 확인하지 못했습니다.", "enable_contents_permission"),
      envRow("file_write", "skipped", null),
      envRow("pull_request_create_or_update", "skipped", null),
    ];
  }

  return [
    envRow("branch_create", branchOk ? "passed" : "unknown", branchOk ? "envcheck branch가 생성되었습니다." : null),
    envRow(
      "file_write",
      fileOk ? "passed" : "unknown",
      fileOk ? "임시 파일 생성/수정이 완료되었습니다." : "envcheck 결과를 확인하지 못했습니다.",
    ),
    envRow(
      "pull_request_create_or_update",
      prOk ? "passed" : "unknown",
      prOk ? "envcheck PR이 생성 또는 갱신되었습니다." : ENVCHECK_PR_FAIL_USER_MESSAGE,
      prOk ? "none" : "enable_pull_request_permission",
    ),
  ];
}

export function buildEnvcheckEvidenceExecutionMessage(
  envcheck: readonly AutoGenerationCheckResultV1[],
): string {
  const required = envcheck.filter((c) => c.required);
  const allPassed = required.length > 0 && required.every((c) => c.status === "passed");
  if (allPassed) {
    return "자동 생성 기본 점검이 정상입니다. AI 개발자가 GitHub branch와 PR을 생성할 수 있습니다.";
  }
  const anyPassed = required.some((c) => c.status === "passed");
  const anyFailed = required.some((c) => c.status === "failed" || c.status === "warning");
  if (anyPassed && anyFailed) {
    return "자동 생성 기본 점검 일부를 확인했습니다. 실패 항목의 도움말을 확인해 주세요.";
  }
  return "자동 생성 기본 연결에 문제가 있습니다. GitHub 저장소/토큰/Cursor API 설정을 확인해 주세요.";
}
