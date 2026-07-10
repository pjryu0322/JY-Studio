import { prisma } from "@/lib/prisma";
import { parseAccountRole, type AccountRole } from "@/lib/account-role";

export type AdminAccountListItem = {
  id: string;
  email: string | null;
  name: string | null;
  accountRole: AccountRole;
  createdAt: string;
  updatedAt: string;
  hasProviderProfile: boolean;
  providerDisplayName: string | null;
  packCount: number;
};

export async function listRegisteredAccounts(): Promise<AdminAccountListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      providerProfiles: {
        select: {
          displayName: true,
          _count: { select: { packs: true } },
        },
      },
    },
  });

  return users.map((user) => {
    const profile = user.providerProfiles[0] ?? null;
    const packCount = user.providerProfiles.reduce((sum, p) => sum + p._count.packs, 0);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      accountRole: parseAccountRole(user.accountRole),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      hasProviderProfile: Boolean(profile),
      providerDisplayName: profile?.displayName ?? null,
      packCount,
    };
  });
}

export async function updateRegisteredAccountRole(input: {
  actorUserId: string;
  targetUserId: string;
  accountRole: AccountRole;
}): Promise<
  | { ok: true; account: AdminAccountListItem }
  | { ok: false; error: "NOT_FOUND" | "LAST_ADMIN" | "SELF_DEMOTE" }
> {
  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    include: {
      providerProfiles: {
        select: {
          displayName: true,
          _count: { select: { packs: true } },
        },
      },
    },
  });
  if (!target) return { ok: false, error: "NOT_FOUND" };

  const nextRole = parseAccountRole(input.accountRole);
  const currentRole = parseAccountRole(target.accountRole);

  if (
    input.actorUserId === input.targetUserId &&
    currentRole === "ADMIN" &&
    nextRole !== "ADMIN"
  ) {
    return { ok: false, error: "SELF_DEMOTE" };
  }

  if (currentRole === "ADMIN" && nextRole !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { accountRole: "ADMIN" } });
    if (adminCount <= 1) {
      return { ok: false, error: "LAST_ADMIN" };
    }
  }

  const updated = await prisma.user.update({
    where: { id: input.targetUserId },
    data: { accountRole: nextRole },
    include: {
      providerProfiles: {
        select: {
          displayName: true,
          _count: { select: { packs: true } },
        },
      },
    },
  });

  const profile = updated.providerProfiles[0] ?? null;
  const packCount = updated.providerProfiles.reduce((sum, p) => sum + p._count.packs, 0);

  return {
    ok: true,
    account: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      accountRole: parseAccountRole(updated.accountRole),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      hasProviderProfile: Boolean(profile),
      providerDisplayName: profile?.displayName ?? null,
      packCount,
    },
  };
}
