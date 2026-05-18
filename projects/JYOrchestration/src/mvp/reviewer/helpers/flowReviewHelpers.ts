/**
 * MVP — **target** reviewer flow helpers (`reviewerService` uses these via `mvpReviewFlowValidationHelpers`).
 *
 * **Legacy compatibility:** when {@link resolveFlowValidationMode} is `OFF`, skip all strict checks.
 */

import type { FlowIssueCode, FlowValidationIssue } from "../flowValidationTypes";
import { flowValidationIssueFromCode, flowValidationIssuesToStrings } from "../flowValidationTypes";
import { resolveFlowValidationMode, resolveFlowValidationModeFromPrompt } from "../mvpReviewFlowValidationMode";

export type ParsedFlowBlock = {
  hasFlowBlock: boolean;
  nextScreens: string[];
  isEntry: boolean;
};

/** Next-screen line + entry flag only (no header / ON marker interpretation). */
export function parseFlowBlockContentFromPrompt(prompt: string): { nextScreens: string[]; isEntry: boolean } {
  const isEntry = prompt.includes("This screen is an ENTRY screen.");
  const nextLine = prompt.split("\n").find((l) => l.startsWith("Next screen(s):"));
  const nextScreens =
    nextLine && !nextLine.includes("(none)")
      ? nextLine
          .replace("Next screen(s):", "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  return { nextScreens, isEntry };
}

/** Parses flow-related lines from the prompt (next screens + entry flag) plus block presence from mode. */
export function parseFlowBlock(prompt: string): ParsedFlowBlock {
  const mode = resolveFlowValidationModeFromPrompt(prompt);
  const { nextScreens, isEntry } = parseFlowBlockContentFromPrompt(prompt);
  return { hasFlowBlock: mode.hasFlowContextBlock, nextScreens, isEntry };
}

export function isFlowValidationEnabled(prompt: string): boolean {
  return resolveFlowValidationModeFromPrompt(prompt).validationEnabled;
}

export type SummaryTokens = { summary: string };

export function parseSummaryTokens(result: unknown): SummaryTokens {
  if (!result || typeof result !== "object") return { summary: "" };
  const r = result as Record<string, unknown>;
  const s = r.summary;
  return { summary: typeof s === "string" ? s : "" };
}

export function validateScreenIsolation(tokens: SummaryTokens): FlowIssueCode | null {
  return tokens.summary.includes("SCREEN_ONLY_OK") ? null : "MISSING_SCREEN_ISOLATION_TOKEN";
}

export function validateNavigation(tokens: SummaryTokens & { nextScreensCount: number }): FlowIssueCode | null {
  if (tokens.nextScreensCount <= 0) return null;
  return tokens.summary.includes("NAV_OK") ? null : "MISSING_NAVIGATION_TOKEN";
}

export function validateEntryScreenRule(tokens: SummaryTokens & { isEntry: boolean }): FlowIssueCode | null {
  if (!tokens.isEntry) return null;
  return tokens.summary.includes("PREV_OK") ? "ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN" : null;
}

export function collectFlowValidationIssues(
  prompt: string,
  result: unknown
): { enabled: false } | { enabled: true; issues: FlowValidationIssue[] } {
  if (resolveFlowValidationMode(prompt) === "OFF") {
    return { enabled: false };
  }
  const block = parseFlowBlock(prompt);
  const { summary } = parseSummaryTokens(result);
  const typed: FlowValidationIssue[] = [];
  const iso = validateScreenIsolation({ summary });
  if (iso) typed.push(flowValidationIssueFromCode(iso));
  const nav = validateNavigation({ summary, nextScreensCount: block.nextScreens.length });
  if (nav) typed.push(flowValidationIssueFromCode(nav));
  const entry = validateEntryScreenRule({ summary, isEntry: block.isEntry });
  if (entry) typed.push(flowValidationIssueFromCode(entry));
  return { enabled: true, issues: typed };
}

export function evaluateFlowValidationCore(prompt: string, result: unknown): {
  enabled: boolean;
  issues: string[];
  issueCodes?: FlowIssueCode[];
} {
  const collected = collectFlowValidationIssues(prompt, result);
  if (!collected.enabled) {
    return { enabled: false, issues: [] };
  }
  const issueCodes = collected.issues.map((i) => i.code);
  const issues = flowValidationIssuesToStrings(collected.issues);
  return { enabled: true, issues, issueCodes };
}
