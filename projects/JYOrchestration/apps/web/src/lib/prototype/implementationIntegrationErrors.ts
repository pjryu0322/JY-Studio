import type { IntegrationPipelineStepKindV1 } from "@/lib/prototype/integrationPipelineRuntimeDiagnostic";

export type IntegrationPipelineErrorCode =
  | "integration_included_targets_empty"
  | "integration_source_missing"
  | "integration_plan_invalid"
  | "integration_final_wiring_pending"
  | "integration_precheck_blocked"
  | "integration_branch_creation_failed"
  | "integration_build_failed"
  | "integration_step_input_invalid"
  | "integration_runtime_error";

export class IntegrationPipelineDomainError extends Error {
  readonly code: IntegrationPipelineErrorCode;
  readonly detail?: Record<string, unknown>;

  constructor(
    code: IntegrationPipelineErrorCode,
    message?: string,
    detail?: Record<string, unknown>,
  ) {
    super(message?.trim() || USER_SAFE_BY_CODE[code]);
    this.name = "IntegrationPipelineDomainError";
    this.code = code;
    this.detail = detail;
  }
}

const CONTINUE_PREVIEW_USER_MESSAGE =
  "Preview 준비를 계속 진행해야 합니다.\n아래 버튼을 눌러 다음 단계를 실행해 주세요.";

export const INTEGRATION_BRANCH_REUSE_USER_MESSAGE =
  "기존 통합 branch를 이어서 사용해 Preview 준비를 계속합니다.";

export const INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE =
  "통합 branch 준비 중 문제가 발생했습니다.\n다시 시도해 주세요.";

const USER_SAFE_BY_CODE: Readonly<Record<IntegrationPipelineErrorCode, string>> = {
  integration_included_targets_empty: "통합 대상 CodeTask가 없습니다.",
  integration_source_missing:
    "최종 통합 기준 branch를 결정하지 못했습니다.\n다시 시도해 주세요.",
  integration_plan_invalid: "통합 계획 상태가 올바르지 않습니다. 다시 통합을 실행해 주세요.",
  integration_final_wiring_pending:
    "최종 연결/통합 Wiring이 완료되지 않아 실제 앱 Preview를 준비할 수 없습니다.",
  integration_precheck_blocked: "통합 사전점검이 차단되었습니다. 차단 사유를 확인하세요.",
  integration_branch_creation_failed: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
  integration_build_failed: "Build 검증을 완료하지 못했습니다.\n다시 시도해 주세요.",
  integration_step_input_invalid:
    "통합 준비 상태를 다시 계산해야 합니다. 다시 시도해 주세요.",
  integration_runtime_error: CONTINUE_PREVIEW_USER_MESSAGE,
};

function isRawRuntimeMessage(message: string): boolean {
  return (
    /Cannot read properties of undefined/i.test(message) ||
    /TypeError/i.test(message) ||
    /reading 'filter'/i.test(message) ||
    /reading 'map'/i.test(message)
  );
}

function isRawGithubHttpIntegrationBranchMessage(message: string): boolean {
  return (
    /integration branch 생성 실패 HTTP/i.test(message) ||
    (/Reference already exists/i.test(message) && /documentation_url/i.test(message))
  );
}

export function toIntegrationPipelineErrorCode(error: unknown): IntegrationPipelineErrorCode {
  if (error instanceof IntegrationPipelineDomainError) return error.code;
  const message = error instanceof Error ? error.message : String(error);
  if (isRawRuntimeMessage(message)) return "integration_runtime_error";
  return "integration_runtime_error";
}

export function userSafeMessageForIntegrationPipelineStepFailure(
  stepKind: IntegrationPipelineStepKindV1,
  error: unknown,
): string {
  if (error instanceof IntegrationPipelineDomainError) {
    return USER_SAFE_BY_CODE[error.code] ?? error.message;
  }
  switch (stepKind) {
    case "final_wiring":
    case "integration_branch":
      return USER_SAFE_BY_CODE.integration_branch_creation_failed;
    case "build":
      return USER_SAFE_BY_CODE.integration_build_failed;
    case "app_preview_target":
      return "실제 앱 Preview target을 준비하지 못했습니다.\nPreview 준비를 다시 실행해 주세요.";
    default:
      return USER_SAFE_BY_CODE.integration_runtime_error;
  }
}

export function toUserSafeIntegrationErrorMessage(error: unknown): string {
  if (error instanceof IntegrationPipelineDomainError) {
    return USER_SAFE_BY_CODE[error.code] ?? error.message;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (isRawRuntimeMessage(message)) {
    return USER_SAFE_BY_CODE.integration_runtime_error;
  }
  if (isRawGithubHttpIntegrationBranchMessage(message)) {
    return USER_SAFE_BY_CODE.integration_branch_creation_failed;
  }
  if (message.trim()) return message;
  return USER_SAFE_BY_CODE.integration_runtime_error;
}

export function buildIntegrationPipelineRuntimeErrorLogFields(error: unknown): Readonly<{
  readonly errorName: string;
  readonly errorMessage: string;
  readonly safeMessage: string;
  readonly errorCode: IntegrationPipelineErrorCode;
  readonly stack?: string;
}> {
  const errorName = error instanceof Error ? error.name : "Error";
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    errorName,
    errorMessage,
    safeMessage: toUserSafeIntegrationErrorMessage(error),
    errorCode: toIntegrationPipelineErrorCode(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  };
}
