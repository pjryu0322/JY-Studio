import type { ImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const IMPLEMENTATION_CHAT_AVAILABILITY_BLOCKED_INTERNAL_TYPE =
  "IMPLEMENTATION_CHAT_AVAILABILITY_BLOCKED_V1" as const;

export function buildImplementationChatAvailabilityBlockedMessage(
  availability: ImplementationChatAvailability,
  nowIso: string,
): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const lines = [availability.title, availability.message].filter(Boolean);
  return newRequirementsMessage({
    id: `impl-chat-availability-blocked-${nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    createdAt: nowIso,
    meta: {
      internalType: IMPLEMENTATION_CHAT_AVAILABILITY_BLOCKED_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      source: "implementation_chat_availability_guard",
      availabilityStatus: availability.status,
    },
  });
}

export function buildImplementationChatAvailabilityBlockedOperationalResult(input: Readonly<{
  readonly availability: ImplementationChatAvailability;
  readonly nowIso: string;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
}>): PrototypeExecutionOperationalSendResult {
  return {
    kind: "assistant_reply",
    aiMessage: buildImplementationChatAvailabilityBlockedMessage(input.availability, input.nowIso),
    ...(input.timelineEntries?.length ? { timelineEntries: input.timelineEntries } : {}),
  };
}

export function shouldBlockImplementationSupplementChat(
  availability: ImplementationChatAvailability | undefined,
): availability is ImplementationChatAvailability {
  return Boolean(availability && !availability.canChat);
}
