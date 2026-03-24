import type { ProjectRole } from "@/lib/auth/roles";
import type { AiMemberActionTypeId } from "@/lib/ai-member/aiMemberActionTypes";

/**
 * 액션 타입별 검토·승인 권한.
 * - REVIEW_REQUEST: OWNER, REVIEWER
 * - 그 외(TASK_DRAFT, QA, SUMMARY): OWNER, EDITOR
 */
export function roleCanReviewAiMemberAction(
  role: ProjectRole | null | undefined,
  actionType: AiMemberActionTypeId
): boolean {
  if (!role || role === "VIEWER") return false;
  if (role === "OWNER") return true;
  if (actionType === "REVIEW_REQUEST") {
    return role === "REVIEWER";
  }
  return role === "EDITOR";
}

/** 승인된 결과 적용 권한은 검토 권한과 동일하게 둔다. */
export function roleCanApplyApprovedAiMemberAction(
  role: ProjectRole | null | undefined,
  actionType: AiMemberActionTypeId
): boolean {
  return roleCanReviewAiMemberAction(role, actionType);
}
