import {
  FAST_PLAN_DRAFT_PROPOSAL_INTERNAL_TYPE,
} from "@/lib/requirements/fastPlanDraftTypes";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function buildFastPlanDraftProposalMessage(input: {
  readonly content: string;
  readonly interviewSuggestions: readonly string[];
  readonly nowIso?: string;
}): RequirementsMessage {
  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content: input.content,
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: FAST_PLAN_DRAFT_PROPOSAL_INTERNAL_TYPE,
      interviewSuggestions: [...input.interviewSuggestions],
      interviewAllowCustomInput: true,
    },
  });
}
