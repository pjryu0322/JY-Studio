/**
 * ENV_TEST Stage 2: 플랫폼이 호출하는 Reviewer·SCM 액터(구조화 입출력만).
 * Reviewer/SCM은 서로·Executor와 직접 통신하지 않는다.
 */

import {
  ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD,
  ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD,
} from "@/lib/service/envTestMergeFilePolicy";
import {
  ENV_TEST_STAGE2_RUN_META_KEY,
  type PlatformToExecutorEnvTestStage2Payload,
  type PlatformToReviewerRequestPayload,
  type ReviewerToPlatformResultPayload,
  type PlatformToSecurityRequestPayload,
  type SecurityToPlatformResultPayload,
  type PlatformToScmRequestPayload,
  type ScmToPlatformResultPayload,
} from "@/lib/service/envTestStage2Messages";

const MAX_DIFF_SUMMARY_LEN = 8000;

export function buildPlatformToExecutorEnvTestStage2Stub(): {
  platformToExecutor: PlatformToExecutorEnvTestStage2Payload;
} {
  return {
    platformToExecutor: {
      type: "EXECUTE_ENV_TEST_STAGE2",
      summary: "허용 범위 내 최소 변경 생성 후 push",
      mode: "ENV_TEST_STAGE2",
    },
  };
}

export function buildEnvTestStage2ReviewRequest(input: {
  requestedIntent: string;
  changedFiles: string[];
  diffSummary: string;
}): PlatformToReviewerRequestPayload {
  return {
    type: "REVIEW_REQUEST",
    mode: "ENV_TEST_STAGE2",
    requestedIntent: input.requestedIntent.slice(0, 500),
    allowedPaths: [ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD, ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD],
    changedFiles: input.changedFiles.map((f) => String(f).trim()).filter(Boolean),
    fileCount: input.changedFiles.length,
    diffSummary: input.diffSummary.slice(0, MAX_DIFF_SUMMARY_LEN),
  };
}

export function buildEnvTestStage2SecurityRequest(input: {
  changedFiles: string[];
  diffSummary: string;
}): PlatformToSecurityRequestPayload {
  return {
    type: "SECURITY_REQUEST",
    mode: "ENV_TEST_STAGE2",
    changedFiles: input.changedFiles.map((f) => String(f).trim()).filter(Boolean),
    fileCount: input.changedFiles.length,
    diffSummary: input.diffSummary.slice(0, MAX_DIFF_SUMMARY_LEN),
  };
}

export function buildEnvTestStage2ScmRequest(input: {
  prNumber: number;
  prStateOpen: boolean;
  review: ReviewerToPlatformResultPayload;
  security: SecurityToPlatformResultPayload;
}): PlatformToScmRequestPayload {
  return {
    type: "SCM_REQUEST",
    mode: "ENV_TEST_STAGE2",
    prNumber: input.prNumber,
    prState: input.prStateOpen ? "OPEN" : "NOT_OPEN",
    reviewResult: input.review.result,
    securityResult: input.security.result,
  };
}

export type Stage2ScmDisplayOutcome = "PASS" | "BLOCKED" | "PLATFORM_FALLBACK" | "VERIFY_FAILED";

export function parseEnvTestStage2UiFromValidationOutput(validationOutput: string | null | undefined): {
  stage2ExecutorResult: "PASS" | "FAIL" | null;
  stage2FinalOutcome: "COMPLETED" | "PARTIAL" | "FAILED" | null;
  stage2ScmParticipant: "AI" | "PLATFORM" | null;
  stage2ScmDisplay: Stage2ScmDisplayOutcome | null;
  stage2ReviewerResult: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2ReviewerReason: string | null;
  stage2SecurityResult: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2SecurityReason: string | null;
  stage2ScmResult: "MERGED" | "BLOCKED" | "VERIFY_FAILED" | null;
  stage2ScmReason: string | null;
} {
  const roleOk = (v: unknown): v is "PASS" | "FAIL" | "MISSING" | "DISABLED" =>
    v === "PASS" || v === "FAIL" || v === "MISSING" || v === "DISABLED";

  const empty = {
    stage2ExecutorResult: null as "PASS" | "FAIL" | null,
    stage2FinalOutcome: null as "COMPLETED" | "PARTIAL" | "FAILED" | null,
    stage2ScmParticipant: null as "AI" | "PLATFORM" | null,
    stage2ScmDisplay: null as Stage2ScmDisplayOutcome | null,
    stage2ReviewerResult: null as "PASS" | "FAIL" | "MISSING" | "DISABLED" | null,
    stage2ReviewerReason: null as string | null,
    stage2SecurityResult: null as "PASS" | "FAIL" | "MISSING" | "DISABLED" | null,
    stage2SecurityReason: null as string | null,
    stage2ScmResult: null as "MERGED" | "BLOCKED" | "VERIFY_FAILED" | null,
    stage2ScmReason: null as string | null,
  };
  try {
    const j = JSON.parse(String(validationOutput ?? "")) as Record<string, unknown>;
    const meta = j[ENV_TEST_STAGE2_RUN_META_KEY] as Record<string, unknown> | undefined;
    if (!meta) return empty;
    const ex = meta.executorAck as { result?: string } | undefined;
    const sum = meta.stage2RunSummary as {
      executorResult?: string;
      finalOutcome?: string;
      scmParticipant?: string;
    } | undefined;
    const rr = meta.reviewResult as { result?: string; reason?: string } | undefined;
    const srq = meta.securityResult as { result?: string; reason?: string } | undefined;
    const sr = meta.scmResult as { result?: string; reason?: string } | undefined;
    const rOk = roleOk(rr?.result) ? rr.result : null;
    const secOk = roleOk(srq?.result) ? srq.result : null;
    const sOk =
      sr?.result === "MERGED" || sr?.result === "BLOCKED" || sr?.result === "VERIFY_FAILED" ? sr.result : null;
    const exOk = ex?.result === "PASS" || ex?.result === "FAIL" ? ex.result : null;
    const fin =
      sum?.finalOutcome === "COMPLETED" || sum?.finalOutcome === "PARTIAL" || sum?.finalOutcome === "FAILED"
        ? sum.finalOutcome
        : null;
    const part =
      sum?.scmParticipant === "AI" || sum?.scmParticipant === "PLATFORM" ? sum.scmParticipant : null;
    const exFromSum =
      sum?.executorResult === "PASS" || sum?.executorResult === "FAIL" ? sum.executorResult : null;
    let scmDisplay: Stage2ScmDisplayOutcome | null = null;
    if (sOk === "MERGED") {
      scmDisplay = part === "PLATFORM" ? "PLATFORM_FALLBACK" : "PASS";
    } else if (sOk === "BLOCKED") {
      scmDisplay = "BLOCKED";
    } else if (sOk === "VERIFY_FAILED") {
      scmDisplay = "VERIFY_FAILED";
    }
    return {
      stage2ExecutorResult: exOk ?? exFromSum,
      stage2FinalOutcome: fin,
      stage2ScmParticipant: part,
      stage2ScmDisplay: scmDisplay,
      stage2ReviewerResult: rOk,
      stage2ReviewerReason: typeof rr?.reason === "string" ? rr.reason.slice(0, 500) : null,
      stage2SecurityResult: secOk,
      stage2SecurityReason: typeof srq?.reason === "string" ? srq.reason.slice(0, 500) : null,
      stage2ScmResult: sOk,
      stage2ScmReason: typeof sr?.reason === "string" ? sr.reason.slice(0, 500) : null,
    };
  } catch {
    return empty;
  }
}

export function mergeEnvTestStage2RunValidationOutput(
  prev: string | null | undefined,
  patch: Record<string, unknown>
): string {
  let base: Record<string, unknown> = {};
  try {
    if (prev?.trim()) base = JSON.parse(prev) as Record<string, unknown>;
  } catch {
    base = {};
  }
  const cur = (base[ENV_TEST_STAGE2_RUN_META_KEY] as Record<string, unknown> | undefined) ?? {};
  const next = { ...cur, ...patch };
  base[ENV_TEST_STAGE2_RUN_META_KEY] = next;
  return JSON.stringify(base).slice(0, 24_000);
}

export function scmResultFromMergeOk(
  ok: boolean,
  blockedReason?: string,
  opts?: { platformScmFallback?: boolean }
): ScmToPlatformResultPayload {
  if (ok) {
    return {
      type: "SCM_RESULT",
      result: "MERGED",
      reason: opts?.platformScmFallback
        ? "scm_platform_fallback: SCM 미등록 — 플랫폼 merge·verify"
        : "리뷰·보안 단계 통과 후 merge·verify 성공",
    };
  }
  const r = String(blockedReason ?? "").toUpperCase();
  if (r.includes("VERIFY") || r.includes("MERGE_NOT_VERIFIED")) {
    return { type: "SCM_RESULT", result: "VERIFY_FAILED", reason: blockedReason?.slice(0, 200) ?? "verify 실패" };
  }
  return { type: "SCM_RESULT", result: "BLOCKED", reason: blockedReason?.slice(0, 200) ?? "머지 차단" };
}
