/**
 * Typed post-seed verification issue codes for the execution bridge.
 * String values are stable, explicit mismatch/drift semantics (internal contract).
 */

export const MVP_SEED_VERIFICATION_ISSUE_CODES = {
  MENU_COUNT_MISMATCH: "MENU_COUNT_MISMATCH",
  SYNTHETIC_MENU_ID_MISMATCH: "SYNTHETIC_MENU_ID_MISMATCH",
  MENU_PROJECT_ID_MISMATCH: "MENU_PROJECT_ID_MISMATCH",
  SCREEN_COUNT_MISMATCH: "SCREEN_COUNT_MISMATCH",
  SCREEN_ORDER_ID_MISMATCH: "SCREEN_ORDER_ID_MISMATCH",
  SCREEN_PROJECT_ID_MISMATCH: "SCREEN_PROJECT_ID_MISMATCH",
  SCREEN_MENU_REF_MISMATCH: "SCREEN_MENU_REF_MISMATCH",
  SCREEN_MISSING: "SCREEN_MISSING",
  SCREEN_UNEXPECTED: "SCREEN_UNEXPECTED",
  TASK_COUNT_MISMATCH: "TASK_COUNT_MISMATCH",
  TASK_PROJECT_ID_MISMATCH: "TASK_PROJECT_ID_MISMATCH",
  TASK_SCREEN_REF_INVALID: "TASK_SCREEN_REF_INVALID",
  TASK_ORDER_MISMATCH: "TASK_ORDER_MISMATCH",
  TASK_MISSING: "TASK_MISSING",
  TASK_UNEXPECTED: "TASK_UNEXPECTED",
  TASK_FINAL_ORDER_NOT_DENSE: "TASK_FINAL_ORDER_NOT_DENSE",
} as const;

export type MvpSeedVerificationIssueCode =
  (typeof MVP_SEED_VERIFICATION_ISSUE_CODES)[keyof typeof MVP_SEED_VERIFICATION_ISSUE_CODES];

export type MvpSeedVerificationIssue = {
  readonly code: MvpSeedVerificationIssueCode;
  readonly detail?: string;
};

export function mvpSeedVerificationIssue(
  code: MvpSeedVerificationIssueCode,
  detail?: string
): MvpSeedVerificationIssue {
  return detail !== undefined ? { code, detail } : { code };
}

/** Aggregates issues for `Error` messages (code + optional detail); stable joiner. */
export function formatMvpSeedVerificationIssuesForError(issues: readonly MvpSeedVerificationIssue[]): string {
  return issues.map((i) => i.code + (i.detail ? `(${i.detail})` : "")).join("; ");
}

const ALL_CODES: readonly string[] = Object.values(MVP_SEED_VERIFICATION_ISSUE_CODES);

export function isMvpSeedVerificationIssueCode(value: string): value is MvpSeedVerificationIssueCode {
  return (ALL_CODES as readonly string[]).includes(value);
}
