import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PACK_STATUSES } from "@/lib/knowledge-pack-public";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";

/**
 * public export용 pack 조회. PUBLISHED/VERIFIED pack만 허용한다.
 * 비공개/없는 pack이면 null → route에서 404 처리.
 */
export function loadPublicKnowledgePack<const S extends Prisma.KnowledgePackSelect>(
  packId: string,
  select: S,
): Promise<Prisma.KnowledgePackGetPayload<{ select: S }> | null> {
  return prisma.knowledgePack.findFirst({
    where: { packId, status: { in: [...PUBLIC_PACK_STATUSES] } },
    select,
  }) as Promise<Prisma.KnowledgePackGetPayload<{ select: S }> | null>;
}

/**
 * 최신 version(원본 문서 + 활성 chunk 포함) 1개 조회.
 */
export function loadLatestPackVersion(packId: string) {
  return prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    include: {
      sourceDocuments: { orderBy: { createdAt: "asc" } },
      chunks: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

/**
 * 저장된 metadata를 canonical/민감 key 제거 후에만 export한다.
 */
export function sanitizeExportMetadata(raw: unknown): Record<string, unknown> | null {
  const result = validateAndNormalizeChunkMetadata(raw);
  if (result.ok && result.metadata) {
    return result.metadata as Record<string, unknown>;
  }
  return null;
}

export function buildExportGeneratedAt(): string {
  return new Date().toISOString();
}
