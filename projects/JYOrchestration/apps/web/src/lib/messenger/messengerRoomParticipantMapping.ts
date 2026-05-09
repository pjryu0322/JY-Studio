import { WORKSPACE_AI_MEMBER_KEYS, getWorkspaceAiMember, type WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import type { MessengerAiMode } from "@/lib/messenger/messengerAiParticipation";
import { parseMessengerAiMode } from "@/lib/messenger/messengerAiParticipation";

export type ChatRoomMemberWire = {
  readonly id: string;
  readonly memberType: "USER" | "AI";
  readonly userId: string | null;
  readonly aiMemberId: string | null;
  readonly displayName: string;
  readonly role: string | null;
};

export type MessengerRoomDetail = {
  readonly room: {
    id: string;
    title: string;
    ownerUserId: string;
    projectId: string | null;
    aiParticipationMode: MessengerAiMode;
    /** Prisma `ChatRoomType` — GROUP이면 친구 Chat 등 */
    type: string;
  };
  readonly members: readonly ChatRoomMemberWire[];
};

function parseWorkspaceAiMemberId(raw: string | null | undefined): WorkspaceAiMemberId | undefined {
  const s = String(raw ?? "").trim();
  return (WORKSPACE_AI_MEMBER_KEYS as readonly string[]).includes(s) ? (s as WorkspaceAiMemberId) : undefined;
}

export function messengerMembersToParticipants(members: readonly ChatRoomMemberWire[]): readonly ParticipantOption[] {
  const out: ParticipantOption[] = [];
  for (const m of members) {
    if (m.memberType === "USER") {
      out.push({
        id: `human:${m.userId ?? m.id}`,
        name: m.displayName.trim() || "나",
        kind: "human",
        onlineHint: true,
        roleLabel: m.role?.trim() || undefined,
      });
      continue;
    }
    if (m.memberType === "AI") {
      const wid = parseWorkspaceAiMemberId(m.aiMemberId);
      const def = wid ? getWorkspaceAiMember(wid) : undefined;
      out.push({
        id: `ai:${m.aiMemberId ?? m.id}`,
        name: m.displayName.trim() || def?.title || "AI",
        kind: "ai",
        onlineHint: false,
        platformMemberId: wid,
        isCurrentScreenAi: Boolean(wid),
        aiAvatarGlyphKey: def?.avatarGlyphKey,
        aiAvatarAccent: def?.avatarAccent,
        aiAvatarLabel: def?.avatarLabel,
        roleLabel: m.role?.trim() || undefined,
      });
    }
  }
  return out;
}

/** GET /api/chat-rooms/[roomId] 응답의 room 객체를 클라이언트 상세 타입으로 정규화 */
export function normalizeMessengerRoomDetailWire(data: {
  room?: {
    id: string;
    title: string;
    ownerUserId?: string;
    projectId: string | null;
    aiParticipationMode?: string;
    type?: string;
  };
  members?: readonly ChatRoomMemberWire[];
}): MessengerRoomDetail {
  const row = data.room;
  if (!row) {
    throw new Error("room missing");
  }
  const mode = parseMessengerAiMode(row.aiParticipationMode) ?? "AUTO";
  const roomType = typeof row.type === "string" && row.type.trim() ? row.type.trim() : "SOLO";
  const ownerUserId = typeof row.ownerUserId === "string" && row.ownerUserId.trim() ? row.ownerUserId.trim() : "";
  const members = Array.isArray(data.members) ? data.members : [];
  return {
    room: {
      id: row.id,
      title: row.title,
      ownerUserId,
      projectId: row.projectId ?? null,
      aiParticipationMode: mode,
      type: roomType,
    },
    members,
  };
}
