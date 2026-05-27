import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

const IMPLEMENTATION_AI_MEMBER_ID = "prototype_build" as const;

export function buildImplementationRouterAssistantReply(input: {
  readonly content: string;
  readonly interviewSuggestions?: readonly string[];
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: IMPLEMENTATION_AI_MEMBER_ID,
    speakerName: displayedWorkspaceAiTitle(IMPLEMENTATION_AI_MEMBER_ID),
    messageType: "NOTICE",
    content: input.content,
    createdAt: now,
    meta: {
      serviceDesignStage: "implementation",
      interviewSuggestions: input.interviewSuggestions,
      interviewAllowCustomInput: true,
    },
  });
}
