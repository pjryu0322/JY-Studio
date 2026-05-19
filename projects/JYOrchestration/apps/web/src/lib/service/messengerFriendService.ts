import { prisma } from "@/lib/prisma";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

export type MessengerFriendRow = {
  id: string;
  displayName: string;
  email: string | null;
};

export async function listMessengerFriends(userId: string): Promise<MessengerFriendRow[]> {
  const uid = userId.trim();
  if (!uid) return [];
  const rows = await prisma.platformUserFriend.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "asc" },
    include: {
      friend: { select: { id: true, name: true, nickname: true, email: true, accountStatus: true } },
    },
  });
  return rows
    .filter((r) => r.friend.accountStatus === "ACTIVE")
    .map((r) => ({
      id: r.friend.id,
      displayName: platformUserDisplayName(r.friend.nickname, r.friend.name) || r.friend.email || r.friend.id,
      email: r.friend.email,
    }));
}

export async function addMessengerFriend(userId: string, friendUserId: string): Promise<MessengerFriendRow | null> {
  const uid = userId.trim();
  const fid = friendUserId.trim();
  if (!uid || !fid || uid === fid) return null;

  const friend = await prisma.user.findFirst({
    where: { id: fid, accountStatus: "ACTIVE" },
    select: { id: true, name: true, nickname: true, email: true },
  });
  if (!friend) return null;

  await prisma.platformUserFriend.upsert({
    where: { userId_friendUserId: { userId: uid, friendUserId: fid } },
    create: { userId: uid, friendUserId: fid },
    update: {},
  });

  return {
    id: friend.id,
    displayName: platformUserDisplayName(friend.nickname, friend.name) || friend.email || friend.id,
    email: friend.email,
  };
}

export async function removeMessengerFriend(userId: string, friendUserId: string): Promise<boolean> {
  const r = await prisma.platformUserFriend.deleteMany({
    where: { userId: userId.trim(), friendUserId: friendUserId.trim() },
  });
  return r.count > 0;
}

export async function assertMessengerFriends(userId: string, friendUserIds: readonly string[]): Promise<boolean> {
  const uid = userId.trim();
  const ids = [...new Set(friendUserIds.map((x) => String(x ?? "").trim()).filter(Boolean))].filter((id) => id !== uid);
  if (!ids.length) return true;
  const count = await prisma.platformUserFriend.count({
    where: { userId: uid, friendUserId: { in: ids } },
  });
  return count === ids.length;
}

export async function isMessengerFriend(userId: string, friendUserId: string): Promise<boolean> {
  const count = await prisma.platformUserFriend.count({
    where: { userId: userId.trim(), friendUserId: friendUserId.trim() },
  });
  return count > 0;
}
