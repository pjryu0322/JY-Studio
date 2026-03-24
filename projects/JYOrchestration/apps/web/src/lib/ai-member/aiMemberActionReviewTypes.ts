export type AiMemberActionReviewStatusId =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_REVISION";

export type AiMemberActionApplyStatusId = "NOT_APPLIED" | "APPLIED" | "APPLY_FAILED";

export type AiMemberActionReviewDecisionId = "APPROVE" | "REJECT" | "REQUEST_REVISION";

const REVIEW_STATUSES: AiMemberActionReviewStatusId[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "NEEDS_REVISION",
];

const DECISIONS: AiMemberActionReviewDecisionId[] = ["APPROVE", "REJECT", "REQUEST_REVISION"];

export function parseAiMemberActionReviewDecision(v: unknown): AiMemberActionReviewDecisionId | null {
  if (typeof v !== "string") return null;
  return DECISIONS.includes(v as AiMemberActionReviewDecisionId) ? (v as AiMemberActionReviewDecisionId) : null;
}

export function parseAiMemberActionReviewStatus(v: unknown): AiMemberActionReviewStatusId | null {
  if (typeof v !== "string") return null;
  return REVIEW_STATUSES.includes(v as AiMemberActionReviewStatusId) ? (v as AiMemberActionReviewStatusId) : null;
}
