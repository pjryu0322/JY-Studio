import { prisma } from "@/lib/prisma";
import { PUBLIC_PACK_STATUSES } from "./retrieval-config";
import type { RetrievalPackContext } from "./retrieval-types";

/**
 * knowledgePackId로 PUBLISHED/VERIFIED pack과 최신 version 1개를 조회한다.
 * - 비공개 pack이면 null
 * - version이 없으면 null
 * NOTE: packId 전용 API Key 권한은 향후 확장 예정이다.
 */
export async function loadPublicRetrievalPack(
  knowledgePackId: string,
): Promise<RetrievalPackContext | null> {
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: knowledgePackId,
      status: { in: [...PUBLIC_PACK_STATUSES] },
    },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!pack || pack.versions.length === 0) {
    return null;
  }

  return { packId: pack.packId, versionId: pack.versions[0]!.id };
}
