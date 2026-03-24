/** Prisma `AiMemberActionType`과 동기화 */
export const AI_MEMBER_ACTION_TYPES = [
  "REVIEW_REQUEST",
  "TASK_DRAFT_REQUEST",
  "QA_CHECK_REQUEST",
  "SUMMARY_REQUEST",
] as const;

export type AiMemberActionTypeId = (typeof AI_MEMBER_ACTION_TYPES)[number];

/** Prisma `AiMemberActionStatus`와 동기화 */
export const AI_MEMBER_ACTION_STATUSES = [
  "REQUESTED",
  "IN_PROGRESS",
  "DONE",
  "FAILED",
  "CANCELED",
] as const;

export type AiMemberActionStatusId = (typeof AI_MEMBER_ACTION_STATUSES)[number];

/** Prisma `AiMemberActionExecutionMode`와 동기화 */
export const AI_MEMBER_ACTION_EXECUTION_MODES = [
  "STUB",
  "MANUAL_AGENT",
  "OPENAI",
  "INTERNAL_AGENT",
] as const;

export type AiMemberActionExecutionModeId = (typeof AI_MEMBER_ACTION_EXECUTION_MODES)[number];

export function parseAiMemberActionType(raw: unknown): AiMemberActionTypeId | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return (AI_MEMBER_ACTION_TYPES as readonly string[]).includes(s)
    ? (s as AiMemberActionTypeId)
    : null;
}

export function parseAiMemberActionStatus(raw: unknown): AiMemberActionStatusId | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return (AI_MEMBER_ACTION_STATUSES as readonly string[]).includes(s)
    ? (s as AiMemberActionStatusId)
    : null;
}

export function parseAiMemberActionExecutionMode(raw: unknown): AiMemberActionExecutionModeId | null {
  let s = String(raw ?? "").trim().toUpperCase();
  if (s === "FUTURE_OPENAI") {
    s = "OPENAI";
  }
  return (AI_MEMBER_ACTION_EXECUTION_MODES as readonly string[]).includes(s)
    ? (s as AiMemberActionExecutionModeId)
    : null;
}
