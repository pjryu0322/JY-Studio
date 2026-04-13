/**
 * MVP — extracted flow validation helpers for reviewerService.
 * Must preserve existing gated behavior and issue strings.
 */

import { MVP_FLOW_CONTEXT_BLOCK_HEADER, MVP_FLOW_VALIDATION_ON_MARKER } from "./mvpReviewFlowValidationMode";

export type ParsedFlowContext = {
  hasFlowBlock: boolean;
  flowValidationEnabled: boolean;
  nextScreens: string[];
  isEntry: boolean;
};

export function parseFlowContextFromPrompt(prompt: string): ParsedFlowContext {
  const hasFlowBlock = prompt.includes(MVP_FLOW_CONTEXT_BLOCK_HEADER);
  const flowValidationEnabled = prompt.includes(MVP_FLOW_VALIDATION_ON_MARKER);
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
  return { hasFlowBlock, flowValidationEnabled, nextScreens, isEntry };
}

export function parseResultSummary(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  const s = r.summary;
  return typeof s === "string" ? s : "";
}

export function validateScreenIsolationToken(summary: string): string | null {
  return summary.includes("SCREEN_ONLY_OK")
    ? null
    : "MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK";
}

export function validateNavigationToken(summary: string, nextScreensCount: number): string | null {
  if (nextScreensCount <= 0) return null;
  return summary.includes("NAV_OK")
    ? null
    : "MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist";
}

export function validateEntryScreenRule(summary: string, isEntry: boolean): string | null {
  if (!isEntry) return null;
  return summary.includes("PREV_OK")
    ? "ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN: entry screen must not depend on prior UI"
    : null;
}

export function evaluateFlowValidation(prompt: string, result: unknown): { enabled: boolean; issues: string[] } {
  const flow = parseFlowContextFromPrompt(prompt);
  if (!(flow.hasFlowBlock && flow.flowValidationEnabled)) {
    return { enabled: false, issues: [] };
  }
  const summary = parseResultSummary(result);
  const issues: string[] = [];
  const iso = validateScreenIsolationToken(summary);
  if (iso) issues.push(iso);
  const nav = validateNavigationToken(summary, flow.nextScreens.length);
  if (nav) issues.push(nav);
  const entry = validateEntryScreenRule(summary, flow.isEntry);
  if (entry) issues.push(entry);
  return { enabled: true, issues };
}

