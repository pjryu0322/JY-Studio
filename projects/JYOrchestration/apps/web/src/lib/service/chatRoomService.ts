/**
 * 메신저형 사전 대화방 — 프로젝트 전 ChatRoom / 메시지 / 초안.
 */
import type { ChatMessage, ChatRoom, ChatRoomMember, ProjectFromChatDraft } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getPlatformAiMemberById } from "@/lib/ai/platformAiMembers";
import { buildMessengerTranscriptForLlm } from "@/lib/messenger/chatMessageToRequirementsMessage";
import { messengerAiModeChangeSystemLine, textMentionsMessengerAiPlanner } from "@/lib/messenger/messengerAiParticipation";
import { prisma } from "@/lib/prisma";
import { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";
import { runMessengerAiTurn } from "@/lib/messenger/messengerLlm";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { createProject } from "@/lib/service/projectService";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

export type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";

export { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";

export class ChatRoomAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN";
  constructor(code: ChatRoomAccessError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function assertChatRoomAccess(roomId: string, userId: string): Promise<ChatRoom> {
  const rid = roomId.trim();
  const uid = userId.trim();
  if (!rid || !uid) throw new ChatRoomAccessError("NOT_FOUND", "대화방을 찾을 수 없습니다.");
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: rid,
      OR: [{ ownerUserId: uid }, { members: { some: { userId: uid, memberType: "USER" } } }],
    },
  });
  if (!room) throw new ChatRoomAccessError("FORBIDDEN", "이 대화방에 접근할 수 없습니다.");
  return room;
}

export async function listChatRoomsForUser(userId: string): Promise<ChatRoom[]> {
  const uid = userId.trim();
  if (!uid) return [];
  return prisma.chatRoom.findMany({
    where: {
      OR: [{ ownerUserId: uid }, { members: { some: { userId: uid, memberType: "USER" } } }],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getChatRoomDetail(roomId: string, userId: string): Promise<{
  room: ChatRoom;
  members: ChatRoomMember[];
}> {
  const room = await assertChatRoomAccess(roomId, userId);
  const members = await prisma.chatRoomMember.findMany({
    where: { chatRoomId: room.id },
    orderBy: { joinedAt: "asc" },
  });
  return { room, members };
}

export async function listChatMessages(roomId: string, userId: string): Promise<ChatMessage[]> {
  const room = await assertChatRoomAccess(roomId, userId);
  return prisma.chatMessage.findMany({
    where: { chatRoomId: room.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function appendChatMessage(input: {
  roomId: string;
  userId: string;
  senderType: "USER" | "AI" | "SYSTEM";
  senderId: string | null;
  senderName: string;
  content: string;
  metadata?: Prisma.InputJsonValue | null;
}): Promise<ChatMessage> {
  const room = await assertChatRoomAccess(input.roomId, input.userId);
  const preview = input.content.trim().replace(/\s+/g, " ").slice(0, 280);
  const msg = await prisma.chatMessage.create({
    data: {
      chatRoomId: room.id,
      projectId: room.projectId,
      senderType: input.senderType,
      senderId: input.senderId,
      senderName: input.senderName,
      content: input.content,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
  await prisma.chatRoom.update({
    where: { id: room.id },
    data: {
      lastMessagePreview: preview || null,
      updatedAt: new Date(),
    },
  });
  return msg;
}

export type CreateMessengerChatRoomInput = {
  roomType: "SOLO" | "DIRECT";
  aiParticipationMode: "NONE" | "AUTO" | "MENTION_ONLY";
  title?: string | null;
};

function messengerBootstrapSystemContent(mode: CreateMessengerChatRoomInput["aiParticipationMode"]): string {
  if (mode === "NONE") return "이 방은 AI 응답 없이 메모만 작성하는 모드입니다.";
  if (mode === "AUTO") return "AI 기획자가 메시지에 자동으로 응답합니다.";
  return "@AI기획자 또는 @기획자로 부를 때만 AI가 응답합니다.";
}

/** 메신저 사전 대화방 생성(혼자 메모 / AI 자동 / AI 멘션) */
export async function createMessengerChatRoom(
  userId: string,
  input: CreateMessengerChatRoomInput
): Promise<{ room: ChatRoom; members: ChatRoomMember[] }> {
  const uid = userId.trim();
  if (!uid) throw new Error("userId required");
  const mode = input.aiParticipationMode;
  const type = input.roomType;
  if (mode === "NONE" && type !== "SOLO") throw new Error("INVALID_ROOM_SHAPE");
  if (mode !== "NONE" && type !== "DIRECT") throw new Error("INVALID_ROOM_SHAPE");

  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const aiName = ai?.name ?? "AI 기획자";
  const defaultTitle = mode === "NONE" ? "혼자 정리하는 대화" : "AI기획자와의 대화";
  const title = String(input.title ?? "").trim() || defaultTitle;

  return prisma.$transaction(async (tx) => {
    const room = await tx.chatRoom.create({
      data: {
        title,
        type,
        aiParticipationMode: mode,
        ownerUserId: uid,
        lastMessagePreview: null,
      },
    });
    const mUser = await tx.chatRoomMember.create({
      data: {
        chatRoomId: room.id,
        memberType: "USER",
        userId: uid,
        displayName: "나",
        role: "owner",
      },
    });
    const members: ChatRoomMember[] = [mUser];
    if (mode !== "NONE") {
      const mAi = await tx.chatRoomMember.create({
        data: {
          chatRoomId: room.id,
          memberType: "AI",
          aiMemberId: MESSENGER_DEFAULT_AI_CATALOG_KEY,
          displayName: aiName,
          role: ai?.role ?? "기획",
        },
      });
      members.push(mAi);
    }
    await tx.chatMessage.create({
      data: {
        chatRoomId: room.id,
        projectId: room.projectId,
        senderType: "SYSTEM",
        senderId: null,
        senderName: "시스템",
        content: messengerBootstrapSystemContent(mode),
        metadata: { kind: "messenger_room_bootstrap", aiParticipationMode: mode } as Prisma.InputJsonValue,
      },
    });
    await tx.chatRoom.update({
      where: { id: room.id },
      data: {
        lastMessagePreview: messengerBootstrapSystemContent(mode).replace(/\s+/g, " ").slice(0, 280),
        updatedAt: new Date(),
      },
    });
    const refreshed = await tx.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    return { room: refreshed, members };
  });
}

/** @deprecated 호환용 — DIRECT + AUTO 방 생성 */
export async function createDefaultMessengerRoom(userId: string): Promise<{ room: ChatRoom; members: ChatRoomMember[] }> {
  return createMessengerChatRoom(userId, { roomType: "DIRECT", aiParticipationMode: "AUTO" });
}

export type CreateMessengerGroupChatInput = {
  /** 초대할 친구(본인 제외). DB에 존재하는 ACTIVE 사용자만 허용. */
  participantUserIds: readonly string[];
  title?: string | null;
};

const MESSENGER_GROUP_CHAT_MAX_OTHERS = 24;

/**
 * Chat 유형: AI 없음, 본인 + 선택한 플랫폼 사용자들의 GROUP 방.
 */
export async function createMessengerGroupChatRoom(
  ownerUserId: string,
  input: CreateMessengerGroupChatInput
): Promise<{ room: ChatRoom; members: ChatRoomMember[] }> {
  const uid = ownerUserId.trim();
  if (!uid) throw new Error("userId required");
  const others = [...new Set(input.participantUserIds.map((x) => String(x ?? "").trim()).filter(Boolean))].filter((id) => id !== uid);
  if (others.length === 0) throw new Error("PARTICIPANTS_REQUIRED");
  if (others.length > MESSENGER_GROUP_CHAT_MAX_OTHERS) throw new Error("TOO_MANY_PARTICIPANTS");

  const users = await prisma.user.findMany({
    where: { id: { in: others }, accountStatus: "ACTIVE" },
    select: { id: true, name: true, nickname: true },
  });
  if (users.length !== others.length) throw new Error("INVALID_PARTICIPANT");

  const nameParts = users.map((u) => platformUserDisplayName(u.nickname, u.name)).filter(Boolean);
  const autoTitle =
    nameParts.length <= 3 ? nameParts.join(", ") : `${nameParts.slice(0, 3).join(", ")} 외 ${users.length - 3}명`;
  const titleRaw = String(input.title ?? "").trim() || autoTitle || "친구 대화";
  const title = titleRaw.slice(0, 200);

  const bootstrap = "친구들과 대화하는 방입니다. AI 기획자는 참여하지 않습니다.";

  return prisma.$transaction(async (tx) => {
    const room = await tx.chatRoom.create({
      data: {
        title,
        type: "GROUP",
        aiParticipationMode: "NONE",
        ownerUserId: uid,
        lastMessagePreview: null,
      },
    });
    const members: ChatRoomMember[] = [];
    members.push(
      await tx.chatRoomMember.create({
        data: {
          chatRoomId: room.id,
          memberType: "USER",
          userId: uid,
          displayName: "나",
          role: "owner",
        },
      })
    );
    for (const u of users) {
      members.push(
        await tx.chatRoomMember.create({
          data: {
            chatRoomId: room.id,
            memberType: "USER",
            userId: u.id,
            displayName: platformUserDisplayName(u.nickname, u.name),
            role: "member",
          },
        })
      );
    }
    await tx.chatMessage.create({
      data: {
        chatRoomId: room.id,
        projectId: room.projectId,
        senderType: "SYSTEM",
        senderId: null,
        senderName: "시스템",
        content: bootstrap,
        metadata: { kind: "messenger_room_bootstrap", roomShape: "GROUP_CHAT", aiParticipationMode: "NONE" } as Prisma.InputJsonValue,
      },
    });
    await tx.chatRoom.update({
      where: { id: room.id },
      data: {
        lastMessagePreview: bootstrap.replace(/\s+/g, " ").slice(0, 280),
        updatedAt: new Date(),
      },
    });
    const refreshed = await tx.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    return { room: refreshed, members };
  });
}

export function messengerRoomShouldRunAiAfterUserMessage(room: Pick<ChatRoom, "projectId" | "aiParticipationMode">, userMessageText: string): boolean {
  if (room.projectId) return false;
  const mode = room.aiParticipationMode;
  if (mode === "NONE") return false;
  if (mode === "AUTO") return true;
  return textMentionsMessengerAiPlanner(userMessageText);
}

export type MessengerAiTurnRunResult =
  | { ok: true; model: string }
  | { ok: false; code: string; message: string };

/** 마지막 메시지가 사용자(user)인 전제에서 메신저 LLM 한 턴 실행 후 AI 메시지 저장 */
export async function executeMessengerAiTurnForRoom(roomId: string, userId: string): Promise<MessengerAiTurnRunResult> {
  const rows = await listChatMessages(roomId, userId);
  const transcript = buildMessengerTranscriptForLlm(rows);
  if (transcript.length === 0) {
    return { ok: false, code: "EMPTY", message: "먼저 메시지를 입력해 주세요." };
  }
  const last = transcript[transcript.length - 1];
  if (last.role !== "user") {
    return { ok: false, code: "LAST_NOT_USER", message: "AI 응답을 이어가려면 사용자 메시지가 마지막이어야 합니다." };
  }
  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const aiName = ai?.name ?? "AI 기획자";
  const result = await runMessengerAiTurn({ userId, transcript });
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  await appendChatMessage({
    roomId,
    userId,
    senderType: "AI",
    senderId: MESSENGER_DEFAULT_AI_CATALOG_KEY,
    senderName: aiName,
    content: result.text,
    metadata: { source: "messenger_llm", model: result.model },
  });
  return { ok: true, model: result.model };
}

export async function updateMessengerRoomAiParticipation(input: {
  roomId: string;
  userId: string;
  nextMode: "NONE" | "AUTO" | "MENTION_ONLY";
}): Promise<{ room: ChatRoom; members: ChatRoomMember[] }> {
  const room = await assertChatRoomAccess(input.roomId, input.userId);
  if (room.projectId) {
    throw new Error("PROJECT_LINKED");
  }
  const prevMode = room.aiParticipationMode;
  const nextMode = input.nextMode;
  const isGroup = room.type === "GROUP";
  /** 친구 Chat(GROUP)은 방 유형을 바꾸지 않고 AI 참여만 토글한다. SOLO/DIRECT는 NONE↔AI에 맞춰 유형을 맞춘다. */
  const nextType: ChatRoom["type"] | null = isGroup ? null : nextMode === "NONE" ? "SOLO" : "DIRECT";
  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const aiName = ai?.name ?? "AI 기획자";

  return prisma.$transaction(async (tx) => {
    await tx.chatRoom.update({
      where: { id: room.id },
      data: {
        aiParticipationMode: nextMode,
        ...(nextType !== null ? { type: nextType } : {}),
      },
    });
    if (nextMode === "NONE") {
      await tx.chatRoomMember.deleteMany({
        where: { chatRoomId: room.id, memberType: "AI", aiMemberId: MESSENGER_DEFAULT_AI_CATALOG_KEY },
      });
    } else {
      const existing = await tx.chatRoomMember.findFirst({
        where: { chatRoomId: room.id, memberType: "AI", aiMemberId: MESSENGER_DEFAULT_AI_CATALOG_KEY },
      });
      if (!existing) {
        await tx.chatRoomMember.create({
          data: {
            chatRoomId: room.id,
            memberType: "AI",
            aiMemberId: MESSENGER_DEFAULT_AI_CATALOG_KEY,
            displayName: aiName,
            role: ai?.role ?? "기획",
          },
        });
      }
    }
    if (prevMode !== nextMode) {
      await tx.chatMessage.create({
        data: {
          chatRoomId: room.id,
          projectId: room.projectId,
          senderType: "SYSTEM",
          senderId: null,
          senderName: "시스템",
          content: messengerAiModeChangeSystemLine(nextMode),
          metadata: { kind: "messenger_ai_mode_changed", from: prevMode, to: nextMode } as Prisma.InputJsonValue,
        },
      });
      await tx.chatRoom.update({
        where: { id: room.id },
        data: {
          lastMessagePreview: messengerAiModeChangeSystemLine(nextMode).replace(/\s+/g, " ").slice(0, 280),
          updatedAt: new Date(),
        },
      });
    }
    const refreshed = await tx.chatRoom.findUniqueOrThrow({ where: { id: room.id } });
    const members = await tx.chatRoomMember.findMany({
      where: { chatRoomId: room.id },
      orderBy: { joinedAt: "asc" },
    });
    return { room: refreshed, members };
  });
}

export async function updateChatRoomTitle(input: { roomId: string; userId: string; title: string }): Promise<ChatRoom> {
  await assertChatRoomAccess(input.roomId, input.userId);
  const title = String(input.title ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!title) throw new Error("TITLE_EMPTY");
  if (title.length > 200) throw new Error("TITLE_TOO_LONG");
  return prisma.chatRoom.update({
    where: { id: input.roomId.trim() },
    data: { title, updatedAt: new Date() },
  });
}

/** 대화방 개설자(소유자)만 전체 삭제. 프로젝트에 연결된 방은 금지. */
export async function deleteChatRoomForOwner(roomId: string, userId: string): Promise<void> {
  const room = await assertChatRoomAccess(roomId, userId);
  if (room.ownerUserId !== userId.trim()) {
    throw new ChatRoomAccessError("FORBIDDEN", "대화방 개설자만 삭제할 수 있습니다.");
  }
  if (room.projectId) throw new Error("PROJECT_LINKED");
  await prisma.chatRoom.delete({ where: { id: room.id } });
}

function messengerMemberLeftSystemLine(displayName: string): string {
  const name = displayName.trim() || "멤버";
  return `${name}님이 대화방을 나갔습니다.`;
}

/**
 * 누구나 탈퇴(USER 멤버십 해제).
 * 다른 사람이 남아 있으면 시스템 메시지를 남기고, 개설자 탈퇴 시 다음 USER에게 소유권을 넘깁니다.
 * USER가 본인만 남았을 때는 방을 삭제(단, 프로젝트 연결 방이면 금지).
 */
export async function leaveChatRoomAsMember(roomId: string, userId: string): Promise<void> {
  const room = await assertChatRoomAccess(roomId, userId);
  const uid = userId.trim();
  const rid = room.id;

  const myMember = await prisma.chatRoomMember.findFirst({
    where: { chatRoomId: rid, userId: uid, memberType: "USER" },
  });
  if (!myMember) throw new Error("NOT_A_MEMBER");

  const userMembers = await prisma.chatRoomMember.findMany({
    where: { chatRoomId: rid, memberType: "USER" },
    orderBy: { joinedAt: "asc" },
  });

  if (userMembers.length <= 1) {
    if (room.projectId) throw new Error("PROJECT_LINKED_CANNOT_LEAVE_ALONE");
    await prisma.chatRoom.delete({ where: { id: rid } });
    return;
  }

  const leaveLine = messengerMemberLeftSystemLine(myMember.displayName);
  const preview = leaveLine.replace(/\s+/g, " ").slice(0, 280);

  await prisma.$transaction(async (tx) => {
    const others = userMembers.filter((m) => m.userId !== uid);
    const nextOwner = others[0];
    if (!nextOwner?.userId) throw new Error("NOT_A_MEMBER");

    if (room.ownerUserId === uid) {
      await tx.chatRoom.update({
        where: { id: rid },
        data: { ownerUserId: nextOwner.userId, updatedAt: new Date() },
      });
      await tx.chatRoomMember.update({
        where: { id: nextOwner.id },
        data: { role: "owner" },
      });
    }

    await tx.chatRoomMember.delete({ where: { id: myMember.id } });

    await tx.chatMessage.create({
      data: {
        chatRoomId: rid,
        projectId: room.projectId,
        senderType: "SYSTEM",
        senderId: null,
        senderName: "시스템",
        content: leaveLine,
        metadata: { kind: "messenger_member_left", userId: uid } as Prisma.InputJsonValue,
      },
    });
    await tx.chatRoom.update({
      where: { id: rid },
      data: { lastMessagePreview: preview, updatedAt: new Date() },
    });
  });
}

export async function saveProjectFromChatDraft(input: {
  roomId: string;
  userId: string;
  payload: ProjectFromChatDraftPayloadV1;
}): Promise<ProjectFromChatDraft> {
  await assertChatRoomAccess(input.roomId, input.userId);
  return prisma.projectFromChatDraft.create({
    data: {
      chatRoomId: input.roomId.trim(),
      status: "DRAFT",
      payloadJson: input.payload as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getLatestDraftForRoom(roomId: string, userId: string): Promise<ProjectFromChatDraft | null> {
  await assertChatRoomAccess(roomId, userId);
  return prisma.projectFromChatDraft.findFirst({
    where: { chatRoomId: roomId.trim(), status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
}

export async function confirmProjectFromChatRoom(input: {
  roomId: string;
  userId: string;
  projectName: string;
  projectDescription: string | null;
  requirementsSeedFromDraft?: boolean;
}): Promise<{ projectId: string; draftId: string }> {
  const room = await assertChatRoomAccess(input.roomId, input.userId);
  if (room.projectId) {
    const prev = await prisma.projectFromChatDraft.findFirst({
      where: { chatRoomId: room.id, status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    return { projectId: room.projectId, draftId: prev?.id ?? "" };
  }
  const draft = await prisma.projectFromChatDraft.findFirst({
    where: { chatRoomId: room.id, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) {
    throw new Error("NO_DRAFT");
  }

  const name = input.projectName.trim();
  if (!name) throw new Error("NAME_REQUIRED");

  const payload = draft.payloadJson as unknown as ProjectFromChatDraftPayloadV1;
  const desc = input.projectDescription ?? payload.description ?? "";

  const project = await createProject({
    name,
    description: desc || null,
    projectType: "web-service",
    repoUrl: null,
    defaultBranch: "main",
    ownerUserId: input.userId,
    includeDefaultAiPlanner: true,
  });

  if (input.requirementsSeedFromDraft !== false && payload && typeof payload === "object") {
    const cur = await prisma.project.findUnique({
      where: { id: project.id },
      select: { requirementsStateJson: true },
    });
    const base = (cur?.requirementsStateJson ?? {}) as RequirementsStateJson;
    const patch: Partial<RequirementsStateJson> = {
      originalProjectDescription: desc || "",
    };
    if (Array.isArray(payload.openQuestions) && payload.openQuestions.length) {
      patch.openIssues = payload.openQuestions.map((s) => String(s)).join("\n");
    }
    if (Array.isArray(payload.featureCandidates) && payload.featureCandidates.length) {
      patch.priorityFeatures = payload.featureCandidates.map((s) => String(s)).join("\n");
    }
    await prisma.project.update({
      where: { id: project.id },
      data: {
        requirementsStateJson: mergeRequirementsStateJson(base, patch) as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.$transaction([
    prisma.chatRoom.update({
      where: { id: room.id },
      data: {
        projectId: project.id,
        type: "PROJECT",
        updatedAt: new Date(),
      },
    }),
    prisma.projectFromChatDraft.update({
      where: { id: draft.id },
      data: { status: "CONFIRMED" },
    }),
    prisma.chatMessage.create({
      data: {
        chatRoomId: room.id,
        projectId: project.id,
        senderType: "SYSTEM",
        senderId: null,
        senderName: "시스템",
        content: `프로젝트룸이 생성되었습니다.「${project.name}」에서 계속 진행할 수 있습니다.`,
        metadata: { kind: "project_created", projectId: project.id } as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { projectId: project.id, draftId: draft.id };
}
