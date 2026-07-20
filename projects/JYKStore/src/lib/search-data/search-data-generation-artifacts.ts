/**
 * Vector / embedding artifact cleanup for a SearchIndexGeneration.
 * Generation row delete stays separate — different domain meaning.
 */
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Deletes SearchIndexVector + KnowledgeChunkEmbedding rows for a generation. */
export async function deleteSearchDataGenerationArtifactsTx(
  tx: Tx,
  searchIndexGenerationId: string,
): Promise<void> {
  await tx.$executeRaw`
    DELETE FROM "SearchIndexVector"
    WHERE "searchIndexGenerationId" = ${searchIndexGenerationId}
  `;
  await tx.knowledgeChunkEmbedding.deleteMany({
    where: { searchIndexGenerationId },
  });
}

/** Deletes the DRAFT SearchIndexGeneration row after artifacts are cleared. */
export async function deleteSearchDataGenerationRowTx(
  tx: Tx,
  searchIndexGenerationId: string,
): Promise<void> {
  await tx.searchIndexGeneration.delete({ where: { id: searchIndexGenerationId } });
}

/**
 * Force-regenerate path: clear vectors/embeddings then delete the generation row.
 * Caller must already assert DRAFT scope (never PRODUCTION).
 */
export async function deleteDraftGenerationWithArtifactsTx(
  tx: Tx,
  searchIndexGenerationId: string,
): Promise<void> {
  await deleteSearchDataGenerationArtifactsTx(tx, searchIndexGenerationId);
  await deleteSearchDataGenerationRowTx(tx, searchIndexGenerationId);
}
