import { createMessengerChatRoom } from "@/lib/messenger/messengerChatRoomApi";
import {
  openMessengerChatRoomWindow,
  type OpenMessengerChatRoomWindowOptions,
} from "@/lib/messenger/openMessengerChatRoomWindow";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";

/** 1:Agent — DIRECT + AI 자동 응답 대화방을 만들고 새 창(또는 탭)으로 연다. */
export async function createAndOpenMessengerAgentRoom(
  options?: OpenMessengerChatRoomWindowOptions
): Promise<string> {
  const { id } = await createMessengerChatRoom({
    roomType: "DIRECT",
    aiParticipationMode: "AUTO",
  });

  const opened = openMessengerChatRoomWindow(id, {
    ...options,
    discardEmptyOnClose: options?.discardEmptyOnClose ?? true,
  });

  if (!opened) {
    const url = `${window.location.origin}/chat/${encodeURIComponent(id)}?discardEmpty=1`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    registerPlatformPopupFromOpenedUrl(w, url);
  }

  return id;
}
