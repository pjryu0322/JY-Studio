/**
 * MVP — typed flow validation issues (**target** internal model).
 *
 * Outward `ReviewResult.flowValidation.issues` stays `string[]`; map at the boundary.
 */

export type FlowIssueCode =
  | "MISSING_SCREEN_ISOLATION_TOKEN"
  | "MISSING_NAVIGATION_TOKEN"
  | "ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN";

export type FlowValidationIssue = {
  code: FlowIssueCode;
  message: string;
};

export const FLOW_ISSUE_MESSAGES: Record<FlowIssueCode, string> = {
  MISSING_SCREEN_ISOLATION_TOKEN: "MISSING_SCREEN_ISOLATION_TOKEN: expected summary to include SCREEN_ONLY_OK",
  MISSING_NAVIGATION_TOKEN: "MISSING_NAVIGATION_TOKEN: expected summary to include NAV_OK when next screens exist",
  ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN: "ENTRY_SCREEN_PREV_TOKEN_FORBIDDEN: entry screen must not depend on prior UI",
} as const;

export function flowValidationIssueFromCode(code: FlowIssueCode): FlowValidationIssue {
  return { code, message: FLOW_ISSUE_MESSAGES[code] };
}

export function flowValidationIssuesToStrings(issues: readonly FlowValidationIssue[]): string[] {
  return issues.map((i) => i.message);
}
