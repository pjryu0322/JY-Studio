import { type Prisma, type SearchIndexGeneration } from "@prisma/client";
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
 * Create a DRAFT/PENDING generation. Idempotent by generationFingerprint within a
 * version: if a non-inactive generation with the same fingerprint exists, reuse it.
 */
export async function createDraftSearchGeneration(
  input: CreateDraftSearchGenerationInput,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
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
 * Used by validation-run creation and review submit (§34).
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

export async function markSearchGenerationEmbedding(
  id: string,
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return client.searchIndexGeneration.update({
    where: { id },
    data: { status: "EMBEDDING", startedAt: new Date() },
  });
}

export async function markSearchGenerationIndexing(
  id: string,
  input: { embeddedCount?: number; failedCount?: number } = {},
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return client.searchIndexGeneration.update({
    where: { id },
    data: {
      status: "INDEXING",
      ...(input.embeddedCount != null ? { embeddedCount: input.embeddedCount } : {}),
      ...(input.failedCount != null ? { failedCount: input.failedCount } : {}),
    },
  });
}

export async function markSearchGenerationReady(
  id: string,
  input: { embeddedCount?: number; chunkCount?: number } = {},
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return client.searchIndexGeneration.update({
    where: { id },
    data: {
      status: "READY",
      completedAt: new Date(),
      ...(input.embeddedCount != null ? { embeddedCount: input.embeddedCount } : {}),
      ...(input.chunkCount != null ? { chunkCount: input.chunkCount } : {}),
    },
  });
}

export async function markSearchGenerationFailed(
  id: string,
  input: { failureCode: string; failureMessage?: string | null; failedCount?: number },
  client: SearchGenerationClient = prisma,
): Promise<SearchIndexGeneration> {
  return client.searchIndexGeneration.update({
    where: { id },
    data: {
      status: "FAILED",
      failureCode: input.failureCode,
      failureMessage: input.failureMessage ?? null,
      ...(input.failedCount != null ? { failedCount: input.failedCount } : {}),
    },
  });
}

/**
 * Mark a version's active DRAFT generations STALE (§33). Never touches PRODUCTION.
 * Returns the number of generations transitioned.
 */
export async function markSearchGenerationStale(
  versionId: string,
  client: SearchGenerationClient = prisma,
): Promise<number> {
  const result = await client.searchIndexGeneration.updateMany({
    where: {
      versionId,
      scope: "DRAFT",
      status: { notIn: ["FAILED", "STALE", "RETIRED"] },
    },
    data: { status: "STALE", staleAt: new Date() },
  });
  return result.count;
}

/**
 * Promote a validated DRAFT/READY generation to PRODUCTION/PROMOTED (§36).
 * Retires the previous production generation in the same transaction.
 * The invariant: validated generation == promoted generation.
 */
export async function promoteSearchGeneration(
  id: string,
  client: SearchGenerationClient = prisma,
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
    await tx.searchIndexGeneration.updateMany({
      where: {
        versionId: generation.versionId,
        scope: "PRODUCTION",
        status: "PROMOTED",
        id: { not: generation.id },
      },
      data: { status: "RETIRED", retiredAt: new Date() },
    });
    return tx.searchIndexGeneration.update({
      where: { id: generation.id },
      data: { scope: "PRODUCTION", status: "PROMOTED", promotedAt: new Date() },
    });
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
  return client.searchIndexGeneration.update({
    where: { id },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
}
