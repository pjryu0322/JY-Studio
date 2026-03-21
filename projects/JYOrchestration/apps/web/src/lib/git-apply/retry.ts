/**
 * git-apply self-healing / 재시도 정책 (외부 서비스 호출 없음).
 */

/** 재시도 가능 횟수 상한: retryCount가 이 값 미만일 때만 재시도 허용 */
export const MAX_GIT_APPLY_RETRY_COUNT = 2;

export type GitApplyRetryRecord = {
  status: string;
  applyStatus: string | null;
  retryCount: number;
};

export type RetryPlan = {
  /** DB에 반영된 뒤의 retryCount (1 또는 2) */
  retryCountAfterIncrement: number;
  /** 실행용 commitMessage 접미사 */
  commitMessageSuffix: string;
  /** applyLog 구간 태그 */
  logTag: "[RETRY_1]" | "[RETRY_2]";
};

export function shouldRetryGitApply(record: GitApplyRetryRecord): boolean {
  return (
    record.status === "REQUESTED" &&
    record.applyStatus === "FAILED" &&
    record.retryCount < MAX_GIT_APPLY_RETRY_COUNT
  );
}

/**
 * 재시도 직전(또는 직후) retryCount 기준으로 플랜 생성.
 * `nextRetryCount`는 증가 후 값(1..2).
 */
export function buildRetryPlan(nextRetryCount: number): RetryPlan | null {
  if (nextRetryCount < 1 || nextRetryCount > MAX_GIT_APPLY_RETRY_COUNT) {
    return null;
  }
  const logTag =
    nextRetryCount === 1 ? "[RETRY_1]" : ("[RETRY_2]" as const);
  return {
    retryCountAfterIncrement: nextRetryCount,
    commitMessageSuffix: `[RETRY-${nextRetryCount}]`,
    logTag,
  };
}

export type RetryApplyLogInput = {
  tag: "[RETRY_1]" | "[RETRY_2]";
  retryCountAfterIncrement: number;
  lastRetryAt: Date;
  previousApplyLog: string | null;
  previousLastError: string | null;
};

/** 재시도 시작 시 applyLog 상단에 붙는 구간 */
export function buildRetryApplyLogSection(input: RetryApplyLogInput): string {
  return [
    input.tag,
    `retryCount=${input.retryCountAfterIncrement}`,
    `lastRetryAt=${input.lastRetryAt.toISOString()}`,
    input.previousLastError
      ? `previousLastError=${input.previousLastError}`
      : "previousLastError=(none)",
    "---",
    "previousApplyLog:",
    input.previousApplyLog?.trim() ? input.previousApplyLog.trim() : "(empty)",
    "---",
  ].join("\n");
}

export function mergeRetryPrefixWithBody(
  retryPrefix: string | null,
  body: string
): string {
  if (!retryPrefix) return body;
  return `${retryPrefix}\n${body}`;
}

/** 성공 시 applyLog 하단에 재시도 메타 */
export function appendSelfHealingSuccessFooter(
  applyLog: string,
  retryCount: number
): string {
  if (retryCount <= 0) return applyLog;
  return `${applyLog}\n[SELF_HEALING] apply completed; retryCount=${retryCount}`;
}

/**
 * 클라이언트/상위 계층용 힌트: 재시도 시 simulateFailure는 기본 false로 두면 스텁 성공 가능.
 */
export function getNextRetryPayload(record: GitApplyRetryRecord): {
  options: { simulateFailure: boolean };
  retryEligible: boolean;
} {
  return {
    options: { simulateFailure: false },
    retryEligible: shouldRetryGitApply(record),
  };
}
