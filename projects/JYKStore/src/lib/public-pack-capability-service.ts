import { PackStatus } from "@prisma/client";
import {
  distributionVersionAccessInclude,
  latestKnowledgePackVersionOrderBy,
} from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import {
  buildPublicPackCapabilityInputFromVersion,
  resolvePublicPackCapabilities,
  type PublicPackCapabilities,
} from "@/lib/public-pack-capability";

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

export type PublicPackCapabilityLookup = {
  packId: string;
  packStatus: PackStatus;
  capabilities: PublicPackCapabilities;
};

export async function loadPublishedPackCapabilities(
  packId: string,
  options?: { catalogPurpose?: "list" | "detail" },
): Promise<PublicPackCapabilityLookup | null> {
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      status: { in: [...publishedStatuses] },
    },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: distributionVersionAccessInclude,
      },
    },
  });

  if (!pack || pack.versions.length === 0) {
    return null;
  }

  const capabilities = resolvePublicPackCapabilities(
    buildPublicPackCapabilityInputFromVersion({
      packStatus: pack.status,
      version: pack.versions[0],
      catalogPurpose: options?.catalogPurpose ?? "detail",
    }),
  );

  return {
    packId: pack.packId,
    packStatus: pack.status,
    capabilities,
  };
}
