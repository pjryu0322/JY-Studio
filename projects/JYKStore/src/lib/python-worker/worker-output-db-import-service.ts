/**
 * P3: reflect validated Python Worker output into the Store DB.
 *
 * Responsibilities:
 * - Persist `chunks.json` as `KnowledgeChunk`
 * - Persist `embeddings.json` as `KnowledgeChunkEmbedding` (mapped to the newly
 *   created chunk ids)
 *
 * Non-responsibilities (kept out of this slice):
 * - `prepareWorkerOutputImport` still owns validation + payload creation
 * - It must NOT regenerate chunks / call `docling-nd-knowledge-builder`
 * - `SearchIndexVector` / pgvector upsert is deferred to P4
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IMPORT_CHANNELS } from "@/lib/python-worker/import-channel";
import type { WorkerOutputImportPayload } from "@/lib/python-worker/worker-output-import-service";

/** chunkType for chunks imported from the ZIP Worker path. */
export const WORKER_RETRIEVAL_CHUNK_TYPE = "WORKER_RETRIEVAL_CHUNK";

export class WorkerOutputDbImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WorkerOutputDbImportError";
    this.code = code;
  }
}

type PrismaClientLike = typeof prisma;

export type WorkerOutputDbImportInput = {
  payload: WorkerOutputImportPayload;
  searchIndexGenerationId?: string;
  chunkGenerationId?: string;
  sourceDocumentIdByPath?: Record<string, string>;
  prismaClient?: PrismaClientLike;
  /** pgvector reflection is P4; passing true throws until implemented. */
  requirePgvector?: boolean;
};

export type WorkerOutputDbImportResult = {
  packVersionId: string;
  chunkGenerationId: string | null;
  searchIndexGenerationId: string | null;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  /** worker chunkId -> Store KnowledgeChunk.id */
  chunkIdByWorkerChunkId: Record<string, string>;
  pgvectorReflected: boolean;
};

export type WorkerChunkCreatePlan = {
  workerChunkId: string;
  traceId: string;
  sortOrder: number;
  data: {
    versionId: string;
    sourceDocumentId: string | null;
    chunkType: string;
    title: string;
    content: string;
    section: string | null;
    tags: string[];
    metadata: Prisma.InputJsonValue;
    chunkGenerationId: string | null;
    sortOrder: number;
    isActive: boolean;
  };
};

export type WorkerEmbeddingCreatePlan = {
  workerChunkId: string;
  versionId: string;
  provider: string;
  model: string;
  dimension: number;
  vector: number[];
  contentHash: string;
  searchIndexGenerationId: string | null;
};

export type WorkerOutputImportPlan = {
  packVersionId: string;
  chunkGenerationId: string | null;
  searchIndexGenerationId: string | null;
  chunkPlans: WorkerChunkCreatePlan[];
  embeddingPlanByWorkerChunkId: Map<string, WorkerEmbeddingCreatePlan>;
};

function resolveTags(chunk: WorkerOutputImportPayload["chunks"][number]): string[] {
  const raw = Array.isArray(chunk.tags)
    ? chunk.tags
    : Array.isArray(chunk.keywords)
      ? chunk.keywords
      : [];
  return raw.filter((t): t is string => typeof t === "string");
}

/**
 * Re-assert payload safety before any DB write. Throws WorkerOutputDbImportError.
 * Validation itself is already done by prepareWorkerOutputImport; this is a
 * defensive gate right before persistence.
 */
export function assertWorkerOutputImportable(
  payload: WorkerOutputImportPayload,
): void {
  if (payload.importChannel !== IMPORT_CHANNELS.WORKER_ZIP_IMPORT) {
    throw new WorkerOutputDbImportError(
      "IMPORT_CHANNEL_INVALID",
      `unexpected import channel: ${payload.importChannel}`,
    );
  }
  if ((payload.validationReport.errors?.length ?? 0) > 0) {
    throw new WorkerOutputDbImportError(
      "VALIDATION_REPORT_HAS_ERRORS",
      "worker validation_report has errors; refusing DB import",
    );
  }
  if (payload.validationReport.status !== "ok") {
    throw new WorkerOutputDbImportError(
      "VALIDATION_STATUS_NOT_OK",
      `validation_report.status must be "ok" for DB import (got "${payload.validationReport.status ?? "unknown"}")`,
    );
  }
  if (payload.chunks.length !== payload.embeddings.length) {
    throw new WorkerOutputDbImportError(
      "CHUNK_EMBEDDING_COUNT_MISMATCH",
      `chunks (${payload.chunks.length}) and embeddings (${payload.embeddings.length}) count mismatch`,
    );
  }
  const chunkIds = new Set(payload.chunks.map((c) => c.chunkId));
  const seen = new Set<string>();
  for (const emb of payload.embeddings) {
    if (!chunkIds.has(emb.chunkId)) {
      throw new WorkerOutputDbImportError(
        "EMBEDDING_CHUNK_NOT_FOUND",
        `embedding references unknown chunkId: ${emb.chunkId}`,
      );
    }
    if (seen.has(emb.chunkId)) {
      throw new WorkerOutputDbImportError(
        "EMBEDDING_DUPLICATE_CHUNK",
        `duplicate embedding for chunkId: ${emb.chunkId}`,
      );
    }
    seen.add(emb.chunkId);
  }
}

/**
 * Build a pure (no-DB) import plan from a validated payload.
 * Exposed for unit tests and callers that want to inspect the plan.
 */
export function buildWorkerOutputImportPlan(
  input: Pick<
    WorkerOutputDbImportInput,
    "payload" | "searchIndexGenerationId" | "chunkGenerationId" | "sourceDocumentIdByPath"
  >,
): WorkerOutputImportPlan {
  const { payload } = input;
  assertWorkerOutputImportable(payload);

  const chunkGenerationId = input.chunkGenerationId ?? null;
  const searchIndexGenerationId = input.searchIndexGenerationId ?? null;
  const sourceDocumentIdByPath = input.sourceDocumentIdByPath ?? {};
  const traceById = new Map(payload.sourceTraces.map((t) => [t.traceId, t]));

  const chunkPlans: WorkerChunkCreatePlan[] = payload.chunks.map((chunk, index) => {
    const tags = resolveTags(chunk);
    const trace = traceById.get(chunk.traceId);
    const metadata: Record<string, unknown> = {
      importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
      workerChunkId: chunk.chunkId,
      traceId: chunk.traceId,
      sourcePath: chunk.sourcePath,
      sourceType: chunk.sourceType ?? null,
      symbols: Array.isArray(chunk.symbols) ? chunk.symbols : [],
      keywords: Array.isArray(chunk.keywords) ? chunk.keywords : [],
      codeBlocks: Array.isArray(chunk.codeBlocks) ? chunk.codeBlocks : [],
      pipelineRunId: payload.pipelineRunId,
      indexGenerationId: searchIndexGenerationId,
      chunkGenerationId,
      sourceTrace: trace ? { ...trace } : null,
    };
    return {
      workerChunkId: chunk.chunkId,
      traceId: chunk.traceId,
      sortOrder: index,
      data: {
        versionId: payload.packVersionId,
        sourceDocumentId: sourceDocumentIdByPath[chunk.sourcePath] ?? null,
        chunkType: WORKER_RETRIEVAL_CHUNK_TYPE,
        title: chunk.title ?? "",
        content: chunk.content,
        section: chunk.section ?? null,
        tags,
        metadata: metadata as Prisma.InputJsonValue,
        chunkGenerationId,
        sortOrder: index,
        isActive: true,
      },
    };
  });

  const embeddingByChunk = new Map(payload.embeddings.map((e) => [e.chunkId, e]));
  const embeddingPlanByWorkerChunkId = new Map<string, WorkerEmbeddingCreatePlan>();
  for (const chunk of payload.chunks) {
    const emb = embeddingByChunk.get(chunk.chunkId);
    if (!emb) {
      throw new WorkerOutputDbImportError(
        "CHUNK_EMBEDDING_MISSING",
        `chunk ${chunk.chunkId} has no embedding`,
      );
    }
    embeddingPlanByWorkerChunkId.set(chunk.chunkId, {
      workerChunkId: chunk.chunkId,
      versionId: payload.packVersionId,
      provider: emb.provider,
      model: emb.model,
      dimension: emb.dimension,
      vector: emb.vector,
      contentHash: emb.contentHash,
      searchIndexGenerationId,
    });
  }

  return {
    packVersionId: payload.packVersionId,
    chunkGenerationId,
    searchIndexGenerationId,
    chunkPlans,
    embeddingPlanByWorkerChunkId,
  };
}

/**
 * Persist a validated Worker output payload into Store DB in one transaction.
 * Chunk + embedding writes are atomic: an embedding failure rolls back chunks.
 */
export async function importWorkerOutputToStoreDb(
  input: WorkerOutputDbImportInput,
): Promise<WorkerOutputDbImportResult> {
  if (input.requirePgvector) {
    throw new WorkerOutputDbImportError(
      "PGVECTOR_REFLECTION_NOT_IMPLEMENTED",
      "pgvector/SearchIndexVector reflection is deferred to P4",
    );
  }

  const plan = buildWorkerOutputImportPlan(input);
  const client = input.prismaClient ?? prisma;

  const chunkIdByWorkerChunkId = await client.$transaction(async (tx) => {
    // Re-run policy: clear only this generation's chunks (cascade removes their
    // embeddings); other generations are untouched.
    if (plan.chunkGenerationId) {
      await tx.knowledgeChunk.deleteMany({
        where: {
          versionId: plan.packVersionId,
          chunkGenerationId: plan.chunkGenerationId,
        },
      });
    } else if (plan.searchIndexGenerationId) {
      await tx.knowledgeChunkEmbedding.deleteMany({
        where: { searchIndexGenerationId: plan.searchIndexGenerationId },
      });
    }

    const mapping: Record<string, string> = {};
    for (const chunkPlan of plan.chunkPlans) {
      const created = await tx.knowledgeChunk.create({
        data: chunkPlan.data,
        select: { id: true },
      });
      mapping[chunkPlan.workerChunkId] = created.id;
    }

    for (const [workerChunkId, embeddingPlan] of plan.embeddingPlanByWorkerChunkId) {
      const chunkId = mapping[workerChunkId];
      if (!chunkId) {
        throw new WorkerOutputDbImportError(
          "CHUNK_ID_MAPPING_MISSING",
          `no created chunk id for worker chunk ${workerChunkId}`,
        );
      }
      await tx.knowledgeChunkEmbedding.create({
        data: {
          chunkId,
          versionId: embeddingPlan.versionId,
          provider: embeddingPlan.provider,
          model: embeddingPlan.model,
          dimension: embeddingPlan.dimension,
          vector: embeddingPlan.vector as unknown as Prisma.InputJsonValue,
          contentHash: embeddingPlan.contentHash,
          searchIndexGenerationId: embeddingPlan.searchIndexGenerationId ?? undefined,
        },
      });
    }

    // Count-only update for an existing generation; status transitions stay with
    // the search-data pipeline (avoid conflicting with its state machine).
    if (plan.searchIndexGenerationId) {
      const generation = await tx.searchIndexGeneration.findUnique({
        where: { id: plan.searchIndexGenerationId },
        select: { id: true },
      });
      if (generation) {
        await tx.searchIndexGeneration.update({
          where: { id: plan.searchIndexGenerationId },
          data: {
            chunkCount: plan.chunkPlans.length,
            embeddedCount: plan.embeddingPlanByWorkerChunkId.size,
            failedCount: 0,
          },
        });
      }
    }

    return mapping;
  });

  return {
    packVersionId: plan.packVersionId,
    chunkGenerationId: plan.chunkGenerationId,
    searchIndexGenerationId: plan.searchIndexGenerationId,
    importedChunkCount: plan.chunkPlans.length,
    importedEmbeddingCount: plan.embeddingPlanByWorkerChunkId.size,
    chunkIdByWorkerChunkId,
    pgvectorReflected: false,
  };
}
