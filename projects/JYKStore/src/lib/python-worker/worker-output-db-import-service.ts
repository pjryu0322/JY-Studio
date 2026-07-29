/**
 * P3/P4: reflect validated Python Worker output into the Store DB + vector index.
 *
 * Responsibilities:
 * - Persist `chunks.json` as `KnowledgeChunk`
 * - Persist `embeddings.json` as `KnowledgeChunkEmbedding` (mapped to the newly
 *   created chunk ids)
 * - Mirror each Worker vector into `SearchIndexVector` (pgvector) via the existing
 *   `upsertSearchIndexVector` helper — Store owns all pgvector writes.
 *
 * Non-responsibilities (kept out of this slice):
 * - `prepareWorkerOutputImport` still owns validation + payload creation
 * - It must NOT regenerate chunks / call the Docling ND knowledge builder
 * - The Python Worker never touches DB / Object Storage / pgvector
 *
 * P4 binding rule: Worker output DB import is always scoped to a
 * `SearchIndexGeneration`. The final `chunkGenerationId` is either provided
 * explicitly or resolved from the generation, and re-runs delete the existing
 * chunks for that resolved generation before reinserting.
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IMPORT_CHANNELS } from "@/lib/python-worker/import-channel";
import { WORKER_RETRIEVAL_CHUNK_TYPE } from "@/lib/python-worker/worker-chunk-constants";
import type { WorkerOutputImportPayload } from "@/lib/python-worker/worker-output-import-service";
import {
  deleteSearchIndexVectorsForGeneration,
  upsertSearchIndexVectorsBatch,
} from "@/lib/search-vector/search-vector-store";

export { WORKER_RETRIEVAL_CHUNK_TYPE } from "@/lib/python-worker/worker-chunk-constants";

export class WorkerOutputDbImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WorkerOutputDbImportError";
    this.code = code;
  }
}

type PrismaClientLike = typeof prisma;
type UpsertVectorsBatchFn = typeof upsertSearchIndexVectorsBatch;
type DeleteVectorsForGenerationFn = typeof deleteSearchIndexVectorsForGeneration;

const IMPORTABLE_GENERATION_STATUSES = new Set(["PENDING", "EMBEDDING", "INDEXING"]);

// The import runs inside ONE atomic interactive transaction. Writes are BATCHED
// (chunks + embeddings via createMany, vectors via one multi-row INSERT per
// batch), so a large pack no longer issues thousands of sequential round-trips —
// query count is now a handful of batched statements regardless of chunk count.
// The timeout stays generous so genuinely large imports still finish comfortably,
// but a real hang eventually fails instead of blocking forever.
const WORKER_IMPORT_TX_TIMEOUT_MS = 300_000;
const WORKER_IMPORT_TX_MAX_WAIT_MS = 20_000;

// Rows per createMany statement. Keeps the bound-parameter count well under
// Postgres' ~65535 limit (KnowledgeChunk has ~12 columns → ~12 params/row).
const WORKER_IMPORT_CREATE_MANY_BATCH_SIZE = 1_000;

/** Generation descriptor the import is bound to (subset of SearchIndexGeneration). */
export type ImportSearchGenerationDescriptor = {
  id: string;
  versionId: string;
  chunkGenerationId: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingModelRevision: string;
  embeddingDimension: number;
  status?: string;
  scope?: string;
};

export type WorkerImportExpectedProvenance = {
  pipelineRunId: string;
  inventoryId?: string | null;
  workingCopyId?: string | null;
  sourceRevisionId?: string | null;
  inventoryItemIdByPath?: Record<string, string>;
};

export type WorkerOutputDbImportInput = {
  payload: WorkerOutputImportPayload;
  /** Required (P4): worker output DB import is always bound to a search generation. */
  searchIndexGenerationId?: string;
  chunkGenerationId?: string;
  sourceDocumentIdByPath?: Record<string, string>;
  /** P4.2: reject chunks whose provenance does not match this Generation binding. */
  expectedProvenance?: WorkerImportExpectedProvenance;
  prismaClient?: PrismaClientLike;
  /** true → pgvector must be available (hard fail on unavailable). */
  requirePgvector?: boolean;
  /** Injectable for tests; defaults to the real batched pgvector upsert helper. */
  upsertVectors?: UpsertVectorsBatchFn;
  /** Injectable for tests; defaults to the real pgvector generation-delete helper. */
  deleteVectorsForGeneration?: DeleteVectorsForGenerationFn;
};

export type WorkerOutputDbImportResult = {
  packVersionId: string;
  chunkGenerationId: string;
  searchIndexGenerationId: string;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  /** worker chunkId -> Store KnowledgeChunk.id */
  chunkIdByWorkerChunkId: Record<string, string>;
  pgvectorReflected: boolean;
  vectorUpsertedCount: number;
  vectorSkippedCount: number;
  vectorSyncWarning?: string;
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
    chunkGenerationId: string;
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
  searchIndexGenerationId: string;
};

export type WorkerOutputImportPlan = {
  packVersionId: string;
  chunkGenerationId: string;
  searchIndexGenerationId: string;
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
 * Resolve the chunkGenerationId the import binds to, cross-checking any
 * explicitly requested id against the generation descriptor.
 */
export function resolveWorkerImportChunkGenerationId(
  requestedChunkGenerationId: string | undefined,
  generation: ImportSearchGenerationDescriptor,
): string {
  if (requestedChunkGenerationId) {
    if (requestedChunkGenerationId !== generation.chunkGenerationId) {
      throw new WorkerOutputDbImportError(
        "SEARCH_GENERATION_MISMATCH",
        `chunkGenerationId (${requestedChunkGenerationId}) does not match generation.chunkGenerationId (${generation.chunkGenerationId})`,
      );
    }
    return requestedChunkGenerationId;
  }
  if (!generation.chunkGenerationId) {
    throw new WorkerOutputDbImportError(
      "CHUNK_GENERATION_REQUIRED",
      "no chunkGenerationId provided and generation has none",
    );
  }
  return generation.chunkGenerationId;
}

/**
 * Ensure the bound generation is a current DRAFT still open for import.
 */
export function assertGenerationImportable(
  generation: ImportSearchGenerationDescriptor,
): void {
  if (generation.scope !== "DRAFT") {
    throw new WorkerOutputDbImportError(
      "SEARCH_GENERATION_NOT_CURRENT",
      `generation scope must be DRAFT for import (got "${generation.scope ?? "unknown"}")`,
    );
  }
  if (!generation.status || !IMPORTABLE_GENERATION_STATUSES.has(generation.status)) {
    throw new WorkerOutputDbImportError(
      "SEARCH_GENERATION_NOT_READY",
      `generation status must be PENDING/EMBEDDING/INDEXING for import (got "${generation.status ?? "unknown"}")`,
    );
  }
}

/**
 * Ensure the payload/embeddings are consistent with the bound generation:
 * version, and each embedding's provider/model/dimension (and modelRevision when
 * present) match the generation descriptor.
 */
export function assertGenerationDescriptorMatches(
  payload: WorkerOutputImportPayload,
  generation: ImportSearchGenerationDescriptor,
): void {
  if (generation.versionId !== payload.packVersionId) {
    throw new WorkerOutputDbImportError(
      "SEARCH_GENERATION_MISMATCH",
      `generation.versionId (${generation.versionId}) does not match payload.packVersionId (${payload.packVersionId})`,
    );
  }
  for (const emb of payload.embeddings) {
    if (
      emb.provider !== generation.embeddingProvider ||
      emb.model !== generation.embeddingModel ||
      emb.dimension !== generation.embeddingDimension
    ) {
      throw new WorkerOutputDbImportError(
        "SEARCH_GENERATION_DESCRIPTOR_MISMATCH",
        `embedding descriptor for chunk ${emb.chunkId} does not match generation ` +
          `(provider/model/dimension)`,
      );
    }
    const modelRevision =
      typeof emb.modelRevision === "string" ? emb.modelRevision : undefined;
    if (modelRevision && modelRevision !== generation.embeddingModelRevision) {
      throw new WorkerOutputDbImportError(
        "SEARCH_GENERATION_DESCRIPTOR_MISMATCH",
        `embedding modelRevision for chunk ${emb.chunkId} does not match generation`,
      );
    }
  }
}

/**
 * Build a pure (no-DB) import plan from a validated payload and a resolved
 * generation binding. Exposed for unit tests and inspection.
 */
export function assertWorkerChunkProvenance(input: {
  chunks: Array<Record<string, unknown>>;
  expected?: WorkerImportExpectedProvenance | null;
}): void {
  const expected = input.expected;
  if (!expected) return;

  const pathMap = expected.inventoryItemIdByPath ?? {};
  const hasPathMap = Object.keys(pathMap).length > 0;

  for (const chunk of input.chunks) {
    const sourcePath =
      typeof chunk.sourcePath === "string" ? chunk.sourcePath.replace(/\\/g, "/") : "";
    const chunkRunId =
      typeof chunk.pipelineRunId === "string" ? chunk.pipelineRunId : null;
    if (chunkRunId && chunkRunId !== expected.pipelineRunId) {
      throw new WorkerOutputDbImportError(
        "PROVENANCE_RUN_MISMATCH",
        `chunk ${String(chunk.chunkId)} pipelineRunId mismatch`,
      );
    }

    const chunkWc =
      typeof chunk.workingCopyId === "string" ? chunk.workingCopyId : null;
    if (expected.workingCopyId && chunkWc && chunkWc !== expected.workingCopyId) {
      throw new WorkerOutputDbImportError(
        "PROVENANCE_WORKING_COPY_MISMATCH",
        `chunk ${String(chunk.chunkId)} workingCopyId mismatch`,
      );
    }

    const chunkRev =
      typeof chunk.sourceRevisionId === "string" ? chunk.sourceRevisionId : null;
    if (expected.sourceRevisionId && chunkRev && chunkRev !== expected.sourceRevisionId) {
      throw new WorkerOutputDbImportError(
        "PROVENANCE_SOURCE_REVISION_MISMATCH",
        `chunk ${String(chunk.chunkId)} sourceRevisionId mismatch`,
      );
    }

    const chunkInvItem =
      typeof chunk.inventoryItemId === "string" ? chunk.inventoryItemId : null;
    if (hasPathMap && sourcePath) {
      const expectedItemId = pathMap[sourcePath];
      if (expectedItemId && chunkInvItem && chunkInvItem !== expectedItemId) {
        throw new WorkerOutputDbImportError(
          "PROVENANCE_INVENTORY_ITEM_MISMATCH",
          `chunk ${String(chunk.chunkId)} inventoryItemId mismatch for ${sourcePath}`,
        );
      }
    }
  }
}

export function buildWorkerOutputImportPlan(input: {
  payload: WorkerOutputImportPayload;
  chunkGenerationId: string;
  searchIndexGenerationId: string;
  sourceDocumentIdByPath?: Record<string, string>;
  expectedProvenance?: WorkerImportExpectedProvenance | null;
}): WorkerOutputImportPlan {
  const { payload } = input;
  assertWorkerOutputImportable(payload);
  assertWorkerChunkProvenance({
    chunks: payload.chunks as Array<Record<string, unknown>>,
    expected: input.expectedProvenance,
  });

  if (!input.chunkGenerationId) {
    throw new WorkerOutputDbImportError(
      "CHUNK_GENERATION_REQUIRED",
      "buildWorkerOutputImportPlan requires a resolved chunkGenerationId",
    );
  }
  const chunkGenerationId = input.chunkGenerationId;
  const searchIndexGenerationId = input.searchIndexGenerationId;
  const sourceDocumentIdByPath = input.sourceDocumentIdByPath ?? {};
  const traceById = new Map(payload.sourceTraces.map((t) => [t.traceId, t]));
  const expected = input.expectedProvenance;
  const pathMap = expected?.inventoryItemIdByPath ?? {};

  const chunkPlans: WorkerChunkCreatePlan[] = payload.chunks.map((chunk, index) => {
    const tags = resolveTags(chunk);
    const trace = traceById.get(chunk.traceId);
    const chunkRecord = chunk as Record<string, unknown>;
    const sourcePath = chunk.sourcePath;
    const inventoryItemId =
      (typeof chunkRecord.inventoryItemId === "string" && chunkRecord.inventoryItemId) ||
      pathMap[sourcePath] ||
      null;
    const workingCopyId =
      (typeof chunkRecord.workingCopyId === "string" && chunkRecord.workingCopyId) ||
      expected?.workingCopyId ||
      null;
    const sourceRevisionId =
      (typeof chunkRecord.sourceRevisionId === "string" && chunkRecord.sourceRevisionId) ||
      expected?.sourceRevisionId ||
      null;
    const inventoryId =
      (typeof chunkRecord.inventoryId === "string" && chunkRecord.inventoryId) ||
      expected?.inventoryId ||
      null;

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
      // Dual-write for legacy readers: metadata.indexGenerationId mirrors the
      // chunkGenerationId column (see search-generation-binding.resolveChunkGenerationId).
      indexGenerationId: chunkGenerationId,
      chunkGenerationId,
      searchIndexGenerationId,
      sourceTrace: trace ? { ...trace } : null,
      inventoryItemId,
      inventoryId,
      workingCopyId,
      sourceRevisionId,
      chunkPolicyVersion:
        typeof chunkRecord.chunkPolicyVersion === "string"
          ? chunkRecord.chunkPolicyVersion
          : null,
      autoCorrections: Array.isArray(chunkRecord.autoCorrections)
        ? chunkRecord.autoCorrections
        : [],
    };
    if (typeof chunkRecord.entityKey === "string" && chunkRecord.entityKey.trim()) {
      metadata.entityKey = chunkRecord.entityKey.trim();
    }
    if (Array.isArray(chunkRecord.sectionPath)) {
      metadata.sectionPath = chunkRecord.sectionPath.filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0,
      );
    }
    if (Array.isArray(chunkRecord.mergedHeadings)) {
      metadata.mergedHeadings = chunkRecord.mergedHeadings.filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0,
      );
    }
    if (typeof chunkRecord.mergeReason === "string" && chunkRecord.mergeReason.trim()) {
      metadata.mergeReason = chunkRecord.mergeReason.trim();
    }
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  const step = Math.max(1, Math.floor(size));
  for (let start = 0; start < items.length; start += step) {
    batches.push(items.slice(start, start + step));
  }
  return batches;
}

/**
 * Persist a validated Worker output payload into Store DB + vector index in one
 * transaction. Chunk + embedding + vector writes are atomic: any failure rolls
 * back the whole import. Writes are batched (createMany + multi-row vector INSERT)
 * so the query count stays flat regardless of chunk count.
 */
export async function importWorkerOutputToStoreDb(
  input: WorkerOutputDbImportInput,
): Promise<WorkerOutputDbImportResult> {
  assertWorkerOutputImportable(input.payload);

  const searchIndexGenerationId = input.searchIndexGenerationId;
  if (!searchIndexGenerationId) {
    // P4: worker output DB import must be bound to a search generation.
    if (!input.chunkGenerationId) {
      throw new WorkerOutputDbImportError(
        "CHUNK_GENERATION_REQUIRED",
        "DB import requires searchIndexGenerationId (or at least chunkGenerationId)",
      );
    }
    throw new WorkerOutputDbImportError(
      "SEARCH_GENERATION_REQUIRED",
      "DB import requires a searchIndexGenerationId (vector index is per generation)",
    );
  }

  const client = input.prismaClient ?? prisma;
  const upsertVectors = input.upsertVectors ?? upsertSearchIndexVectorsBatch;
  const deleteVectors =
    input.deleteVectorsForGeneration ?? deleteSearchIndexVectorsForGeneration;
  const vectorEnv: NodeJS.ProcessEnv = input.requirePgvector
    ? { ...process.env, JYKSTORE_REQUIRE_PGVECTOR: "true" }
    : process.env;

  const outcome = await client.$transaction(async (tx) => {
    const generationRow = await tx.searchIndexGeneration.findUnique({
      where: { id: searchIndexGenerationId },
      select: {
        id: true,
        versionId: true,
        chunkGenerationId: true,
        embeddingProvider: true,
        embeddingModel: true,
        embeddingModelRevision: true,
        embeddingDimension: true,
        status: true,
        scope: true,
      },
    });
    if (!generationRow) {
      throw new WorkerOutputDbImportError(
        "SEARCH_GENERATION_NOT_FOUND",
        `search index generation not found: ${searchIndexGenerationId}`,
      );
    }
    const generation = generationRow as unknown as ImportSearchGenerationDescriptor;

    assertGenerationImportable(generation);
    const resolvedChunkGenerationId = resolveWorkerImportChunkGenerationId(
      input.chunkGenerationId,
      generation,
    );
    assertGenerationDescriptorMatches(input.payload, generation);

    const plan = buildWorkerOutputImportPlan({
      payload: input.payload,
      chunkGenerationId: resolvedChunkGenerationId,
      searchIndexGenerationId,
      sourceDocumentIdByPath: input.sourceDocumentIdByPath,
      expectedProvenance: input.expectedProvenance,
    });

    // Re-run policy: clear this generation's existing vectors first (no chunk FK
    // cascade reaches SearchIndexVector), then delete the resolved generation's
    // chunks (cascade removes their embeddings). Other generations are untouched.
    await deleteVectors(searchIndexGenerationId, tx, vectorEnv);
    await tx.knowledgeChunk.deleteMany({
      where: {
        versionId: plan.packVersionId,
        chunkGenerationId: resolvedChunkGenerationId,
      },
    });

    // Assign the Store chunk id up front so chunks, embeddings, and vectors can
    // all be written in bulk (createMany / multi-row INSERT) instead of one
    // round-trip per chunk. worker chunkId -> generated Store KnowledgeChunk.id.
    const mapping: Record<string, string> = {};
    const chunkRows: Array<Prisma.KnowledgeChunkCreateManyInput> = [];
    const embeddingRows: Array<Prisma.KnowledgeChunkEmbeddingCreateManyInput> = [];
    const vectorInputs: Array<{
      searchIndexGenerationId: string;
      chunkId: string;
      provider: string;
      model: string;
      dimension: number;
      contentHash: string;
      vector: number[];
    }> = [];

    for (const chunkPlan of plan.chunkPlans) {
      const embeddingPlan = plan.embeddingPlanByWorkerChunkId.get(chunkPlan.workerChunkId);
      if (!embeddingPlan) {
        throw new WorkerOutputDbImportError(
          "CHUNK_EMBEDDING_MISSING",
          `chunk ${chunkPlan.workerChunkId} has no embedding plan`,
        );
      }
      const storeChunkId = randomUUID();
      mapping[chunkPlan.workerChunkId] = storeChunkId;

      chunkRows.push({ id: storeChunkId, ...chunkPlan.data });
      embeddingRows.push({
        chunkId: storeChunkId,
        versionId: embeddingPlan.versionId,
        provider: embeddingPlan.provider,
        model: embeddingPlan.model,
        dimension: embeddingPlan.dimension,
        vector: embeddingPlan.vector as unknown as Prisma.InputJsonValue,
        contentHash: embeddingPlan.contentHash,
        searchIndexGenerationId,
      });
      vectorInputs.push({
        searchIndexGenerationId,
        chunkId: storeChunkId,
        provider: embeddingPlan.provider,
        model: embeddingPlan.model,
        dimension: embeddingPlan.dimension,
        contentHash: embeddingPlan.contentHash,
        vector: embeddingPlan.vector,
      });
    }

    for (const batch of chunkArray(chunkRows, WORKER_IMPORT_CREATE_MANY_BATCH_SIZE)) {
      await tx.knowledgeChunk.createMany({ data: batch });
    }
    for (const batch of chunkArray(embeddingRows, WORKER_IMPORT_CREATE_MANY_BATCH_SIZE)) {
      await tx.knowledgeChunkEmbedding.createMany({ data: batch });
    }

    const vectorResult = await upsertVectors(vectorInputs, tx, vectorEnv);
    const vectorUpsertedCount = vectorResult.upsertedCount;
    const vectorSkippedCount = vectorResult.skippedCount;
    const vectorSyncWarning = vectorResult.skippedReason;

    await tx.searchIndexGeneration.update({
      where: { id: searchIndexGenerationId },
      data: {
        chunkCount: plan.chunkPlans.length,
        embeddedCount: plan.embeddingPlanByWorkerChunkId.size,
        failedCount: 0,
      },
    });

    return {
      resolvedChunkGenerationId,
      mapping,
      importedChunkCount: plan.chunkPlans.length,
      importedEmbeddingCount: plan.embeddingPlanByWorkerChunkId.size,
      vectorUpsertedCount,
      vectorSkippedCount,
      vectorSyncWarning,
    };
  }, {
    timeout: WORKER_IMPORT_TX_TIMEOUT_MS,
    maxWait: WORKER_IMPORT_TX_MAX_WAIT_MS,
  });

  return {
    packVersionId: input.payload.packVersionId,
    chunkGenerationId: outcome.resolvedChunkGenerationId,
    searchIndexGenerationId,
    importedChunkCount: outcome.importedChunkCount,
    importedEmbeddingCount: outcome.importedEmbeddingCount,
    chunkIdByWorkerChunkId: outcome.mapping,
    pgvectorReflected: outcome.vectorUpsertedCount > 0 && outcome.vectorSkippedCount === 0,
    vectorUpsertedCount: outcome.vectorUpsertedCount,
    vectorSkippedCount: outcome.vectorSkippedCount,
    vectorSyncWarning: outcome.vectorSyncWarning,
  };
}
