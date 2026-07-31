import { prisma } from "@/lib/prisma";
import { PUBLIC_PACK_STATUSES } from "./retrieval-config";
import type { RetrievalPackContext } from "./retrieval-types";

/**
 * knowledgePackId로 PUBLISHED/VERIFIED pack과 공개 서빙 version을 조회한다.
 * - 비공개 pack이면 null
 * - version이 없으면 null
 *
 * Version selection (P9): prefer the version that owns the current PRODUCTION+PROMOTED
 * SearchIndexGeneration for this pack. Do not pick an arbitrary newest `createdAt` draft
 * version while a published generation still points at an older version.
 * Fallback: latest createdAt only when no PRODUCTION generation exists (legacy packs).
 */
export async function loadPublicRetrievalPack(
  knowledgePackId: string,
): Promise<RetrievalPackContext | null> {
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: knowledgePackId,
      status: { in: [...PUBLIC_PACK_STATUSES] },
    },
    select: { packId: true },
  });
  if (!pack) return null;

  const production = await prisma.searchIndexGeneration.findFirst({
    where: {
      packId: knowledgePackId,
      scope: "PRODUCTION",
      status: "PROMOTED",
    },
    orderBy: { promotedAt: "desc" },
    select: { versionId: true },
  });

  const version = production
    ? await prisma.knowledgePackVersion.findFirst({
        where: { id: production.versionId, packId: knowledgePackId },
        include: { distributionMetadata: true },
      })
    : await prisma.knowledgePackVersion.findFirst({
        where: { packId: knowledgePackId },
        orderBy: { createdAt: "desc" },
        include: { distributionMetadata: true },
      });

  if (!version) return null;

  const meta = version.distributionMetadata;
  return {
    packId: pack.packId,
    versionId: version.id,
    allowApi: meta?.allowApi ?? true,
    allowMcp: meta?.allowMcp ?? true,
    allowDownload: meta?.allowDownload ?? false,
    serviceEndsAt: meta?.serviceEndsAt ?? null,
  };
}
