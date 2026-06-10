export type GitHubWorkflowDispatchFailureKindV1 =
  | "permission_denied"
  | "workflow_not_found"
  | "workflow_not_on_default_branch"
  | "workflow_dispatch_not_supported"
  | "workflow_disabled"
  | "invalid_dispatch_inputs"
  | "invalid_dispatch_ref"
  | "actions_disabled"
  | "rate_limited"
  | "github_unavailable"
  | "unknown";

export type GitHubWorkflowDispatchRemediationCodeV1 =
  | "none"
  | "enable_actions_permission"
  | "enable_workflow_permission"
  | "ensure_workflow_file"
  | "ensure_workflow_dispatch"
  | "fix_workflow_inputs"
  | "fix_dispatch_ref"
  | "enable_repository_actions"
  | "retry_later"
  | "operator_review_required";

export type GitHubWorkflowDispatchProbeResultV1 = Readonly<{
  readonly ok: boolean;
  readonly status: number | null;
  readonly failureKind: GitHubWorkflowDispatchFailureKindV1 | null;
  readonly userSafeMessage: string | null;
  readonly remediationCode: GitHubWorkflowDispatchRemediationCodeV1;
  readonly operatorMessage: string | null;
  readonly workflowPath?: string | null;
  readonly workflowId?: string | number | null;
  readonly dispatchRef?: string | null;
  readonly responseBodySummary?: string | null;
}>;

export function summarizeGithubResponseBodyForOperatorLog(body: unknown, maxLen = 500): string | null {
  const text =
    typeof body === "string"
      ? body
      : body && typeof body === "object"
        ? JSON.stringify(body)
        : "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const redacted = trimmed
    .replace(/ghp_[A-Za-z0-9_]+/g, "[token]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[token]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [token]");
  return redacted.length > maxLen ? `${redacted.slice(0, maxLen)}…` : redacted;
}

function isRateLimited(input: {
  readonly status: number | null;
  readonly responseBody?: unknown;
  readonly responseHeaders?: Record<string, string | null> | null;
}): boolean {
  if (input.status !== 403 && input.status !== 429) return false;
  const remaining = String(input.responseHeaders?.["x-ratelimit-remaining"] ?? "").trim();
  if (remaining === "0") return true;
  const body = summarizeGithubResponseBodyForOperatorLog(input.responseBody ?? "", 800)?.toLowerCase() ?? "";
  return body.includes("rate limit") || body.includes("secondary rate limit");
}

function classify422(bodySummary: string | null): GitHubWorkflowDispatchFailureKindV1 {
  const b = (bodySummary ?? "").toLowerCase();
  if (b.includes("workflow_dispatch") && (b.includes("not supported") || b.includes("does not support"))) {
    return "workflow_dispatch_not_supported";
  }
  if (b.includes("ref") || b.includes("branch") || b.includes("reference")) {
    return "invalid_dispatch_ref";
  }
  if (b.includes("input") || b.includes("required") || b.includes("unexpected")) {
    return "invalid_dispatch_inputs";
  }
  return "invalid_dispatch_inputs";
}

function remediationForFailureKind(
  kind: GitHubWorkflowDispatchFailureKindV1,
): GitHubWorkflowDispatchRemediationCodeV1 {
  switch (kind) {
    case "permission_denied":
      return "enable_actions_permission";
    case "workflow_not_found":
    case "workflow_not_on_default_branch":
      return "ensure_workflow_file";
    case "workflow_dispatch_not_supported":
      return "ensure_workflow_dispatch";
    case "invalid_dispatch_inputs":
      return "fix_workflow_inputs";
    case "invalid_dispatch_ref":
      return "fix_dispatch_ref";
    case "workflow_disabled":
    case "actions_disabled":
      return "enable_repository_actions";
    case "rate_limited":
    case "github_unavailable":
      return "retry_later";
    default:
      return "operator_review_required";
  }
}

export function userSafeMessageForWorkflowDispatchFailureKind(
  kind: GitHubWorkflowDispatchFailureKindV1,
): string {
  switch (kind) {
    case "permission_denied":
      return "GitHub Actions 실행 권한이 필요합니다.\nGitHub Token 권한에서 Actions와 Workflows를 Read/Write로 설정한 뒤 다시 통합 및 Preview 준비를 실행해 주세요.";
    case "workflow_not_found":
    case "workflow_not_on_default_branch":
      return "Preview 배포 workflow를 찾지 못했습니다.\nworkflow 파일이 기본 브랜치에 반영된 뒤 다시 실행해 주세요.";
    case "workflow_dispatch_not_supported":
      return "Preview 배포 workflow에 수동 실행 설정이 필요합니다.\nworkflow_dispatch 설정을 확인해 주세요.";
    case "invalid_dispatch_inputs":
      return "Preview 배포 workflow 실행 입력값을 확인해야 합니다.\n플랫폼이 workflow에 필요한 project_id/source_branch/pages_path 입력값을 전달하도록 수정이 필요합니다.";
    case "invalid_dispatch_ref":
      return "Preview 배포 workflow 실행 branch를 확인해야 합니다.\nworkflow 파일이 있는 기본 브랜치와 빌드 대상 integration branch가 분리되어야 합니다.";
    case "workflow_disabled":
      return "Preview 배포 workflow가 비활성화되어 있습니다.\nGitHub Actions 화면에서 workflow를 활성화해 주세요.";
    case "actions_disabled":
      return "GitHub Actions가 비활성화되어 있습니다.\n저장소 Settings → Actions에서 Actions 사용을 허용해 주세요.";
    case "rate_limited":
    case "github_unavailable":
      return "GitHub 응답이 일시적으로 불안정합니다.\n잠시 후 다시 통합 및 Preview 준비를 실행해 주세요.";
    default:
      return "Preview 배포 workflow 실행 조건을 확인해야 합니다.\n운영자 로그를 확인해 주세요.";
  }
}

export function classifyWorkflowDispatchFailure(input: {
  readonly status: number | null;
  readonly responseBody?: unknown;
  readonly responseHeaders?: Record<string, string | null> | null;
  readonly workflowPath?: string | null;
  readonly workflowId?: string | number | null;
  readonly dispatchRef?: string | null;
}): GitHubWorkflowDispatchProbeResultV1 {
  const responseBodySummary = summarizeGithubResponseBodyForOperatorLog(input.responseBody ?? "");
  const base = {
    workflowPath: input.workflowPath ?? null,
    workflowId: input.workflowId ?? null,
    dispatchRef: input.dispatchRef ?? null,
    responseBodySummary,
  };

  const status = input.status;
  if (status === 204 || status === 201) {
    return {
      ok: true,
      status,
      failureKind: null,
      userSafeMessage: null,
      remediationCode: "none",
      operatorMessage: null,
      ...base,
    };
  }

  if (status === 401 || status === 403) {
    if (isRateLimited(input)) {
      const kind: GitHubWorkflowDispatchFailureKindV1 = "rate_limited";
      return {
        ok: false,
        status,
        failureKind: kind,
        userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
        remediationCode: remediationForFailureKind(kind),
        operatorMessage: `workflow_dispatch HTTP ${status} rate_limited`,
        ...base,
      };
    }
    const kind: GitHubWorkflowDispatchFailureKindV1 = "permission_denied";
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
      remediationCode: remediationForFailureKind(kind),
      operatorMessage: `workflow_dispatch HTTP ${status}`,
      ...base,
    };
  }

  if (status === 404) {
    const kind: GitHubWorkflowDispatchFailureKindV1 = "workflow_not_found";
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
      remediationCode: remediationForFailureKind(kind),
      operatorMessage: "workflow_dispatch HTTP 404",
      ...base,
    };
  }

  if (status === 422) {
    const kind = classify422(responseBodySummary);
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
      remediationCode: remediationForFailureKind(kind),
      operatorMessage: `workflow_dispatch HTTP 422 ${kind}`,
      ...base,
    };
  }

  if (status === 400) {
    const kind: GitHubWorkflowDispatchFailureKindV1 = "invalid_dispatch_inputs";
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage:
        "Preview 배포 workflow 실행 요청 형식을 확인해야 합니다.",
      remediationCode: "fix_workflow_inputs",
      operatorMessage: "workflow_dispatch HTTP 400",
      ...base,
    };
  }

  if (status === 409) {
    const kind: GitHubWorkflowDispatchFailureKindV1 = "workflow_disabled";
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
      remediationCode: remediationForFailureKind(kind),
      operatorMessage: "workflow_dispatch HTTP 409",
      ...base,
    };
  }

  if (status != null && status >= 500) {
    const kind: GitHubWorkflowDispatchFailureKindV1 = "github_unavailable";
    return {
      ok: false,
      status,
      failureKind: kind,
      userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
      remediationCode: remediationForFailureKind(kind),
      operatorMessage: `workflow_dispatch HTTP ${status}`,
      ...base,
    };
  }

  const kind: GitHubWorkflowDispatchFailureKindV1 = "unknown";
  return {
    ok: false,
    status,
    failureKind: kind,
    userSafeMessage: userSafeMessageForWorkflowDispatchFailureKind(kind),
    remediationCode: remediationForFailureKind(kind),
    operatorMessage: status != null ? `workflow_dispatch HTTP ${status}` : "workflow_dispatch failed",
    ...base,
  };
}

export function mapWorkflowDispatchFailureKindToIntegrationPipelineStatus(
  kind: GitHubWorkflowDispatchFailureKindV1,
): string {
  switch (kind) {
    case "permission_denied":
      return "github_preview_permission_required";
    case "workflow_not_found":
    case "workflow_not_on_default_branch":
    case "workflow_dispatch_not_supported":
      return "github_preview_workflow_setup_required";
    case "invalid_dispatch_inputs":
    case "invalid_dispatch_ref":
      return "github_preview_workflow_request_invalid";
    case "workflow_disabled":
    case "actions_disabled":
      return "github_actions_setup_required";
    case "rate_limited":
    case "github_unavailable":
      return "github_preview_retry_required";
    default:
      return "github_preview_operator_review_required";
  }
}

export function mapWorkflowDispatchRemediationToIntegrationPipelineStatus(
  remediationCode: GitHubWorkflowDispatchRemediationCodeV1,
): string {
  switch (remediationCode) {
    case "enable_actions_permission":
      return "github_preview_permission_required";
    case "ensure_workflow_file":
    case "ensure_workflow_dispatch":
    case "enable_workflow_permission":
      return "github_preview_workflow_setup_required";
    case "fix_workflow_inputs":
    case "fix_dispatch_ref":
      return "github_preview_workflow_request_invalid";
    case "enable_repository_actions":
      return "github_actions_setup_required";
    case "retry_later":
      return "github_preview_retry_required";
    case "operator_review_required":
      return "github_preview_operator_review_required";
    default:
      return "github_preview_operator_review_required";
  }
}
