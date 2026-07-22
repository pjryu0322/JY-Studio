/**
 * Role workspace rail — shared step status model for Admin / Provider / Consumer.
 * UI chrome only; does not change auth or API contracts.
 */

export type RoleRailStepStatus =
  | "completed"
  | "current"
  | "next"
  | "blocked"
  | "warning"
  | "idle";

export type RoleWorkspaceRole = "admin" | "provider" | "consumer";

export type RoleRailItem = {
  id: string;
  label: string;
  status: RoleRailStepStatus;
  href?: string;
  blockedReason?: string;
  /** Optional short badge text (e.g. WARNING). */
  badge?: string;
};

export type NextActionTone = "ready" | "warning" | "blocked";

export type NextReviewActionKind =
  | "GO_SEARCH_VALIDATION"
  | "GO_FINAL_DECISION"
  | "RERUN_QUALITY"
  | "REGENERATE_KNOWLEDGE"
  | "REQUEST_PROVIDER_FIX"
  | "NONE";

export type NextReviewAction = {
  kind: NextReviewActionKind;
  primaryLabel: string;
  secondaryKind?: NextReviewActionKind;
  secondaryLabel?: string;
  message: string;
  tone: NextActionTone;
  blockedReasons?: string[];
};
