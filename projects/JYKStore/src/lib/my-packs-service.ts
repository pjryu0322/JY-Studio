import { InstallationStatus, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toKnowledgePackDto, type PrismaKnowledgePackWithVersion } from "@/lib/pack-dto";

export const knowledgePackInclude = {
  category: true,
  versions: {
    orderBy: { createdAt: "desc" as const },
  },
};

export async function listActiveMyPacksForClient(clientId: string) {
  const installations = await prisma.packInstallation.findMany({
    where: {
      clientId,
      status: InstallationStatus.ACTIVE,
    },
    include: {
      pack: {
        include: knowledgePackInclude,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return installations
    .map((row) => row.pack)
    .filter((pack): pack is PrismaKnowledgePackWithVersion => Boolean(pack))
    .map(toKnowledgePackDto);
}

export async function findPublishedPack(packId: string) {
  return prisma.knowledgePack.findUnique({
    where: { packId },
    include: knowledgePackInclude,
  });
}

export async function addPackInstallationForClient(clientId: string, packId: string) {
  const pack = await findPublishedPack(packId);

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.PUBLISHED) {
    return { error: "NOT_PUBLISHED" as const, pack };
  }

  const installation = await prisma.packInstallation.upsert({
    where: {
      clientId_packId: { clientId, packId },
    },
    create: {
      clientId,
      packId,
      status: InstallationStatus.ACTIVE,
    },
    update: {
      status: InstallationStatus.ACTIVE,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "INSTALL",
      entityType: "PackInstallation",
      entityId: installation.id,
      metadata: { clientId, packId },
    },
  });

  return { installation, pack: toKnowledgePackDto(pack) };
}

export async function removePackInstallationForClient(clientId: string, packId: string) {
  const installation = await prisma.packInstallation.findUnique({
    where: {
      clientId_packId: { clientId, packId },
    },
  });

  if (!installation) {
    return { removed: false as const };
  }

  if (installation.status !== InstallationStatus.REMOVED) {
    await prisma.packInstallation.update({
      where: { id: installation.id },
      data: { status: InstallationStatus.REMOVED },
    });

    await prisma.auditLog.create({
      data: {
        action: "REMOVE",
        entityType: "PackInstallation",
        entityId: installation.id,
        metadata: { clientId, packId },
      },
    });
  }

  return { removed: true as const };
}
