import type { ReviewEngine } from "../ports/mvpPorts";

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
  flowValidation?: {
    isConsistent: boolean;
    issues: string[];
  };
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
/** Next review for this taskId returns FAILED with `retryable: false` once (non-retryable path). */
const forceNonRetryableReviewOnce = new Set<string>();

export function mvpConfigureReviewFailures(taskId: string, failuresBeforePass: number): void {
  failuresRemainingBeforePass.set(taskId, Math.max(0, failuresBeforePass));
}

/** Test hook: next `reviewTaskResult` for `taskId` fails with `retryable: false` (consumed once). */
export function mvpReviewForceNonRetryableOnce(taskId: string): void {
  forceNonRetryableReviewOnce.add(taskId);
}

export function mvpClearReviewPolicy(): void {
  failuresRemainingBeforePass.clear();
  forceNonRetryableReviewOnce.clear();
}

/** Human-readable MVP review rules (simulated, no LLM). */
export function describeReviewRules(): readonly string[] {
  return [
    "Optional per-task failure simulation via mvpConfigureReviewFailures.",
    "Optional one-shot non-retryable failure via mvpReviewForceNonRetryableOnce.",
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

function extractFlowContextFromPrompt(prompt: string): {
  hasFlowBlock: boolean;
  flowValidationEnabled: boolean;
  nextScreens: string[];
  hasPrevious: boolean;
  isEntry: boolean;
} {
  const hasFlowBlock = prompt.includes("### Flow context (preparation only)");
  const flowValidationEnabled = prompt.includes("Flow validation: ON");
  const isEntry = prompt.includes("This screen is an ENTRY screen.");
  const hasPrevious = prompt.includes("This screen comes AFTER:");
  const nextLine = prompt
    .split("\n")
    .find((l) => l.startsWith("Next screen(s):"));
  const nextScreens =
    nextLine && !nextLine.includes("(none)")
      ? nextLine
          .replace("Next screen(s):", "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  return { hasFlowBlock, flowValidationEnabled, nextScreens, hasPrevious, isEntry };
}

function extractResultSummary(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const s = r.summary;
  return typeof s === "string" ? s : "";
}

export async function reviewTaskResult(input: ReviewTaskInput): Promise<ReviewResult> {
  if (forceNonRetryableReviewOnce.has(input.taskId)) {
    forceNonRetryableReviewOnce.delete(input.taskId);
    return {
      status: "FAILED",
      reason: "mvp forced non-retryable review failure",
      retryable: false,
    };
  }

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

  const flow = extractFlowContextFromPrompt(input.prompt);
  if (flow.hasFlowBlock && flow.flowValidationEnabled) {
    const issues: string[] = [];
    const summary = extractResultSummary(input.result);

    // Screen isolation is not enforceable without real code inspection; use a soft contract token.
    if (!summary.includes("SCREEN_ONLY_OK")) {
      issues.push("MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK");
    }

    // Navigation continuity token when next screens exist.
    if (flow.nextScreens.length > 0 && !summary.includes("NAV_OK")) {
      issues.push("MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist");
    }

    // Entry screens should not claim previous continuity token.
    if (flow.isEntry && summary.includes("PREV_OK")) {
      issues.push("ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN: entry screen must not depend on prior UI");
    }

    if (issues.length > 0) {
      return {
        status: "FAILED",
        reason: `FLOW_VALIDATION_FAILED: ${issues.join(" | ")}`,
        retryable: true,
        flowValidation: { isConsistent: false, issues },
      };
    }

    // Pass through flowValidation success.
    if (hasExpectedStructure(input.result)) {
      return { status: "PASSED", retryable: false, flowValidation: { isConsistent: true, issues: [] } };
    }
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

export const mvpDefaultReviewEngine: ReviewEngine = {
  reviewTaskResult,
};
