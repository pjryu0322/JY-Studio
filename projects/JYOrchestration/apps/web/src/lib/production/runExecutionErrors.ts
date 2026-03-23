/** Task 실행 가드: 동시/중복 실행 시 API에서 409로 매핑 */
export class RunExecutionConflictError extends Error {
  readonly httpStatus = 409;
  readonly errorCode = "RUN_ALREADY_PENDING";

  constructor(
    message = "이 Task에 실행이 이미 진행 중입니다. 완료 후 다시 시도해 주세요."
  ) {
    super(message);
    this.name = "RunExecutionConflictError";
  }
}

export function isRunExecutionConflictError(
  e: unknown
): e is RunExecutionConflictError {
  return e instanceof RunExecutionConflictError;
}
