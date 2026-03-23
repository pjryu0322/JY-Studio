import { FAILURE_TYPES, type FailureType } from "@/lib/execution/failureTypes";

export type FailureClassificationResult = {
  type: FailureType;
  confidence: number;
};

const PATTERNS: Record<FailureType, string[]> = {
  [FAILURE_TYPES.CURSOR_EXECUTION_FAILED]: [
    "cursor_execution_failed",
    "cursor error",
    "executor failed",
    "cursor execution failed",
  ],
  [FAILURE_TYPES.GIT_CONFLICT]: [
    "conflict",
    "merge conflict",
    "automatic merge failed",
    "fatal: merge conflict",
  ],
  [FAILURE_TYPES.GIT_APPLY_FAILED]: [
    "git apply failed",
    "patch failed",
    "cannot apply",
    "error: patch failed",
  ],
  [FAILURE_TYPES.PR_CREATION_FAILED]: [
    "pull request failed",
    "failed to create pr",
    "github pr error",
    "failed to create pull request",
  ],
  [FAILURE_TYPES.AUTH_ERROR]: [
    "403",
    "unauthorized",
    "permission denied",
    "forbidden",
  ],
  [FAILURE_TYPES.NETWORK_ERROR]: [
    "timeout",
    "network error",
    "connection refused",
    "fetch failed",
    "network",
  ],
  [FAILURE_TYPES.UNKNOWN]: [],
};

function normalizeText(input: { stage: string; message?: string | null; detailJson?: unknown }) {
  return `${input.message || ""} ${JSON.stringify(input.detailJson ?? {})} ${input.stage}`.toLowerCase();
}

function matchAny(text: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (p && text.includes(p)) {
      return true;
    }
  }
  return false;
}

function classifyByStage(stageRaw: string, text: string): FailureClassificationResult | null {
  const stage = String(stageRaw ?? "").toUpperCase();

  // stage 기반 fallback은 "문자열 패턴이 애매하거나 누락된" 경우를 위한 보정이다.
  if (stage === "PR" && text.includes("failed")) {
    return { type: FAILURE_TYPES.PR_CREATION_FAILED, confidence: 0.6 };
  }
  if (stage === "APPLY" && text.includes("failed")) {
    return { type: FAILURE_TYPES.GIT_APPLY_FAILED, confidence: 0.6 };
  }
  if (stage === "EXECUTE" && text.includes("cursor")) {
    return {
      type: FAILURE_TYPES.CURSOR_EXECUTION_FAILED,
      confidence: 0.6,
    };
  }

  return null;
}

export function classifyFailure(input: {
  stage: string;
  message?: string | null;
  detailJson?: unknown;
}): FailureClassificationResult {
  const text = normalizeText(input);

  // 1) 패턴 기반 우선 매칭 (confidence: 0.8)
  // 우선순위는 "더 구체적인 실패"가 먼저 잡히도록 배열 순서로 결정한다.
  const priority: FailureType[] = [
    FAILURE_TYPES.AUTH_ERROR,
    FAILURE_TYPES.NETWORK_ERROR,
    FAILURE_TYPES.CURSOR_EXECUTION_FAILED,
    FAILURE_TYPES.GIT_CONFLICT,
    FAILURE_TYPES.GIT_APPLY_FAILED,
    FAILURE_TYPES.PR_CREATION_FAILED,
  ];

  for (const type of priority) {
    const patterns = PATTERNS[type];
    if (patterns.length > 0 && matchAny(text, patterns)) {
      return { type, confidence: 0.8 };
    }
  }

  // 2) stage fallback (confidence: 0.6)
  const byStage = classifyByStage(input.stage, text);
  if (byStage) {
    return byStage;
  }

  // 3) fallback unknown (confidence: 0.2)
  return { type: FAILURE_TYPES.UNKNOWN, confidence: 0.2 };
}

