import { InstallationStatus, PackStatus, type Prisma } from "@prisma/client";
import {
  canInstallLatestDistributionPack,
  canShowInstalledPackInMyPacks,
  distributionVersionAccessInclude,
  latestKnowledgePackVersionOrderBy,
  resolveLatestDistributionState,
} from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import { toKnowledgePackDto, type PrismaKnowledgePackWithVersion } from "@/lib/pack-dto";

const installablePackStatuses: PackStatus[] = [PackStatus.PUBLISHED, PackStatus.VERIFIED];

const myPacksInclude = {
  category: true,
  versions: {
    orderBy: latestKnowledgePackVersionOrderBy,
    include: distributionVersionAccessInclude,
  },
} satisfies Prisma.KnowledgePackInclude;

type MyPacksPackRow = Prisma.KnowledgePackGetPayload<{
  include: typeof myPacksInclude;
}>;

function isInstallablePackStatus(status: PackStatus) {
  return installablePackStatuses.includes(status);
}

function toDto(pack: MyPacksPackRow) {
  return toKnowledgePackDto(pack as unknown as PrismaKnowledgePackWithVersion);
}

export async function listActiveMyPacksForClient(clientId: string) {
  const installations = await prisma.packInstallation.findMany({
    where: {
      clientId,
      status: InstallationStatus.ACTIVE,
    },
    include: {
      pack: {
        include: myPacksInclude,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return installations
    .map((row) => row.pack)
    .filter((pack): pack is MyPacksPackRow => Boolean(pack))
    .filter((pack) =>
      canShowInstalledPackInMyPacks(resolveLatestDistributionState(pack.versions[0])),
    )
    .map(toDto);
}

export async function findPublishedPack(packId: string) {
  return prisma.knowledgePack.findUnique({
    where: { packId },
    include: myPacksInclude,
  });
}

export async function addPackInstallationForClient(clientId: string, packId: string) {
  const pack = await findPublishedPack(packId);

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (!isInstallablePackStatus(pack.status)) {
    return { error: "NOT_PUBLISHED" as const, pack };
  }

  const latestState = resolveLatestDistributionState(pack.versions[0]);
  if (!canInstallLatestDistributionPack(latestState)) {
    // Hide PRIVATE / INVALID distribution packs from install API.
    return { error: "NOT_INSTALLABLE" as const };
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

  return { installation, pack: toDto(pack) };
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
