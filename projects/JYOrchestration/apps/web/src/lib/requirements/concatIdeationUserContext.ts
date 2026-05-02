import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { isServiceFlowWorkshopMessage } from "@/lib/requirements/serviceFlowConversation";

/** 서비스 흐름 초안 등에 넣을 사용자(ideation) 발화만 이어붙입니다. 워크숍 메시지는 제외합니다. */
export function concatIdeationUserContext(messages: readonly RequirementsMessage[]): string {
  return messages
    .filter((m) => m.role === "user" && !isServiceFlowWorkshopMessage(m))
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}
