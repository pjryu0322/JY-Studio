import { Prisma } from "@prisma/client";
import {
  NOTIFICATION_TYPE_CHAT_ROOM_MEMBER_INVITE,
} from "@/lib/service/chatRoomMemberInviteService";
import {
  NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE,
  type PlatformNotificationListItem,
} from "@/lib/service/projectMemberInviteService";
import { prisma } from "@/lib/prisma";

type PlatformNotificationDelegate = {
  findMany: (args: {
    where: { userId: string };
    orderBy: { createdAt: "desc" };
    take: number;
  }) => Promise<
    Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      data: unknown;
      inviteId: string | null;
      readAt: Date | null;
      createdAt: Date;
    }>
  >;
};

function prismaPlatformNotificationTable(): PlatformNotificationDelegate | null {
  const d = (prisma as unknown as { platformNotification?: PlatformNotificationDelegate }).platformNotification;
  return d ?? null;
}

export async function listMyPlatformNotifications(userId: string, take = 30): Promise<PlatformNotificationListItem[]> {
  const pn = prismaPlatformNotificationTable();
  if (!pn) return [];

  let rows: Awaited<ReturnType<PlatformNotificationDelegate["findMany"]>>;
  try {
    rows = await pn.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return [];
    }
    throw e;
  }

  const projectInviteIds = rows
    .filter((r) => r.type === NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE && r.inviteId)
    .map((r) => r.inviteId as string);
  const chatInviteIds = rows
    .filter((r) => r.type === NOTIFICATION_TYPE_CHAT_ROOM_MEMBER_INVITE && r.inviteId)
    .map((r) => r.inviteId as string);

  const [projectInvites, chatInvites] = await Promise.all([
    projectInviteIds.length
      ? prisma.projectMemberInvite.findMany({
          where: { id: { in: projectInviteIds } },
          include: { project: { select: { name: true } } },
        })
      : Promise.resolve([]),
    chatInviteIds.length
      ? prisma.chatRoomMemberInvite.findMany({
          where: { id: { in: chatInviteIds } },
          include: { chatRoom: { select: { title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const projectById = new Map(projectInvites.map((i) => [i.id, i]));
  const chatById = new Map(chatInvites.map((i) => [i.id, i]));

  return rows.map((r) => {
    const projectInv = r.inviteId ? projectById.get(r.inviteId) : undefined;
    const chatInv = r.inviteId ? chatById.get(r.inviteId) : undefined;

    const canRespondProject = Boolean(
      r.type === NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE && projectInv && projectInv.status === "PENDING" && r.inviteId
    );
    const canRespondChat = Boolean(
      r.type === NOTIFICATION_TYPE_CHAT_ROOM_MEMBER_INVITE && chatInv && chatInv.status === "PENDING" && r.inviteId
    );

    const data = (r.data ?? {}) as Record<string, unknown>;
    const chatRoomId =
      typeof data.chatRoomId === "string" ? data.chatRoomId : chatInv?.chatRoomId ?? null;

    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data,
      inviteId: r.inviteId,
      projectId: projectInv?.projectId ?? null,
      chatRoomId,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      projectName: projectInv?.project.name ?? chatInv?.chatRoom.title ?? null,
      canRespond: canRespondProject || canRespondChat,
    };
  });
}
