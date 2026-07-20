/**
 * Search-data generation audit event helpers.
 * Does not write pipeline steps — use search-data-generation-transitions for those.
 */
import { AuditAction } from "@prisma/client";
import { recordProviderAudit } from "@/lib/provider-audit";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { SEARCH_DATA_FAILURE } from "@/lib/search-data/search-data-generation-failures";

export const SEARCH_DATA_AUDIT_EVENT = {
  GENERATION_ENQUEUED: "SEARCH_DATA_GENERATION_ENQUEUED",
  GENERATION_FORCE_ENQUEUED: "SEARCH_DATA_GENERATION_FORCE_ENQUEUED",
  GENERATION_COMPLETED: "SEARCH_DATA_GENERATION_COMPLETED",
  GENERATION_FAILED: "SEARCH_DATA_GENERATION_FAILED",
  GENERATION_RECOVERED: "SEARCH_DATA_GENERATION_RECOVERED",
  GENERATION_STALE_BINDING: "SEARCH_DATA_GENERATION_STALE_BINDING",
  VALIDATION_STARTED: "SEARCH_DATA_VALIDATION_STARTED",
  VALIDATION_FAILED: "SEARCH_DATA_VALIDATION_FAILED",
  VALIDATION_COMPLETED: "SEARCH_DATA_VALIDATION_COMPLETED",
} as const;

export async function recordSearchDataGenerationEnqueued(input: {
  packId: string;
  userId: string;
  forceRegenerate: boolean;
  versionId: string;
  pipelineRunId: string;
  normalizedDocumentId: string;
  chunkGenerationId: string;
  searchIndexGenerationId: string;
  chunkCount: number;
  previousAttempt: number;
  attempt: number;
  scaffoldReused: boolean;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: input.forceRegenerate
        ? SEARCH_DATA_AUDIT_EVENT.GENERATION_FORCE_ENQUEUED
        : SEARCH_DATA_AUDIT_EVENT.GENERATION_ENQUEUED,
      packId: input.packId,
      versionId: input.versionId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: input.normalizedDocumentId,
      chunkGenerationId: input.chunkGenerationId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      chunkCount: input.chunkCount,
      previousAttempt: input.previousAttempt,
      attempt: input.attempt,
      forceRegenerate: input.forceRegenerate,
      scaffoldReused: input.scaffoldReused,
    },
  });
}

export async function recordSearchDataGenerationCompleted(input: {
  packId: string;
  versionId: string;
  searchIndexGenerationId: string;
  chunkCount: number;
  vectorCount: number;
  attempt: number;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: null,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.GENERATION_COMPLETED,
      packId: input.packId,
      versionId: input.versionId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      chunkCount: input.chunkCount,
      vectorCount: input.vectorCount,
      attempt: input.attempt,
    },
  }).catch(() => undefined);
}

export async function recordSearchDataGenerationFailed(input: {
  packId: string;
  searchIndexGenerationId: string;
  attempt: number;
  failureCode: string;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: null,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.GENERATION_FAILED,
      failureCode: input.failureCode,
      searchIndexGenerationId: input.searchIndexGenerationId,
      attempt: input.attempt,
    },
  }).catch(() => undefined);
}

export async function recordSearchDataGenerationRecovered(input: {
  packId: string;
  searchIndexGenerationId: string;
  previousAttempt: number;
  attempt: number;
  staleSeconds: number;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: null,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.GENERATION_RECOVERED,
      packId: input.packId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      previousAttempt: input.previousAttempt,
      attempt: input.attempt,
      staleSeconds: input.staleSeconds,
    },
  }).catch(() => undefined);
}

export async function recordSearchDataBindingStale(input: {
  packId: string;
  searchIndexGenerationId: string;
  attempt: number;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: null,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.GENERATION_STALE_BINDING,
      packId: input.packId,
      searchIndexGenerationId: input.searchIndexGenerationId,
      attempt: input.attempt,
      failureCode: SEARCH_DATA_FAILURE.BINDING_STALE,
    },
  }).catch(() => undefined);
}

export async function recordSearchDataValidationStarted(input: {
  packId: string;
  userId: string;
  searchIndexGenerationId: string;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.VALIDATION_STARTED,
      searchIndexGenerationId: input.searchIndexGenerationId,
    },
  });
}

export async function recordSearchDataValidationFailed(input: {
  packId: string;
  userId: string;
  searchIndexGenerationId: string;
  failureCode?: string | null;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.VALIDATION_FAILED,
      failureCode: input.failureCode ?? SEARCH_DATA_FAILURE.RETRIEVAL_EVALUATION_FAILED,
      searchIndexGenerationId: input.searchIndexGenerationId,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  });
}

export async function recordSearchDataValidationCompleted(input: {
  packId: string;
  userId: string;
  searchIndexGenerationId: string;
}): Promise<void> {
  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: input.packId,
    actorUserId: input.userId,
    metadata: {
      event: SEARCH_DATA_AUDIT_EVENT.VALIDATION_COMPLETED,
      searchIndexGenerationId: input.searchIndexGenerationId,
      retrievalRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    },
  });
}
