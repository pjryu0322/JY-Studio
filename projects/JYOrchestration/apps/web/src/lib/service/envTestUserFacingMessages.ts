/**
 * 환경 연결 테스트(ENV_TEST 계열) 사용자·저장소(DB lastEvalSummary 등)에 노출되는 문구.
 * 내부 모듈/파일명의 stage1·stage2 표기는 구현 참조용으로 유지하고, 여기서만 제품 문구를 통일한다.
 */

/** PR 생성 단계 실패 시 `lastEvalSummary` 접두 — `parseStage1PrCreateFailureFields`와 동기 */
export const ENV_TEST_CONNECT_PR_FAIL_PREFIX = "환경 연결 테스트 PR 실패";
export const ENV_TEST_CONNECT_PR_FAIL_PREFIX_LEGACY = "ENV_TEST(Stage1) PR 실패";

export function lastEvalSummaryLooksLikeEnvTestPrFailure(summary: string | null | undefined): boolean {
  const s = String(summary ?? "").trim();
  return s.startsWith(ENV_TEST_CONNECT_PR_FAIL_PREFIX) || s.startsWith(ENV_TEST_CONNECT_PR_FAIL_PREFIX_LEGACY);
}

/** 역할 분리 검증(ENV_TEST_STAGE2) 실패 요약 접두 */
export const ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX = "환경 연결 테스트(역할 분리) 실패:";
export const ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX_LEGACY = "Stage 2 실패:";

export function lastEvalSummaryLooksLikeRoleSeparationEnvTestFailure(summary: string | null | undefined): boolean {
  const s = String(summary ?? "").trim();
  return s.startsWith(ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX) || s.startsWith(ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX_LEGACY);
}

export const ENV_TEST_CONNECT_PR_CREATE_FAILED_BASE =
  "환경 연결 테스트: 플랫폼이 GitHub PR을 생성·갱신하지 못했습니다.";

export function formatEnvTestPrSmokeFailureUserMessage(prPhaseMessage: string | undefined | null): string {
  const detail = String(prPhaseMessage ?? "").trim();
  if (!detail) return ENV_TEST_CONNECT_PR_CREATE_FAILED_BASE;
  return `${ENV_TEST_CONNECT_PR_CREATE_FAILED_BASE} — ${detail}`.slice(0, 4000);
}

export const ENV_TEST_COMMITTED_SUMMARY_PLATFORM_PR = "환경 연결 테스트: 플랫폼 PR 생성·머지 진행.";

export const ENV_TEST_BRANCH_NAME_UNKNOWN_SUMMARY =
  "환경 연결 테스트: 플랫폼이 부여한 브랜치 이름을 확인할 수 없습니다.";
export const ENV_TEST_BRANCH_NAME_UNKNOWN_MESSAGE = "환경 연결 테스트: 브랜치 이름을 확인할 수 없습니다.";

export const ENV_TEST_GITHUB_BRANCH_PR_TIMEOUT_MESSAGE =
  "환경 연결 테스트: GitHub 브랜치/PR 반영이 제한 시간 내에 확인되지 않았습니다.";

export const ENV_TEST_ROLE_SEPARATION_RUN_FAILED = "역할 분리 환경 검증 실행이 실패했습니다.";
export const ENV_TEST_ROLE_SEPARATION_RUN_OK = "역할 분리 환경 검증 실행이 완료되었습니다.";
export const ENV_TEST_ROLE_SEPARATION_CURSOR_STUCK =
  `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} Cursor가 시작되지 않았습니다(CREATING 지속).`;
export const ENV_TEST_ROLE_SEPARATION_BRANCH_NOT_REFLECTED =
  `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} Git branch 미반영`;
export const ENV_TEST_ROLE_SEPARATION_NO_COMMIT = `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} commit 미발생`;
export const ENV_TEST_ROLE_SEPARATION_NO_PR = `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} PR 미생성`;

export const ENV_TEST_MERGE_VERIFIED_LINE = "브랜치·PR·머지 확인 완료.";

/** GitHub PR 본문·태스크 표시용 — 저장소에 보이는 짧은 설명 */
export const ENV_TEST_PR_BODY_ROLE_SEP_LINE =
  "역할 분리 readiness PR — 플랫폼이 생성·갱신합니다.";

/** PR_OPENED 이후 reviewer/security/SCM 파이프라인이 호출자에게 돌려주는 실패 한 줄 */
export function formatEnvTestRoleSepReviewFailReturnMessage(reason: string): string {
  const r = String(reason ?? "").trim();
  if (!r) return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} 리뷰 거절`;
  return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} 리뷰 거절 — ${r}`.slice(0, 4000);
}

export function formatEnvTestRoleSepSecurityFailReturnMessage(reason: string): string {
  const r = String(reason ?? "").trim();
  if (!r) return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} 보안 검토 실패`;
  return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} 보안 검토 실패 — ${r}`.slice(0, 4000);
}

/** 진행 로그(운영자용) — SCM AI 멤버 없을 때 플랫폼이 merge·verify 담당 */
export const ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_PROGRESS_LOG =
  "SCM 담당 없음: 플랫폼이 merge·verify를 수행합니다.";

/** `lastEvalSummary` 등에 심는 짧은 진행 문구 */
export const ENV_TEST_ROLE_SEP_SCM_PLATFORM_FALLBACK_MERGE_PENDING_SUMMARY =
  "환경 연결 테스트(역할 분리): SCM 담당 AI가 없어 플랫폼이 직접 merge합니다.";

export const ENV_TEST_ROLE_SEP_SCM_MISSING_REPO_BRANCH_SUMMARY =
  `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} SCM 결정에 필요한 저장소·베이스·헤드 브랜치 정보가 부족합니다.`;

export function formatEnvTestRoleSepScmPreflightBlockedMessage(): string {
  return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} SCM 결정을 할 수 없습니다(저장소/브랜치 정보 부족).`.slice(
    0,
    4000
  );
}

export const ENV_TEST_ROLE_SEP_SCM_DECISION_MERGE_NOT_APPROVED_DEFAULT_SUMMARY =
  "SCM 담당이 merge를 승인하지 않았습니다.";

export function formatEnvTestRoleSepScmDecisionBlockedReturnMessage(summary: string): string {
  const s = String(summary ?? "").trim();
  const tail = s || "hold/reject";
  return `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} SCM 거절/보류 — ${tail}`.slice(0, 4000);
}

export const ENV_TEST_ROLE_SEP_SCM_APPROVED_MERGE_PENDING_SUMMARY =
  "환경 연결 테스트(역할 분리): SCM이 merge를 승인했습니다. 플랫폼 merge 진행.";

export const ENV_TEST_ROLE_SEP_EXECUTOR_NOT_READY_LAST_EVAL =
  `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} Executor(OpenAI) 준비 확인이 PASS가 아닙니다.`;

export const ENV_TEST_ROLE_SEP_EXECUTOR_ACK_FAIL_RETURN_MESSAGE =
  `${ENV_TEST_ROLE_SEPARATION_FAIL_PREFIX} Executor(OpenAI) ACK가 통과하지 못했습니다.`;

/** Cursor 폴링 실패 후 PR 스모크 복구 경로용 요약(내부 메타·로그) */
export function formatEnvTestCursorPollFailPrSmokeSummary(trackedBranchName: string, errSnippet: string): string {
  const b = String(trackedBranchName ?? "").trim();
  const e = String(errSnippet ?? "").trim().slice(0, 400);
  return `환경 연결 테스트: Cursor 폴링 실패(${e}); 브랜치 ${b}로 플랫폼 PR 스모크.`.slice(0, 2000);
}
