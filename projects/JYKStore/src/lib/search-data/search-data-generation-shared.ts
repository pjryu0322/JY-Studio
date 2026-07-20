import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { mapSearchDataFailureCode } from "@/lib/search-data/search-data-error";

export async function assertPgvectorRuntimeReady(): Promise<void> {
  const ext = await prisma.$queryRaw<Array<{ extversion: string }>>`
    SELECT extversion FROM pg_extension WHERE extname = 'vector'
  `;
  if (ext.length !== 1) {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.",
    );
  }
  const table = await prisma.$queryRaw<Array<{ reg: string | null }>>`
    SELECT to_regclass('"SearchIndexVector"')::text AS reg
  `;
  const reg = table[0]?.reg;
  if (reg !== "SearchIndexVector" && reg !== '"SearchIndexVector"') {
    throw new EmbeddingProviderError(
      "SEARCH_RUNTIME_UNAVAILABLE",
      "검색 저장소를 사용할 수 없습니다. 관리자에게 문의 바랍니다.",
    );
  }
}

export async function countVectorsForGeneration(generationId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "SearchIndexVector"
    WHERE "searchIndexGenerationId" = ${generationId}
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function countRetrievalChunksForGeneration(input: {
  versionId: string;
  indexGenerationId: string;
}): Promise<number> {
  return prisma.knowledgeChunk.count({
    where: {
      versionId: input.versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      OR: [
        { chunkGenerationId: input.indexGenerationId },
        {
          AND: [
            { chunkGenerationId: null },
            { metadata: { path: ["indexGenerationId"], equals: input.indexGenerationId } },
          ],
        },
      ],
    },
  });
}

export async function loadOwnedPack(input: { userId: string; clientId: string; packId: string }) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) return { ok: false as const, error: "PROFILE_REQUIRED" as const };
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  if (!pack) return { ok: false as const, error: "NOT_FOUND" as const };
  return { ok: true as const, profile, pack };
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function failureResponse(code: string, overrideMessage?: string) {
  const guidance = mapSearchDataFailureCode(code);
  return {
    error: "INVALID" as const,
    message: overrideMessage ?? guidance.message,
    code,
  };
}
