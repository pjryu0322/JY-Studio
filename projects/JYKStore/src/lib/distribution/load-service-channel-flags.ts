import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import type { ServiceChannelFlags } from "@/lib/distribution/service-channel-policy";

/**
 * Load service channel flags for the latest version of a pack.
 * Defaults preserve pre-migration behavior (API/MCP on) when metadata is missing.
 */
export async function loadServiceChannelFlagsForPack(
  packId: string,
): Promise<ServiceChannelFlags | null> {
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: { distributionMetadata: true },
      },
    },
  });
  const meta = pack?.versions[0]?.distributionMetadata;
  if (!meta) {
    return {
      allowApi: true,
      allowMcp: true,
      allowDownload: false,
      serviceEndsAt: null,
    };
  }
  return {
    allowApi: meta.allowApi,
    allowMcp: meta.allowMcp,
    allowDownload: meta.allowDownload,
    serviceEndsAt: meta.serviceEndsAt,
  };
}
