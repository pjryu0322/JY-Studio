import { type Prisma, type SearchIndexGeneration, type SearchIndexGenerationStatus } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { prisma } from "@/lib/prisma";
import {
  isSearchGenerationCurrentForBinding,
  type SearchGenerationBindingInput,
  type SearchGenerationEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-types";

/** Root client or interactive transaction. */
export type SearchGenerationClient = Prisma.TransactionClient | typeof prisma;

export type CreateDraftSearchGenerationInput = SearchGenerationBindingInput &
  SearchGenerationEmbeddingDescriptor & {
    /** Optional explicit id (accepts historical indexGenerationId). */
    id?: string;
    generationFingerprint: string;
    chunkCount?: number;
    attempt?: number;
  };

/**
 * Create a DRAFT/PENDING generation. Idempotent by id when provided; otherwise by
 * generationFingerprint within a version for non-inactive rows.
 */
export async function createDraftSearchGeneration(
  input: CreateDraftSearchGenerationInput,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  if (input.id) {
    const byId = await client.searchIndexGeneration.findUnique({ where: { id: input.id } });
    if (byId) return byId;
  }

  const existing = await client.searchIndexGeneration.findFirst({
    where: {
      versionId: input.versionId,
      generationFingerprint: input.generationFingerprint,
      status: { notIn: ["FAILED", "STALE", "RETIRED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return client.searchIndexGeneration.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      packId: input.packId,
      versionId: input.versionId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: input.normalizedDocumentId,
      chunkGenerationId: input.chunkGenerationId,
      fingerprint: input.fingerprint,
      embeddingProvider: input.embeddingProvider,
      embeddingModel: input.embeddingModel,
      embeddingModelRevision: input.embeddingModelRevision,
      embeddingDimension: input.embeddingDimension,
      distanceMetric: input.distanceMetric,
      chunkCount: input.chunkCount ?? 0,
      generationFingerprint: input.generationFingerprint,
      attempt: input.attempt ?? 0,
      status: "PENDING",
      scope: "DRAFT",
    },
  });
}

export async function loadSearchGeneration(
  id: string,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration | null> {
  return client.searchIndexGeneration.findUnique({ where: { id } });
}

/** Latest non-inactive DRAFT generation for a version (READY/PENDING/EMBEDDING/INDEXING). */
export async function loadCurrentDraftSearchGeneration(
  versionId: string,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration | null> {
  return client.searchIndexGeneration.findFirst({
    where: {
      versionId,
      scope: "DRAFT",
      status: { notIn: ["FAILED", "STALE", "RETIRED"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Current PROMOTED production generation for a version, if any. */
export async function loadProductionSearchGeneration(
  versionId: string,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration | null> {
  return client.searchIndexGeneration.findFirst({
    where: { versionId, scope: "PRODUCTION", status: "PROMOTED" },
    orderBy: { promotedAt: "desc" },
  });
}

/**
 * Ensure the generation exists, is READY, DRAFT, and current for the binding.
 * Used by validation-run creation and review submit.
 */
export async function assertCurrentSearchGeneration(
  id: string,
  binding: SearchGenerationBindingInput,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  const generation = await loadSearchGeneration(id, client);
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "검색 인덱스 생성 세대를 찾을 수 없습니다.",
      404,
    );
  }
  if (generation.scope !== "DRAFT") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_CURRENT",
      "검색 인덱스 생성 세대가 DRAFT 범위가 아닙니다.",
      409,
    );
  }
  if (!isSearchGenerationCurrentForBinding(generation, binding)) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_CURRENT",
      "검색 인덱스 생성 세대가 현재 자료와 일치하지 않습니다.",
      409,
    );
  }
  if (generation.status !== "READY") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_READY",
      "검색 인덱스 생성 세대가 READY 상태가 아닙니다.",
      409,
    );
  }
  return generation;
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<SearchIndexGenerationStatus, readonly SearchIndexGenerationStatus[]>
> = {
  PENDING: ["EMBEDDING", "FAILED"],
  EMBEDDING: ["INDEXING", "FAILED"],
  INDEXING: ["READY", "FAILED"],
  READY: ["STALE", "PROMOTED"],
  FAILED: [],
  STALE: [],
  PROMOTED: ["RETIRED"],
  RETIRED: [],
};

/**
 * Conditional status transition. Updates exactly one row matching expected status
 * (and optional scope). Throws on conflict.
 */
export async function transitionSearchGeneration(
  id: string,
  input: {
    from: SearchIndexGenerationStatus | SearchIndexGenerationStatus[];
    to: SearchIndexGenerationStatus;
    scope?: "DRAFT" | "PRODUCTION";
    /** When set, only transition if attempt still matches (worker ownership). */
    expectedAttempt?: number;
    data?: Prisma.SearchIndexGenerationUpdateManyMutationInput;
  },
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  const fromList = Array.isArray(input.from) ? input.from : [input.from];
  for (const from of fromList) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(input.to) && from !== input.to) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_TRANSITION_CONFLICT",
        `검색 세대 상태 전이 ${from} → ${input.to}는 허용되지 않습니다.`,
        409,
      );
    }
  }

  const result = await client.searchIndexGeneration.updateMany({
    where: {
      id,
      status: { in: [...fromList] },
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.expectedAttempt != null ? { attempt: input.expectedAttempt } : {}),
    },
    data: {
      status: input.to,
      ...(input.data ?? {}),
    },
  });
  if (result.count !== 1) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "검색 세대 상태 전이가 충돌했습니다. 다시 시도해 주세요.",
      409,
    );
  }
  const generation = await loadSearchGeneration(id, client);
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "검색 인덱스 생성 세대를 찾을 수 없습니다.",
      404,
    );
  }
  return generation;
}

/**
 * READY 전 수량·descriptor 검증.
 * Generation.chunkCount == retrieval chunks with this chunkGenerationId
 * Generation.embeddedCount == embeddings with this searchIndexGenerationId
 * embeddedCount == chunkCount > 0, failedCount == 0, descriptor 일치.
 */
export async function assertSearchGenerationCounts(
  id: string,
  client: SearchGenerationClient = prisma,
): Promise<{
  generation: SearchIndexGeneration;
  chunkCount: number;
  embeddedCount: number;
}> {
  const generation = await loadSearchGeneration(id, client);
  if (!generation) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "검색 인덱스 생성 세대를 찾을 수 없습니다.",
      404,
    );
  }

  const { DOCLING_RETRIEVAL_CHUNK_TYPE } = await import(
    "@/lib/docling-knowledge/docling-knowledge-stages"
  );
  const { WORKER_RETRIEVAL_CHUNK_TYPE } = await import(
    "@/lib/python-worker/worker-chunk-constants"
  );
  const actualChunkCount = await client.knowledgeChunk.count({
    where: {
      versionId: generation.versionId,
      chunkType: { in: [DOCLING_RETRIEVAL_CHUNK_TYPE, WORKER_RETRIEVAL_CHUNK_TYPE] },
      OR: [
        { chunkGenerationId: generation.chunkGenerationId },
        {
          AND: [
            { chunkGenerationId: null },
            { metadata: { path: ["indexGenerationId"], equals: generation.chunkGenerationId } },
          ],
        },
      ],
    },
  });

  const embeddings = await client.knowledgeChunkEmbedding.findMany({
    where: { searchIndexGenerationId: generation.id },
    select: {
      provider: true,
      model: true,
      dimension: true,
    },
  });
  const embeddedCount = embeddings.length;

  if (actualChunkCount <= 0 || embeddedCount !== actualChunkCount || generation.failedCount !== 0) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_COUNT_MISMATCH",
      `검색 세대 수량이 일치하지 않습니다 (chunks=${actualChunkCount}, embeddings=${embeddedCount}).`,
      409,
    );
  }

  for (const emb of embeddings) {
    if (
      emb.provider !== generation.embeddingProvider ||
      emb.model !== generation.embeddingModel ||
      emb.dimension !== generation.embeddingDimension
    ) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_COUNT_MISMATCH",
        "검색 세대 Embedding descriptor가 일치하지 않습니다.",
        409,
      );
    }
  }

  return { generation, chunkCount: actualChunkCount, embeddedCount };
}

export async function markSearchGenerationEmbedding(
  id: string,
  client: SearchGenerationClient = prisma,
  options: { expectedAttempt?: number } = {},
): Promise<SearchIndexGeneration> {
  return transitionSearchGeneration(
    id,
    {
      from: "PENDING",
      to: "EMBEDDING",
      scope: "DRAFT",
      expectedAttempt: options.expectedAttempt,
      data: { startedAt: new Date() },
    },
    client,
  );
}

export async function markSearchGenerationIndexing(
  id: string,
  input: {
    embeddedCount?: number;
    failedCount?: number;
    chunkCount?: number;
    expectedAttempt?: number;
  } = {},
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return transitionSearchGeneration(
    id,
    {
      from: "EMBEDDING",
      to: "INDEXING",
      scope: "DRAFT",
      expectedAttempt: input.expectedAttempt,
      data: {
        ...(input.embeddedCount != null ? { embeddedCount: input.embeddedCount } : {}),
        ...(input.failedCount != null ? { failedCount: input.failedCount } : {}),
        ...(input.chunkCount != null ? { chunkCount: input.chunkCount } : {}),
      },
    },
    client,
  );
}

export async function markSearchGenerationReady(
  id: string,
  input: {
    embeddedCount?: number;
    chunkCount?: number;
    generationFingerprint?: string;
  } = {},
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  const counts = await assertSearchGenerationCounts(id, client);
  return transitionSearchGeneration(
    id,
    {
      from: "INDEXING",
      to: "READY",
      scope: "DRAFT",
      data: {
        completedAt: new Date(),
        chunkCount: input.chunkCount ?? counts.chunkCount,
        embeddedCount: input.embeddedCount ?? counts.embeddedCount,
        failedCount: 0,
        staleAt: null,
        ...(input.generationFingerprint
          ? { generationFingerprint: input.generationFingerprint }
          : {}),
      },
    },
    client,
  );
}

export async function markSearchGenerationFailed(
  id: string,
  input: {
    failureCode: string;
    failureMessage?: string | null;
    failedCount?: number;
    expectedAttempt?: number;
  },
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  const existing = await loadSearchGeneration(id, client);
  if (!existing) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_FOUND",
      "검색 인덱스 생성 세대를 찾을 수 없습니다.",
      404,
    );
  }
  if (existing.status === "FAILED") return existing;
  if (existing.status === "READY" || existing.status === "PROMOTED" || existing.status === "RETIRED") {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "완료된 검색 세대를 FAILED로 전환할 수 없습니다.",
      409,
    );
  }
  if (
    input.expectedAttempt != null &&
    existing.attempt !== input.expectedAttempt
  ) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_TRANSITION_CONFLICT",
      "검색 세대 Attempt가 일치하지 않습니다.",
      409,
    );
  }
  return transitionSearchGeneration(
    id,
    {
      from: ["PENDING", "EMBEDDING", "INDEXING"],
      to: "FAILED",
      expectedAttempt: input.expectedAttempt,
      data: {
        failureCode: input.failureCode,
        failureMessage: input.failureMessage ?? null,
        ...(input.failedCount != null ? { failedCount: input.failedCount } : {}),
      },
    },
    client,
  );
}

/**
 * Mark a version's active DRAFT generations STALE. Never touches PRODUCTION.
 * Also deactivates KnowledgeChunks bound to those generations so quality/search
 * do not double-count prior Worker ZIP runs.
 * Returns the number of generations transitioned.
 */
export async function markSearchGenerationStale(
  versionId: string,
  client: SearchGenerationClient = prisma,
  options: { exceptId?: string } = {},
): Promise<number> {
  const where: Prisma.SearchIndexGenerationWhereInput = {
    versionId,
    scope: "DRAFT",
    status: { notIn: ["FAILED", "STALE", "RETIRED"] },
    ...(options.exceptId ? { id: { not: options.exceptId } } : {}),
  };

  const targets = await client.searchIndexGeneration.findMany({
    where,
    select: { id: true, chunkGenerationId: true },
  });
  if (targets.length === 0) return 0;

  await client.searchIndexGeneration.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "STALE", staleAt: new Date() },
  });

  const chunkGenerationIds = [
    ...new Set(
      targets
        .map((t) => t.chunkGenerationId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (chunkGenerationIds.length > 0) {
    await client.knowledgeChunk.updateMany({
      where: {
        versionId,
        isActive: true,
        chunkGenerationId: { in: chunkGenerationIds },
      },
      data: { isActive: false },
    });
  }

  return targets.length;
}

/**
 * Promote a validated DRAFT/READY generation to PRODUCTION/PROMOTED.
 * Retires the previous production generation in the same transaction.
 *
 * When `guard` is provided (approval path), the conditional updateMany also
 * pins fingerprint + embedding descriptor so concurrent drift yields
 * SEARCH_GENERATION_TRANSITION_CONFLICT and rolls back the whole approval tx.
 */
export type PromoteSearchGenerationGuard = {
  generationFingerprint?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingModelRevision?: string | null;
  embeddingDimension?: number | null;
  distanceMetric?: string | null;
};

export async function promoteSearchGeneration(
  id: string,
  client: SearchGenerationClient = prisma,
  guard?: PromoteSearchGenerationGuard,
): Promise<SearchIndexGeneration> {
  const run = async (tx: SearchGenerationClient) => {
    const generation = await tx.searchIndexGeneration.findUnique({ where: { id } });
    if (!generation) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_FOUND",
        "검색 인덱스 생성 세대를 찾을 수 없습니다.",
        404,
      );
    }
    if (generation.status !== "READY" || generation.scope !== "DRAFT") {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_READY",
        "READY 상태의 DRAFT 세대만 승격할 수 있습니다.",
        409,
      );
    }

    // F: retire previous Production first so Partial Unique Index does not conflict.
    await tx.searchIndexGeneration.updateMany({
      where: {
        versionId: generation.versionId,
        scope: "PRODUCTION",
        status: "PROMOTED",
        id: { not: generation.id },
      },
      data: { status: "RETIRED", retiredAt: new Date() },
    });

    // E: conditional promotion — status/scope + optional Snapshot descriptor guard.
    // Descriptor fields themselves are NEVER written (immutability).
    const promoted = await tx.searchIndexGeneration.updateMany({
      where: {
        id: generation.id,
        versionId: generation.versionId,
        status: "READY",
        scope: "DRAFT",
        ...(guard?.generationFingerprint
          ? { generationFingerprint: guard.generationFingerprint }
          : {}),
        ...(guard?.embeddingProvider ? { embeddingProvider: guard.embeddingProvider } : {}),
        ...(guard?.embeddingModel ? { embeddingModel: guard.embeddingModel } : {}),
        ...(guard?.embeddingModelRevision
          ? { embeddingModelRevision: guard.embeddingModelRevision }
          : {}),
        ...(typeof guard?.embeddingDimension === "number"
          ? { embeddingDimension: guard.embeddingDimension }
          : {}),
        ...(guard?.distanceMetric ? { distanceMetric: guard.distanceMetric } : {}),
      },
      data: {
        scope: "PRODUCTION",
        status: "PROMOTED",
        promotedAt: new Date(),
      },
    });
    if (promoted.count !== 1) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_TRANSITION_CONFLICT",
        "검색 세대 승격이 충돌했습니다.",
        409,
      );
    }
    const next = await tx.searchIndexGeneration.findUnique({ where: { id: generation.id } });
    if (!next) {
      throw new PayloadServiceError(
        "SEARCH_GENERATION_NOT_FOUND",
        "검색 인덱스 생성 세대를 찾을 수 없습니다.",
        404,
      );
    }
    return next;
  };

  if ("$transaction" in client && typeof client.$transaction === "function") {
    return (client as typeof prisma).$transaction((tx) => run(tx));
  }
  return run(client);
}

export async function retireSearchGeneration(
  id: string,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return transitionSearchGeneration(
    id,
    {
      from: "PROMOTED",
      to: "RETIRED",
      scope: "PRODUCTION",
      data: { retiredAt: new Date() },
    },
    client,
  );
}
