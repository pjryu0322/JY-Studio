import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  normalizeMessengerRoomDetailWire,
  type MessengerRoomDetail,
} from "@/lib/messenger/messengerRoomParticipantMapping";

function encRoomId(roomId: string): string {
  return encodeURIComponent(roomId.trim());
}

export type MessengerChatRoomListRow = {
  readonly id: string;
  readonly title: string;
  readonly lastMessagePreview: string | null;
  readonly updatedAt: string;
  readonly projectId: string | null;
  readonly type?: string;
  readonly isOwner?: boolean;
  readonly aiParticipationMode?: string;
};

export type FetchMessengerChatRoomsResult =
  | { readonly ok: true; readonly rooms: readonly MessengerChatRoomListRow[] }
  | { readonly ok: false; readonly status: number; readonly message: string };

function normalizeMessengerChatRoomListWire(rows: readonly Record<string, unknown>[]): MessengerChatRoomListRow[] {
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    lastMessagePreview: typeof row.lastMessagePreview === "string" ? row.lastMessagePreview : null,
    updatedAt: String(row.updatedAt ?? ""),
    projectId: row.projectId == null ? null : String(row.projectId),
    type: typeof row.type === "string" ? row.type : undefined,
    isOwner: Boolean(row.isOwner),
    aiParticipationMode: typeof row.aiParticipationMode === "string" ? row.aiParticipationMode : undefined,
  }));
}

export async function fetchMessengerChatRooms(): Promise<FetchMessengerChatRoomsResult> {
  const res = await credentialsIncludeFetch("/api/chat-rooms");
  const json = (await res.json()) as {
    success?: boolean;
    data?: { rooms?: Record<string, unknown>[] };
    message?: string;
  };
  if (res.status === 401) {
    return { ok: false, status: 401, message: json.message || "로그인이 필요합니다." };
  }
  if (!res.ok || !json.success || !Array.isArray(json.data?.rooms)) {
    return {
      ok: false,
      status: res.status,
      message: json.message || "대화 목록을 불러오지 못했습니다.",
    };
  }
  return { ok: true, rooms: normalizeMessengerChatRoomListWire(json.data!.rooms!) };
}

export type CreateMessengerChatRoomPayload =
  | {
      readonly roomType: "SOLO" | "DIRECT";
      readonly aiParticipationMode: "NONE" | "AUTO" | "MENTION_ONLY";
    }
  | {
      readonly roomType: "GROUP";
      readonly aiParticipationMode: "NONE" | "AUTO" | "MENTION_ONLY";
      readonly participantUserIds: readonly string[];
    };

export async function createMessengerChatRoom(payload: CreateMessengerChatRoomPayload): Promise<{ readonly id: string }> {
  const res = await credentialsIncludeFetch("/api/chat-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { success?: boolean; data?: { id?: string }; message?: string };
  if (!res.ok || !json.success || !json.data?.id) {
    throw new Error(json.message || "대화방을 만들지 못했습니다.");
  }
  return { id: json.data.id };
}

export async function fetchMessengerChatRoomDetail(roomId: string): Promise<MessengerRoomDetail> {
  const rid = roomId.trim();
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(rid)}`, { cache: "no-store" });
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
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(rid)}/messages`);
  const json = (await res.json()) as { success?: boolean; data?: { messages?: RequirementsMessage[] }; message?: string };
  if (!res.ok || !json.success || !Array.isArray(json.data?.messages)) {
    throw new Error(json.message || "메시지를 불러오지 못했습니다.");
  }
  return json.data!.messages!;
}

export type PostMessengerUserMessageResult = { readonly aiError?: string | null };

export async function postMessengerUserMessage(roomId: string, content: string): Promise<PostMessengerUserMessageResult> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { aiRan?: boolean; aiError?: string };
  };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "전송에 실패했습니다.");
  }
  return { aiError: json.data?.aiError ?? null };
}

export async function patchMessengerRoomAiParticipation(roomId: string, mode: MessengerAiMode): Promise<void> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aiParticipationMode: mode }),
  });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "설정을 저장하지 못했습니다.");
  }
}

export async function patchMessengerRoomTitle(
  roomId: string,
  title: string
): Promise<MessengerRoomDetail> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: Parameters<typeof normalizeMessengerRoomDetailWire>[0];
  };
  if (!res.ok || !json.success || !json.data?.room) {
    throw new Error(json.message || "저장에 실패했습니다.");
  }
  return normalizeMessengerRoomDetailWire(json.data);
}

export async function deleteMessengerChatRoom(roomId: string): Promise<void> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}`, { method: "DELETE" });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "삭제에 실패했습니다.");
  }
}

export type DeleteMessengerChatRoomWithLinkedProjectResult = Readonly<{
  readonly ok: boolean;
  readonly roomDeleted: boolean;
  readonly linkedProjectReset: boolean;
  readonly projectId?: string | null;
  readonly warnings?: readonly string[];
  readonly message: string;
}>;

export async function postDeleteMessengerChatRoomWithLinkedProject(
  roomId: string,
  input?: Readonly<{ readonly confirmDeleteLinkedProjectData?: boolean }>,
): Promise<DeleteMessengerChatRoomWithLinkedProjectResult> {
  const res = await credentialsIncludeFetch(
    `/api/chat-rooms/${encRoomId(roomId)}/delete-with-linked-project`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmDeleteLinkedProjectData: input?.confirmDeleteLinkedProjectData === true,
      }),
    },
  );
  const json = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: DeleteMessengerChatRoomWithLinkedProjectResult;
    ok?: boolean;
    roomDeleted?: boolean;
    linkedProjectReset?: boolean;
  };
  const payload = json.data ?? json;
  if (!res.ok || !json.success || payload.ok === false) {
    throw new Error(json.message || payload.message || "삭제 중 문제가 발생했습니다. 다시 시도해 주세요.");
  }
  return {
    ok: true,
    roomDeleted: Boolean(payload.roomDeleted),
    linkedProjectReset: Boolean(payload.linkedProjectReset),
    projectId: payload.projectId ?? null,
    warnings: payload.warnings,
    message: payload.message || json.message || "삭제되었습니다.",
  };
}

export async function postMessengerChatRoomLeave(roomId: string): Promise<void> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/leave`, { method: "POST" });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "나가기에 실패했습니다.");
  }
}

export async function postMessengerProjectDraft(roomId: string): Promise<ProjectFromChatDraftPayloadV1> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/project-draft`, { method: "POST" });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { payload?: ProjectFromChatDraftPayloadV1 };
    message?: string;
  };
  if (!res.ok || !json.success || !json.data?.payload) {
    throw new Error(json.message || "초안 생성에 실패했습니다.");
  }
  return json.data.payload;
}

export async function postMessengerConfirmProject(
  roomId: string,
  name: string,
  description: string | null
): Promise<{ projectId: string }> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/confirm-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const json = (await res.json()) as { success?: boolean; data?: { projectId?: string }; message?: string };
  if (!res.ok || !json.success || !json.data?.projectId) {
    throw new Error(json.message || "프로젝트 생성에 실패했습니다.");
  }
  return { projectId: json.data.projectId };
}

export async function clearMessengerChatRoomConversation(roomId: string): Promise<void> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/clear-conversation`, {
    method: "POST",
  });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "대화 초기화에 실패했습니다.");
  }
}

export async function postMessengerAiSummaryBlockMessage(roomId: string, content: string): Promise<void> {
  const res = await credentialsIncludeFetch(`/api/chat-rooms/${encRoomId(roomId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, kind: "ai_work_note_summary" }),
  });
  const json = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message || "요약을 대화에 저장하지 못했습니다.");
  }
}
