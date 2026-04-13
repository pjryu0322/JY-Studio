/**
 * MVP — simulated prompt vs result validation for executionService (no LLM, in-memory).
 *
 * Contract:
 * - `reviewTaskResult({ taskId, prompt, result })` returns `{ status, reason?, retryable }`.
 * - Validation is deterministic mock logic only (no external LLM, no DB).
 */

export type ReviewResult = {
  status: "PASSED" | "FAILED";
  reason?: string;
  retryable: boolean;
};

export type ReviewTaskInput = {
  taskId: string;
  prompt: string;
  result: unknown;
};

export interface ValidationInput {
  promptText: string;
  changedFiles: string[];
  summary?: string | null;
}

export interface ValidationOutcome {
  ok: boolean;
  findings: string[];
}

export type RetryDecision = "retry" | "stop" | "escalate";

export interface RetryDecisionInput {
  validation: ValidationOutcome;
  attempt: number;
  maxAttempts: number;
}

/** Optional test hook: force N failing reviews before pass (per taskId). */
const failuresRemainingBeforePass = new Map<string, number>();

export function mvpConfigureReviewFailures(taskId: string, failuresBeforePass: number): void {
  failuresRemainingBeforePass.set(taskId, Math.max(0, failuresBeforePass));
}

export function mvpClearReviewPolicy(): void {
  failuresRemainingBeforePass.clear();
}

/** Human-readable MVP review rules (simulated, no LLM). */
export function describeReviewRules(): readonly string[] {
  return [
    "Optional per-task failure simulation via mvpConfigureReviewFailures.",
    "Empty prompt → FAILED (retryable).",
    "Empty result payload → FAILED (retryable).",
    "Pass if result.mvpPass === true OR result.changedFiles is a non-empty array.",
    "Otherwise → FAILED (retryable).",
  ] as const;
}

function isEmptyResult(result: unknown): boolean {
  if (result === null || result === undefined) {
    return true;
  }
  if (typeof result === "string") {
    return result.trim().length === 0;
  }
  if (Array.isArray(result)) {
    return result.length === 0;
  }
  if (typeof result === "object") {
    return Object.keys(result as object).length === 0;
  }
  return false;
}

function hasExpectedStructure(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }
  const r = result as Record<string, unknown>;
  if (r.mvpPass === true) {
    return true;
  }
  if (Array.isArray(r.changedFiles) && r.changedFiles.length > 0) {
    return true;
  }
  return false;
}

export async function reviewTaskResult(input: ReviewTaskInput): Promise<ReviewResult> {
  const forced = failuresRemainingBeforePass.get(input.taskId) ?? 0;
  if (forced > 0) {
    failuresRemainingBeforePass.set(input.taskId, forced - 1);
    return {
      status: "FAILED",
      reason: "mvp configured review failure",
      retryable: true,
    };
  }

  if (!input.prompt || input.prompt.trim().length === 0) {
    return {
      status: "FAILED",
      reason: "empty prompt",
      retryable: true,
    };
  }

  if (isEmptyResult(input.result)) {
    return {
      status: "FAILED",
      reason: "empty execution result",
      retryable: true,
    };
  }

  if (hasExpectedStructure(input.result)) {
    return { status: "PASSED", retryable: false };
  }

  return {
    status: "FAILED",
    reason: "result missing expected structure (e.g. non-empty changedFiles)",
    retryable: true,
  };
}

export async function validateAgainstPrompt(_input: ValidationInput): Promise<ValidationOutcome> {
  void _input;
  return {
    ok: false,
    findings: ["NOT_IMPLEMENTED_IN_MVP: validateAgainstPrompt (use reviewTaskResult in executionService)"],
  };
}

export async function decideRetry(_input: RetryDecisionInput): Promise<RetryDecision> {
  void _input;
  return "stop";
}
