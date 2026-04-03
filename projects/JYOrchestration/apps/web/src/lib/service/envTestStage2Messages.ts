/**
 * ENV_TEST Stage 2 — 플랫폼·Executor·Reviewer·Security·SCM 간 최소 구조화 payload (자연어 채팅 없음).
 * Executor는 기존 Cursor 경로로 간주하며, Platform→(Reviewer/Security/SCM) 만 명시적 타입으로 둔다.
 */

export type EnvTestStage2Mode = "ENV_TEST_STAGE2";

export type PlatformToExecutorEnvTestStage2Payload = {
  type: "EXECUTE_ENV_TEST_STAGE2";
  summary: string;
  mode: EnvTestStage2Mode;
};

export type ExecutorToPlatformStatusPayload = {
  type: "EXECUTOR_STATUS";
  status: "STARTED" | "RUNNING";
};

export type PlatformToReviewerRequestPayload = {
  type: "REVIEW_REQUEST";
  mode: EnvTestStage2Mode;
  requestedIntent: string;
  allowedPaths: string[];
  changedFiles: string[];
  fileCount: number;
  diffSummary: string;
};

export type ReviewerToPlatformResultPayload = {
  type: "REVIEW_RESULT";
  result: "PASS" | "FAIL";
  reason: string;
};

export type PlatformToSecurityRequestPayload = {
  type: "SECURITY_REQUEST";
  mode: EnvTestStage2Mode;
  changedFiles: string[];
  diffSummary: string;
  fileCount: number;
};

export type SecurityToPlatformResultPayload = {
  type: "SECURITY_RESULT";
  result: "PASS" | "FAIL";
  reason: string;
};

export type PlatformToScmRequestPayload = {
  type: "SCM_REQUEST";
  mode: EnvTestStage2Mode;
  prNumber: number;
  prState: string;
  reviewResult: "PASS" | "FAIL";
  securityResult: "PASS" | "FAIL";
};

export type ScmToPlatformResultPayload = {
  type: "SCM_RESULT";
  result: "MERGED" | "BLOCKED" | "VERIFY_FAILED";
  reason: string;
};

/** TaskExecutionRun.validationOutput JSON 상단 키 */
export const ENV_TEST_STAGE2_RUN_META_KEY = "envTestStage2Meta" as const;

export type EnvTestStage2RunMetaJson = {
  [ENV_TEST_STAGE2_RUN_META_KEY]: {
    reviewRequest?: PlatformToReviewerRequestPayload;
    reviewResult?: ReviewerToPlatformResultPayload;
    securityRequest?: PlatformToSecurityRequestPayload;
    securityResult?: SecurityToPlatformResultPayload;
    scmRequest?: PlatformToScmRequestPayload;
    scmResult?: ScmToPlatformResultPayload;
  };
};
