/**
 * Service-flow conversation UX state machine (proposal → review → approved → feature detail).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowConversationState = "PROPOSAL" | "REVIEW" | "APPROVED" | "FEATURE_DETAIL";

export type ServiceFlowReviewDepth = "summary" | "detailed" | "compact";

export type ServiceFlowQuickReplyProfile = "proposal" | "review" | "approved" | "feature_detail";

const VALID_STATES = new Set<ServiceFlowConversationState>([
  "PROPOSAL",
  "REVIEW",
  "APPROVED",
  "FEATURE_DETAIL",
]);

export const SERVICE_FLOW_QUICK_REPLIES_BY_PROFILE: Readonly<
  Record<ServiceFlowQuickReplyProfile, readonly string[]>
> = {
  proposal: ["추천안 적용", "일부 수정", "다른 대안 보기", "직접 입력", "보류"],
  review: ["흐름 확정", "단계 수정하기", "액터 추가하기", "흐름 상세 검토", "세부 기능 정리"],
  approved: ["다음 단계 진행", "세부 기능 정리", "화면 구성 보기"],
  feature_detail: ["기능 수정", "화면 정의", "API 정의", "문서 생성"],
};

export function quickReplyProfileForState(state: ServiceFlowConversationState): ServiceFlowQuickReplyProfile {
  switch (state) {
    case "REVIEW":
      return "review";
    case "APPROVED":
      return "approved";
    case "FEATURE_DETAIL":
      return "feature_detail";
    default:
      return "proposal";
  }
}

export function quickRepliesForConversationState(state: ServiceFlowConversationState): readonly string[] {
  return SERVICE_FLOW_QUICK_REPLIES_BY_PROFILE[quickReplyProfileForState(state)];
}

export function resolveServiceFlowConversationState(
  flow: RequirementsServiceFlowV1 | null | undefined,
): ServiceFlowConversationState {
  const stored = String(flow?.conversationState ?? "").trim() as ServiceFlowConversationState;
  if (stored && VALID_STATES.has(stored)) return stored;

  if (flow?.proposalAcceptedAt) return "APPROVED";
  if (flow?.acceptedProposalSnapshot && !flow?.proposalAcceptedAt) return "REVIEW";

  return "PROPOSAL";
}

export function withServiceFlowConversationState(
  flow: RequirementsServiceFlowV1,
  state: ServiceFlowConversationState,
  nowIso?: string,
): RequirementsServiceFlowV1 {
  const now = nowIso ?? new Date().toISOString();
  return {
    ...flow,
    updatedAt: now,
    conversationState: state,
  };
}

export function reviewDepthForDecision(input: {
  readonly decision: string | null;
  readonly conversationState: ServiceFlowConversationState;
}): ServiceFlowReviewDepth {
  if (input.decision === "REVIEW_FLOW") {
    return input.conversationState === "APPROVED" ? "compact" : "detailed";
  }
  if (input.conversationState === "APPROVED") return "compact";
  if (input.conversationState === "REVIEW") return "summary";
  return "summary";
}
