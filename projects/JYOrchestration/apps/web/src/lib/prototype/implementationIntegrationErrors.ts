export type IntegrationPipelineErrorCode =
  | "integration_included_targets_empty"
  | "integration_source_missing"
  | "integration_plan_invalid"
  | "integration_final_wiring_pending"
  | "integration_precheck_blocked"
  | "integration_branch_creation_failed"
  | "integration_build_failed"
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

const USER_SAFE_BY_CODE: Readonly<Record<IntegrationPipelineErrorCode, string>> = {
  integration_included_targets_empty: "통합 대상 CodeTask가 없습니다.",
  integration_source_missing:
    "최종 통합 기준 branch를 결정하지 못했습니다.\n다시 시도해 주세요.",
  integration_plan_invalid: "통합 계획 상태가 올바르지 않습니다. 다시 통합을 실행해 주세요.",
  integration_final_wiring_pending:
    "최종 연결/통합 Wiring이 완료되지 않아 실제 앱 Preview를 준비할 수 없습니다.",
  integration_precheck_blocked: "통합 사전점검이 차단되었습니다. 차단 사유를 확인하세요.",
  integration_branch_creation_failed: "통합 branch 생성에 실패했습니다.",
  integration_build_failed: "통합 branch 검증에 실패했습니다.",
  integration_runtime_error:
    "통합 준비 중 내부 상태가 불완전합니다. 실행 로그를 확인한 뒤 다시 시도하세요.",
};

function isRawRuntimeMessage(message: string): boolean {
  return (
    /Cannot read properties of undefined/i.test(message) ||
    /TypeError/i.test(message) ||
    /reading 'filter'/i.test(message) ||
    /reading 'map'/i.test(message)
  );
}

export function toIntegrationPipelineErrorCode(error: unknown): IntegrationPipelineErrorCode {
  if (error instanceof IntegrationPipelineDomainError) return error.code;
  const message = error instanceof Error ? error.message : String(error);
  if (isRawRuntimeMessage(message)) return "integration_runtime_error";
  return "integration_runtime_error";
}

export function toUserSafeIntegrationErrorMessage(error: unknown): string {
  if (error instanceof IntegrationPipelineDomainError) {
    return USER_SAFE_BY_CODE[error.code] ?? error.message;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (isRawRuntimeMessage(message)) {
    return USER_SAFE_BY_CODE.integration_runtime_error;
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
