import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";

/** 전송 직후 서버 반영 전 UI에 표시할 사용자 메시지 */
export function buildOptimisticMessengerUserMessage(input: {
  readonly content: string;
  readonly speakerId?: string;
  readonly speakerName?: string;
}): RequirementsMessage {
  return newRequirementsMessage({
    id: `optimistic-${Date.now()}`,
    role: "user",
    speakerType: "USER",
    speakerId: input.speakerId?.trim() || "me",
    speakerName: input.speakerName?.trim() || "나",
    messageType: "STATEMENT",
    content: input.content,
    meta: { internalType: "messenger_room" },
  });
}
