/**
 * DB `taskKind` 및 ENV_TEST 실행 스코프 게이트용 문자열 단일 근원.
 * (nextTaskReadiness ↔ envTestExecutionHelpers 등 순환 import 방지)
 */
export const ENV_TEST_TASK_KIND = "ENV_TEST" as const;

/** Stage 1 스모크 이후: 리뷰·SCM 역할 분리 readiness (동일 Cursor/GitHub 경로, 머지 전 플랫폼 리뷰 단계 추가) */
export const ENV_TEST_STAGE2_TASK_KIND = "ENV_TEST_STAGE2" as const;

export function isEnvTestStage1TaskKind(taskKind: string | null | undefined): boolean {
  return String(taskKind ?? "").trim() === ENV_TEST_TASK_KIND;
}

export function isEnvTestStage2TaskKind(taskKind: string | null | undefined): boolean {
  return String(taskKind ?? "").trim() === ENV_TEST_STAGE2_TASK_KIND;
}

/** Cursor 단축 경로·GitHub compare·ENV_TEST PR 헬퍼 공통 스코프 */
export function isEnvTestFamilyTaskKind(taskKind: string | null | undefined): boolean {
  return isEnvTestStage1TaskKind(taskKind) || isEnvTestStage2TaskKind(taskKind);
}

/** 머지 가드·DB ENV 테스트 머지 스모크 허용 taskKind */
export function isEnvTestMergeFamilyTaskKind(taskKind: string | null | undefined): boolean {
  return isEnvTestFamilyTaskKind(taskKind);
}
