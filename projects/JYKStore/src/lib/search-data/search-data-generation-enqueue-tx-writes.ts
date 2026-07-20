/**
 * Enqueue transaction write helpers (update / delete / create).
 */
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { markServiceValidationsStaleForVersion } from "@/lib/distribution/mark-service-validations-stale";
import type { KnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { createSearchGenerationForPipeline } from "@/lib/search-generation/search-generation-pipeline-sync";
import type { SearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function countVectorsForGenerationTx(
  tx: Tx,
  indexGenerationId: string,
): Promise<number> {
  const vectors = await tx.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "SearchIndexVector"
    WHERE "searchIndexGenerationId" = ${indexGenerationId}
  `;
  return Number(vectors[0]?.n ?? 0);
}

export async function reuseScaffoldGenerationTx(input: {
  tx: Tx;
  versionId: string;
  latestPipelineRunId: string;
  binding: KnowledgeRunBinding;
  indexGenerationId: string;
  chunkCount: number;
}): Promise<{ id: string; attempt: number }> {
  const { tx, versionId, latestPipelineRunId, binding, indexGenerationId, chunkCount } = input;
  const updated = await tx.searchIndexGeneration.updateMany({
    where: {
      id: indexGenerationId,
      scope: "DRAFT",
      status: "PENDING",
      attempt: 0,
      chunkGenerationId: indexGenerationId,
      pipelineRunId: latestPipelineRunId,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
    },
    data: {
      attempt: 1,
      chunkCount,
      embeddedCount: 0,
      failedCount: 0,
      failureCode: null,
      failureMessage: null,
      startedAt: null,
    },
  });
  if (updated.count !== 1) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "검색데이터 생성 상태가 변경되었습니다. 화면을 새로고침해 주세요.",
      409,
    );
  }
  const generation = await tx.searchIndexGeneration.findUniqueOrThrow({
    where: { id: indexGenerationId },
  });
  await markServiceValidationsStaleForVersion(versionId, tx);
  return generation;
}

export async function deleteDraftGenerationArtifactsTx(
  tx: Tx,
  indexGenerationId: string,
): Promise<void> {
  await tx.$executeRaw`
    DELETE FROM "SearchIndexVector" WHERE "searchIndexGenerationId" = ${indexGenerationId}
  `;
  await tx.knowledgeChunkEmbedding.deleteMany({
    where: { searchIndexGenerationId: indexGenerationId },
  });
  await tx.searchIndexGeneration.delete({ where: { id: indexGenerationId } });
}

export async function createEnqueuedGenerationTx(input: {
  tx: Tx;
  packId: string;
  versionId: string;
  latestPipelineRunId: string;
  binding: KnowledgeRunBinding;
  indexGenerationId: string;
  chunkCount: number;
  descriptor: SearchGenerationEmbeddingDescriptor;
  attempt: number;
}): Promise<{ id: string; attempt: number }> {
  const {
    tx,
    packId,
    versionId,
    latestPipelineRunId,
    binding,
    indexGenerationId,
    chunkCount,
    descriptor,
    attempt,
  } = input;

  const created = await createSearchGenerationForPipeline({
    id: indexGenerationId,
    packId,
    versionId,
    pipelineRunId: latestPipelineRunId,
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint,
    chunkGenerationId: indexGenerationId,
    descriptor,
    attempt,
    client: tx,
  });

  await tx.searchIndexGeneration.update({
    where: { id: created.id },
    data: {
      chunkCount,
      embeddedCount: 0,
      failedCount: 0,
      failureCode: null,
      failureMessage: null,
    },
  });

  await markServiceValidationsStaleForVersion(versionId, tx);
  return created;
}
