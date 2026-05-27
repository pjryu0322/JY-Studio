import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsMessage } from "@/lib/requirements/requirementsStateJson";
import { getWorkspaceAiMember } from "@/lib/requirements/workspaceAiMembers";
import { displayedWorkspaceAiTitle } from "@/lib/requirements/userFacingOrchestrationText";

export function buildImplementationRouterAssistantReply(input: {
  readonly content: string;
  readonly interviewSuggestions?: readonly string[];
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const def = getWorkspaceAiMember("prototype_build");
  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: def.id,
    speakerName: displayedWorkspaceAiTitle(def),
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
