import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  normalizeMessengerRoomDetailWire,
  type MessengerRoomDetail,
} from "@/lib/messenger/messengerRoomParticipantMapping";

export async function fetchMessengerChatRoomDetail(roomId: string): Promise<MessengerRoomDetail> {
  const rid = roomId.trim();
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      room?: {
        id: string;
        title: string;
        ownerUserId?: string;
        projectId: string | null;
        aiParticipationMode?: string;
        type?: string;
      };
      members?: MessengerRoomDetail["members"];
    };
    message?: string;
  };
  if (!res.ok || !json.success || !json.data?.room) {
    throw new Error(json.message || "대화방을 불러오지 못했습니다.");
  }
  return normalizeMessengerRoomDetailWire(json.data);
}

export async function fetchMessengerChatRoomMessages(roomId: string): Promise<readonly RequirementsMessage[]> {
  const rid = roomId.trim();
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encodeURIComponent(rid)}/messages`);
  const json = (await res.json()) as { success?: boolean; data?: { messages?: RequirementsMessage[] }; message?: string };
  if (!res.ok || !json.success || !Array.isArray(json.data?.messages)) {
    throw new Error(json.message || "메시지를 불러오지 못했습니다.");
  }
  return json.data!.messages!;
}
