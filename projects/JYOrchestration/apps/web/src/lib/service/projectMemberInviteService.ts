import { Prisma, type ProjectMemberInviteStatus, type ProjectMemberRole } from "@prisma/client";
import type { ProjectRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

export const NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE = "PROJECT_MEMBER_INVITE";

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
  updateMany: (args: { where: { id: string; userId: string }; data: { readAt: Date } }) => Promise<{ count: number }>;
};

/** 스키마 반영 전·잠금 등으로 `prisma generate`가 안 된 환경에서 런타임 undefined 방지 */
function prismaPlatformNotificationTable(): PlatformNotificationDelegate | null {
  const d = (prisma as unknown as { platformNotification?: PlatformNotificationDelegate }).platformNotification;
  return d ?? null;
}

export type CreateHumanInviteResult =
  | { outcome: "USER_NOT_FOUND" }
  | { outcome: "ALREADY_MEMBER" }
  | { outcome: "INVITE_SENT"; inviteId: string; notificationId: string };

function toPrismaRole(role: ProjectRole): ProjectMemberRole {
  return role as ProjectMemberRole;
}

/**
 * 가입된 플랫폼 사용자에게만 적용. 멤버십 생성은 수락 시 수행.
 * 이메일 발송 없이 인앱 알림만 생성.
 */
export async function createHumanProjectMemberInvite(input: {
  projectId: string;
  email: string;
  role: ProjectRole;
  invitedByUserId: string;
}): Promise<CreateHumanInviteResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, nickname: true, email: true },
  });
  if (!user) {
    return { outcome: "USER_NOT_FOUND" };
  }

  const existingMember = await prisma.projectMember.findFirst({
    where: { projectId: input.projectId, userId: user.id, memberType: "HUMAN" },
    select: { id: true },
  });
  if (existingMember) {
    return { outcome: "ALREADY_MEMBER" };
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true },
  });
  const projectName = project?.name?.trim() || "프로젝트";

  return prisma.$transaction(async (tx) => {
    const role = toPrismaRole(input.role);
    const invite = await tx.projectMemberInvite.upsert({
      where: {
        projectId_inviteeUserId: { projectId: input.projectId, inviteeUserId: user.id },
      },
      create: {
        projectId: input.projectId,
        inviteeUserId: user.id,
        invitedByUserId: input.invitedByUserId,
        role,
        status: "PENDING",
      },
      update: {
        invitedByUserId: input.invitedByUserId,
        role,
        status: "PENDING" as ProjectMemberInviteStatus,
        respondedAt: null,
      },
    });

    const notif = await tx.platformNotification.create({
      data: {
        userId: user.id,
        type: NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE,
        title: "프로젝트 초대",
        body: `「${projectName}」프로젝트에 초대되었습니다. 수락하시겠어요?`,
        inviteId: invite.id,
        data: {
          inviteId: invite.id,
          projectId: input.projectId,
          projectName,
          role: input.role,
        },
      },
    });

    return { outcome: "INVITE_SENT" as const, inviteId: invite.id, notificationId: notif.id };
  });
}

export async function acceptProjectMemberInvite(input: { inviteId: string; sessionUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.projectMemberInvite.findFirst({
      where: {
        id: input.inviteId,
        inviteeUserId: input.sessionUserId,
        status: "PENDING",
      },
      include: {
        project: { select: { id: true, name: true, ownerUserId: true } },
        invitee: { select: { name: true, nickname: true, email: true } },
      },
    });
    if (!inv) {
      return { ok: false as const, code: "NOT_FOUND" as const };
    }

    const displayName = platformUserDisplayName(inv.invitee.nickname, inv.invitee.name);

    await tx.projectMemberInvite.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: inv.projectId, userId: inv.inviteeUserId } },
      create: {
        projectId: inv.projectId,
        userId: inv.inviteeUserId,
        memberType: "HUMAN",
        role: inv.role,
        displayName,
        invitedByUserId: inv.invitedByUserId,
      },
      update: {
        role: inv.role,
        displayName,
        invitedByUserId: inv.invitedByUserId,
      },
    });

    await tx.platformNotification.updateMany({
      where: {
        userId: input.sessionUserId,
        inviteId: inv.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { ok: true as const, projectId: inv.projectId };
  });
}

export async function declineProjectMemberInvite(input: { inviteId: string; sessionUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.projectMemberInvite.findFirst({
      where: {
        id: input.inviteId,
        inviteeUserId: input.sessionUserId,
        status: "PENDING",
      },
    });
    if (!inv) {
      return { ok: false as const, code: "NOT_FOUND" as const };
    }
    await tx.projectMemberInvite.update({
      where: { id: inv.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await tx.platformNotification.updateMany({
      where: {
        userId: input.sessionUserId,
        inviteId: inv.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  });
}

export type PlatformNotificationListItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  inviteId: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
  projectName: string | null;
  canRespond: boolean;
};

export async function listMyPlatformNotifications(userId: string, take = 30): Promise<PlatformNotificationListItem[]> {
  const pn = prismaPlatformNotificationTable();
  if (!pn) {
    return [];
  }
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

  const inviteIds = rows.map((r) => r.inviteId).filter((x): x is string => Boolean(x));
  const invites =
    inviteIds.length > 0
      ? await prisma.projectMemberInvite.findMany({
          where: { id: { in: inviteIds } },
          include: { project: { select: { name: true } } },
        })
      : [];
  const inviteById = new Map(invites.map((i) => [i.id, i]));

  return rows.map((r) => {
    const inv = r.inviteId ? inviteById.get(r.inviteId) : undefined;
    const canRespond = Boolean(
      r.type === NOTIFICATION_TYPE_PROJECT_MEMBER_INVITE && inv && inv.status === "PENDING" && r.inviteId
    );
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data,
      inviteId: r.inviteId,
      projectId: inv?.projectId ?? null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      projectName: inv?.project.name ?? null,
      canRespond,
    };
  });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const pn = prismaPlatformNotificationTable();
  if (!pn) return false;
  try {
    const r = await pn.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return r.count > 0;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return false;
    }
    throw e;
  }
}
