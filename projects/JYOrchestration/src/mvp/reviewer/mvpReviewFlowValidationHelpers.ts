/**
 * MVP — compatibility barrel for `reviewer/helpers/flowReviewHelpers` + `flowValidationTypes`.
 *
 * **Target:** import from `./helpers/flowReviewHelpers` and `./flowValidationTypes` in new code.
 */

import {
  evaluateFlowValidationCore,
  isFlowValidationEnabled,
  parseFlowBlock,
  parseFlowBlockContentFromPrompt,
  parseSummaryTokens,
  validateEntryScreenRule as validateEntryScreenRuleTokens,
  validateNavigation as validateNavigationTokens,
  validateScreenIsolation,
} from "./helpers/flowReviewHelpers";
import type { FlowIssueCode } from "./flowValidationTypes";
import { resolveFlowValidationModeFromPrompt } from "./mvpReviewFlowValidationMode";

export type { FlowIssueCode as MvpFlowValidationIssueCode } from "./flowValidationTypes";
export { FLOW_ISSUE_MESSAGES as MVP_FLOW_VALIDATION_ISSUE_MESSAGE } from "./flowValidationTypes";

export type ParsedFlowContext = {
  hasFlowBlock: boolean;
  flowValidationEnabled: boolean;
  nextScreens: string[];
  isEntry: boolean;
};

export { parseFlowBlockContentFromPrompt };

export function hasFlowContextBlockInPrompt(prompt: string): boolean {
  return resolveFlowValidationModeFromPrompt(prompt).hasFlowContextBlock;
}

export function detectFlowValidationEnabledFromPrompt(prompt: string): boolean {
  return isFlowValidationEnabled(prompt);
}

export function parseFlowContextFromPrompt(prompt: string): ParsedFlowContext {
  const block = parseFlowBlock(prompt);
  return {
    hasFlowBlock: block.hasFlowBlock,
    flowValidationEnabled: isFlowValidationEnabled(prompt),
    nextScreens: block.nextScreens,
    isEntry: block.isEntry,
  };
}

export function parseResultSummary(result: unknown): string {
  return parseSummaryTokens(result).summary;
}

export function validateScreenIsolationToken(summary: string) {
  return validateScreenIsolation({ summary });
}

export function validateNavigationToken(summary: string, nextScreensCount: number) {
  return validateNavigationTokens({ summary, nextScreensCount });
}

export function validateEntryScreenRule(summary: string, isEntry: boolean) {
  return validateEntryScreenRuleTokens({ summary, isEntry });
}

export function evaluateFlowValidation(prompt: string, result: unknown): {
  enabled: boolean;
  issues: string[];
  issueCodes?: FlowIssueCode[];
} {
  return evaluateFlowValidationCore(prompt, result);
}
