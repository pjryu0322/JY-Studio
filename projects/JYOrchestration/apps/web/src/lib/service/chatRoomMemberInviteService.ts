import { Prisma } from "@prisma/client";
import { assertChatRoomAccess } from "@/lib/service/chatRoomService";
import { isMessengerFriend } from "@/lib/service/messengerFriendService";
import { prisma } from "@/lib/prisma";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

export const NOTIFICATION_TYPE_CHAT_ROOM_MEMBER_INVITE = "CHAT_ROOM_MEMBER_INVITE";

export type CreateChatRoomMemberInviteResult =
  | { outcome: "NOT_FRIEND" }
  | { outcome: "ALREADY_MEMBER" }
  | { outcome: "INVITE_PENDING" }
  | { outcome: "INVITE_SENT"; inviteId: string; notificationId: string };

export async function createChatRoomMemberInvite(input: {
  roomId: string;
  inviterUserId: string;
  inviteeUserId: string;
}): Promise<CreateChatRoomMemberInviteResult> {
  const room = await assertChatRoomAccess(input.roomId, input.inviterUserId);
  if (room.projectId) {
    throw new Error("PROJECT_LINKED");
  }

  const inviteeId = input.inviteeUserId.trim();
  const inviterId = input.inviterUserId.trim();
  if (!inviteeId || inviteeId === inviterId) {
    throw new Error("INVALID_INVITEE");
  }

  const friendOk = await isMessengerFriend(inviterId, inviteeId);
  if (!friendOk) {
    return { outcome: "NOT_FRIEND" };
  }

  const invitee = await prisma.user.findFirst({
    where: { id: inviteeId, accountStatus: "ACTIVE" },
    select: { id: true, name: true, nickname: true, email: true },
  });
  if (!invitee) {
    throw new Error("INVITEE_NOT_FOUND");
  }

  const existingMember = await prisma.chatRoomMember.findFirst({
    where: { chatRoomId: room.id, userId: inviteeId, memberType: "USER" },
    select: { id: true },
  });
  if (existingMember) {
    return { outcome: "ALREADY_MEMBER" };
  }

  const roomTitle = room.title?.trim() || "대화방";
  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { name: true, nickname: true },
  });
  const inviterName = platformUserDisplayName(inviter?.nickname, inviter?.name) || "멤버";

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chatRoomMemberInvite.findUnique({
      where: { chatRoomId_inviteeUserId: { chatRoomId: room.id, inviteeUserId: inviteeId } },
    });
    if (existing?.status === "PENDING") {
      return { outcome: "INVITE_PENDING" as const };
    }

    const invite = await tx.chatRoomMemberInvite.upsert({
      where: { chatRoomId_inviteeUserId: { chatRoomId: room.id, inviteeUserId: inviteeId } },
      create: {
        chatRoomId: room.id,
        inviteeUserId: inviteeId,
        invitedByUserId: inviterId,
        status: "PENDING",
      },
      update: {
        invitedByUserId: inviterId,
        status: "PENDING",
        respondedAt: null,
      },
    });

    const notif = await tx.platformNotification.create({
      data: {
        userId: inviteeId,
        type: NOTIFICATION_TYPE_CHAT_ROOM_MEMBER_INVITE,
        title: "대화방 참여 요청",
        body: `${inviterName}님이 「${roomTitle}」대화방에 초대했습니다. 참여하시겠어요?`,
        inviteId: invite.id,
        data: {
          inviteId: invite.id,
          chatRoomId: room.id,
          roomTitle,
          inviterUserId: inviterId,
          inviterName,
        } as Prisma.InputJsonValue,
      },
    });

    return { outcome: "INVITE_SENT" as const, inviteId: invite.id, notificationId: notif.id };
  });
}

export async function listPendingChatRoomMemberInvites(roomId: string, viewerUserId: string) {
  await assertChatRoomAccess(roomId, viewerUserId);
  const rows = await prisma.chatRoomMemberInvite.findMany({
    where: { chatRoomId: roomId.trim(), status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      invitee: { select: { id: true, name: true, nickname: true, email: true } },
    },
  });
  return rows.map((r) => ({
    inviteId: r.id,
    inviteeUserId: r.inviteeUserId,
    displayName: platformUserDisplayName(r.invitee.nickname, r.invitee.name) || r.invitee.email || r.invitee.id,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function acceptChatRoomMemberInvite(input: { inviteId: string; sessionUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.chatRoomMemberInvite.findFirst({
      where: {
        id: input.inviteId,
        inviteeUserId: input.sessionUserId,
        status: "PENDING",
      },
      include: {
        chatRoom: { select: { id: true, title: true, projectId: true, type: true } },
        invitee: { select: { name: true, nickname: true, email: true } },
      },
    });
    if (!inv) {
      return { ok: false as const, code: "NOT_FOUND" as const };
    }
    if (inv.chatRoom.projectId) {
      return { ok: false as const, code: "PROJECT_LINKED" as const };
    }

    const displayName = platformUserDisplayName(inv.invitee.nickname, inv.invitee.name) || inv.invitee.email || "멤버";

    await tx.chatRoomMemberInvite.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    const existing = await tx.chatRoomMember.findFirst({
      where: { chatRoomId: inv.chatRoomId, userId: inv.inviteeUserId, memberType: "USER" },
    });
    if (!existing) {
      await tx.chatRoomMember.create({
        data: {
          chatRoomId: inv.chatRoomId,
          memberType: "USER",
          userId: inv.inviteeUserId,
          displayName,
          role: "member",
        },
      });
    }

    const userCount = await tx.chatRoomMember.count({
      where: { chatRoomId: inv.chatRoomId, memberType: "USER" },
    });
    if (userCount > 1 && inv.chatRoom.type !== "GROUP") {
      await tx.chatRoom.update({
        where: { id: inv.chatRoomId },
        data: { type: "GROUP" },
      });
    }

    const joinLine = `${displayName}님이 대화방에 참여했습니다.`;
    const preview = joinLine.replace(/\s+/g, " ").slice(0, 280);
    await tx.chatMessage.create({
      data: {
        chatRoomId: inv.chatRoomId,
        projectId: null,
        senderType: "SYSTEM",
        senderId: null,
        senderName: "시스템",
        content: joinLine,
        metadata: { kind: "messenger_member_joined", userId: inv.inviteeUserId } as Prisma.InputJsonValue,
      },
    });
    await tx.chatRoom.update({
      where: { id: inv.chatRoomId },
      data: { lastMessagePreview: preview, updatedAt: new Date() },
    });

    await tx.platformNotification.updateMany({
      where: { userId: input.sessionUserId, inviteId: inv.id, readAt: null },
      data: { readAt: new Date() },
    });

    return { ok: true as const, chatRoomId: inv.chatRoomId };
  });
}

export async function declineChatRoomMemberInvite(input: { inviteId: string; sessionUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.chatRoomMemberInvite.findFirst({
      where: {
        id: input.inviteId,
        inviteeUserId: input.sessionUserId,
        status: "PENDING",
      },
    });
    if (!inv) {
      return { ok: false as const, code: "NOT_FOUND" as const };
    }
    await tx.chatRoomMemberInvite.update({
      where: { id: inv.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await tx.platformNotification.updateMany({
      where: { userId: input.sessionUserId, inviteId: inv.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  });
}
