/** Durable job binding stored in PipelineRun.summary as JSON while queued/running. */

export const KNOWLEDGE_RUN_BINDING_VERSION = 1 as const;

export type KnowledgeRunBinding = {
  v: typeof KNOWLEDGE_RUN_BINDING_VERSION;
  versionId: string;
  normalizedDocumentId: string;
  fingerprint: string;
  bundleId: string;
  indexGenerationId: string;
  heartbeatAt: string | null;
  cancelRequestedAt: string | null;
  lockOwner: string | null;
  lockExpiresAt: string | null;
  attempt: number;
  failureCode: string | null;
  failureMessage: string | null;
  requestedByUserId: string | null;
  requestedByClientId: string | null;
  userMessage: string | null;
};

export const KNOWLEDGE_PIPELINE_HEARTBEAT_STALE_MS = Number.parseInt(
  process.env.JYKSTORE_KNOWLEDGE_PIPELINE_STALE_MS ?? String(15 * 60 * 1000),
  10,
);

export const KNOWLEDGE_PIPELINE_LOCK_MS = Number.parseInt(
  process.env.JYKSTORE_KNOWLEDGE_PIPELINE_LOCK_MS ?? String(10 * 60 * 1000),
  10,
);

export const KNOWLEDGE_PIPELINE_MAX_ATTEMPTS = Number.parseInt(
  process.env.JYKSTORE_KNOWLEDGE_PIPELINE_MAX_ATTEMPTS ?? "3",
  10,
);

export function createKnowledgeRunBinding(input: {
  versionId: string;
  normalizedDocumentId: string;
  fingerprint: string;
  bundleId: string;
  indexGenerationId: string;
  requestedByUserId?: string | null;
  requestedByClientId?: string | null;
}): KnowledgeRunBinding {
  return {
    v: KNOWLEDGE_RUN_BINDING_VERSION,
    versionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId,
    fingerprint: input.fingerprint,
    bundleId: input.bundleId,
    indexGenerationId: input.indexGenerationId,
    heartbeatAt: new Date().toISOString(),
    cancelRequestedAt: null,
    lockOwner: null,
    lockExpiresAt: null,
    attempt: 0,
    failureCode: null,
    failureMessage: null,
    requestedByUserId: input.requestedByUserId ?? null,
    requestedByClientId: input.requestedByClientId ?? null,
    userMessage: "대기 중",
  };
}

export function serializeKnowledgeRunBinding(binding: KnowledgeRunBinding): string {
  return JSON.stringify(binding);
}

export function parseKnowledgeRunBinding(summary: string | null | undefined): KnowledgeRunBinding | null {
  if (!summary?.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(summary) as Partial<KnowledgeRunBinding>;
    if (parsed.v !== KNOWLEDGE_RUN_BINDING_VERSION) return null;
    if (
      typeof parsed.versionId !== "string" ||
      typeof parsed.normalizedDocumentId !== "string" ||
      typeof parsed.fingerprint !== "string" ||
      typeof parsed.bundleId !== "string" ||
      typeof parsed.indexGenerationId !== "string"
    ) {
      return null;
    }
    return {
      v: KNOWLEDGE_RUN_BINDING_VERSION,
      versionId: parsed.versionId,
      normalizedDocumentId: parsed.normalizedDocumentId,
      fingerprint: parsed.fingerprint,
      bundleId: parsed.bundleId,
      indexGenerationId: parsed.indexGenerationId,
      heartbeatAt: typeof parsed.heartbeatAt === "string" ? parsed.heartbeatAt : null,
      cancelRequestedAt:
        typeof parsed.cancelRequestedAt === "string" ? parsed.cancelRequestedAt : null,
      lockOwner: typeof parsed.lockOwner === "string" ? parsed.lockOwner : null,
      lockExpiresAt: typeof parsed.lockExpiresAt === "string" ? parsed.lockExpiresAt : null,
      attempt: typeof parsed.attempt === "number" ? parsed.attempt : 0,
      failureCode: typeof parsed.failureCode === "string" ? parsed.failureCode : null,
      failureMessage: typeof parsed.failureMessage === "string" ? parsed.failureMessage : null,
      requestedByUserId:
        typeof parsed.requestedByUserId === "string" ? parsed.requestedByUserId : null,
      requestedByClientId:
        typeof parsed.requestedByClientId === "string" ? parsed.requestedByClientId : null,
      userMessage: typeof parsed.userMessage === "string" ? parsed.userMessage : null,
    };
  } catch {
    return null;
  }
}

export function isKnowledgeRunHeartbeatStale(
  binding: KnowledgeRunBinding,
  nowMs: number = Date.now(),
): boolean {
  if (!binding.heartbeatAt) return true;
  const hb = Date.parse(binding.heartbeatAt);
  if (!Number.isFinite(hb)) return true;
  return nowMs - hb > KNOWLEDGE_PIPELINE_HEARTBEAT_STALE_MS;
}

export function humanSummaryFromBinding(binding: KnowledgeRunBinding | null, fallback: string): string {
  if (!binding) return fallback;
  return binding.userMessage?.trim() || fallback;
}
