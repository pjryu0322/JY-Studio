/**
 * Pure policy layer for service validation: DTO shapes and stateless helpers.
 * No Prisma client / DB access here — see service-validation-queries.ts and friends.
 */
import {
  PackStatus,
  type ServiceValidationRun,
  type ServiceValidationStatus,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import type { ProviderValidationResultItemDto } from "@/lib/distribution/service-validation-result-snapshot";
import type { ValidationBindingState } from "@/lib/distribution/service-validation-binding";
import {
  RETRIEVAL_RANKING_POLICY_VERSION,
  type RerankStats,
} from "@/lib/retrieval/relevance-diversity-rerank";

export type ProviderConfirmationStatusDto =
  | "NOT_REVIEWED"
  | "CONFIRMED"
  | "REJECTED"
  | "STALE";

/** Provider-facing channel DTO — no pipeline/generation/fingerprint/sourceDocumentId. */
export type ServiceValidationChannelDto = {
  channel: ServiceChannel;
  selected: boolean;
  systemStatus: ServiceValidationStatus | "NOT_SELECTED";
  providerConfirmationStatus: ProviderConfirmationStatusDto | null;
  currentValidity: "CURRENT" | "STALE" | null;
  /** Opaque id for confirm/reject/preview routes — do not render in provider UI. */
  runId: string | null;
  testedAt: string | null;
  query: string | null;
  resultCount: number | null;
  failureMessage: string | null;
  latencyMs: number | null;
  results: ProviderValidationResultItemDto[];
  canRun: boolean;
  canConfirm: boolean;
  /** True when API/MCP peer has identical retrieval snapshot (shared confirm OK). */
  canShareConfirmationWithPeer: boolean;
  downloadTestCompleted: boolean;
  /** DOWNLOAD / RAG Export summary (no objectKey / secrets). */
  downloadSummary: {
    fileName: string;
    fileSizeLabel: string;
    mimeLabel: string;
    integrityOk: boolean;
    downloadMode?: "RAG_EXPORT" | "LEGACY_ORIGINAL" | null;
    schemaVersion?: string | null;
    chunkCount?: number | null;
    sourceCount?: number | null;
    manifestValid?: boolean | null;
    sourceTraceValid?: boolean | null;
    checksumsValid?: boolean | null;
    vectorsIncluded?: boolean | null;
    sourceFilesIncluded?: boolean | null;
  } | null;
  confirmation: {
    status: ProviderConfirmationStatusDto;
    confirmedAt: string | null;
    confirmedByName: string | null;
    rejectionReason: string | null;
    comment: string | null;
    sharedWithChannels: ServiceChannel[];
  } | null;
};

export type ServiceValidationLockReason =
  | "OPEN_REVIEW"
  | "PACK_NOT_DRAFT"
  | "BINDING_MISSING"
  | "BINDING_STALE"
  | "SEARCH_DATA_NOT_READY"
  | null;

export type ServiceValidationStatusDto = {
  packId: string;
  versionId: string;
  packStatus: string;
  canRunValidation: boolean;
  /** Why canRunValidation is false (provider UI only). */
  validationLockReason: ServiceValidationLockReason;
  channels: ServiceValidationChannelDto[];
  /**
   * System PASS + Provider CONFIRMED + CURRENT for all preparation channels
   * (API + MCP + DOWNLOAD), before final distribution selection.
   */
  allPreparationChannelsPassed: boolean;
  /**
   * @deprecated Alias of allPreparationChannelsPassed — kept for Public/compat consumers.
   */
  allSelectedPassed: boolean;
  suggestedQuery: string | null;
  suggestedQueries: string[];
};

/** @deprecated Prefer ServiceValidationChannelDto — kept for gradual test migration. */
export type ServiceValidationChannelDtoLegacy = ServiceValidationChannelDto;

/** Preparation targets for search-validation before final distribution channel selection. */
export const SEARCH_VALIDATION_PREPARATION_CHANNELS: ServiceChannel[] = [
  "API",
  "MCP",
  "DOWNLOAD",
];

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function adapterPathForChannel(channel: ServiceChannel): string {
  if (channel === "API") return "Retrieval API Adapter";
  if (channel === "MCP") return "MCP Tool Handler (jykstore_retrieval_query)";
  return "RAG Export ZIP (jyk-rag-export/1.0)";
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeLabel(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.includes("markdown") || m.endsWith("/md")) return "Markdown";
  if (m.includes("json")) return "JSON";
  return mime?.trim() || "파일";
}

export function resolveRunCurrentValidity(input: {
  run: Pick<
    ServiceValidationRun,
    "status" | "fingerprint" | "indexGenerationId" | "invalidatedAt" | "channel"
  > & { channel?: string; details?: unknown };
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  /** For API/MCP: PASS with 0 result items is incomplete evidence → STALE. */
  resultItemCount?: number | null;
  /**
   * Current retrieval ranking policy. When set, API/MCP runs missing this version
   * (or with a different version) are STALE.
   * DOWNLOAD (RAG Export) ignores ranking policy but requires rag_export_v1 details.
   */
  expectedRankingPolicyVersion?: string | null;
}): "CURRENT" | "STALE" {
  if (input.run.invalidatedAt) return "STALE";
  if (input.run.status !== "PASS") return "CURRENT";
  const channel = input.run.channel;
  if (
    (channel === "API" || channel === "MCP") &&
    typeof input.resultItemCount === "number" &&
    input.resultItemCount < 1
  ) {
    return "STALE";
  }
  if (
    input.bindingFingerprint &&
    input.run.fingerprint &&
    input.run.fingerprint !== input.bindingFingerprint
  ) {
    return "STALE";
  }
  if (
    input.bindingIndexGenerationId &&
    input.run.indexGenerationId &&
    input.run.indexGenerationId !== input.bindingIndexGenerationId
  ) {
    return "STALE";
  }
  if (
    (channel === "API" || channel === "MCP") &&
    input.expectedRankingPolicyVersion
  ) {
    const details =
      input.run.details && typeof input.run.details === "object" && !Array.isArray(input.run.details)
        ? (input.run.details as Record<string, unknown>)
        : null;
    const runPolicy =
      typeof details?.retrievalRankingPolicyVersion === "string"
        ? details.retrievalRankingPolicyVersion.trim()
        : "";
    if (!runPolicy || runPolicy !== input.expectedRankingPolicyVersion) {
      return "STALE";
    }
  }
  if (channel === "DOWNLOAD") {
    const details =
      input.run.details && typeof input.run.details === "object" && !Array.isArray(input.run.details)
        ? (input.run.details as Record<string, unknown>)
        : null;
    // Legacy original-file DOWNLOAD PASS is not accepted as current RAG Export evidence.
    if (
      details?.downloadMode !== "RAG_EXPORT" ||
      details?.ragExportPolicyVersion !== "rag_export_v1" ||
      details?.ragExportSchemaVersion !== "jyk-rag-export/1.0" ||
      typeof details?.exportFingerprint !== "string" ||
      !details.exportFingerprint ||
      details.checksumsValid !== true ||
      details.sourceTraceValid !== true
    ) {
      return "STALE";
    }
  }
  return "CURRENT";
}

export function resolveValidationLockReason(input: {
  packStatus: string;
  hasBinding?: boolean;
  hasOpenReview?: boolean;
  bindingStatus?: ValidationBindingState["status"] | null;
  searchDataReady?: boolean;
}): ServiceValidationLockReason {
  if (input.hasOpenReview || input.packStatus === PackStatus.REVIEWING) {
    return "OPEN_REVIEW";
  }
  if (input.packStatus !== PackStatus.DRAFT) return "PACK_NOT_DRAFT";

  const bindingStatus =
    input.bindingStatus ??
    (input.hasBinding === false
      ? "MISSING"
      : input.hasBinding === true
        ? "CURRENT"
        : null);
  if (bindingStatus === "MISSING" || bindingStatus == null) return "BINDING_MISSING";
  if (bindingStatus === "STALE") return "BINDING_STALE";
  if (bindingStatus === "NOT_READY") return "SEARCH_DATA_NOT_READY";
  if (input.searchDataReady === false) return "SEARCH_DATA_NOT_READY";
  return null;
}

export function rankingPolicyVersionFromDetails(details: unknown): string | null {
  const rec =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  return typeof rec?.retrievalRankingPolicyVersion === "string"
    ? rec.retrievalRankingPolicyVersion.trim() || null
    : null;
}

export function resolveSearchEvaluationValidity(input: {
  status?: string | null;
  details?: unknown;
  expectedRankingPolicyVersion: string;
}):
  | { current: true }
  | {
      current: false;
      reason: "EVALUATION_MISSING" | "EVALUATION_NOT_PASSED" | "RANKING_POLICY_STALE";
    } {
  if (input.status == null || input.status === "") {
    return { current: false, reason: "EVALUATION_MISSING" };
  }
  if (input.status !== "PASS") {
    return { current: false, reason: "EVALUATION_NOT_PASSED" };
  }
  const version = rankingPolicyVersionFromDetails(input.details);
  if (!version || version !== input.expectedRankingPolicyVersion) {
    return { current: false, reason: "RANKING_POLICY_STALE" };
  }
  return { current: true };
}

export function assertSearchEvaluationCurrentForChannel(input: {
  channel: ServiceChannel;
  status?: string | null;
  details?: unknown;
}): void {
  if (input.channel === "DOWNLOAD") return;
  if (input.channel !== "API" && input.channel !== "MCP") return;
  const validity = resolveSearchEvaluationValidity({
    status: input.status,
    details: input.details,
    expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
  });
  if (validity.current) return;
  if (validity.reason === "RANKING_POLICY_STALE") {
    throw new PayloadServiceError(
      "SEARCH_EVALUATION_POLICY_STALE",
      "검색 순위 정책이 변경되었습니다. 자동 검색 평가를 다시 실행해 주세요.",
      409,
    );
  }
  throw new PayloadServiceError(
    "SEARCH_EVALUATION_REQUIRED",
    "자동 검색 평가를 먼저 완료해 주세요.",
    409,
  );
}

export function rerankDetailsFromStats(stats: RerankStats | null | undefined): Record<string, unknown> {
  if (!stats) return {};
  return {
    candidateCount: stats.candidateCount,
    deduplicatedCount: stats.deduplicatedCount,
    uniqueCandidateCount: Math.max(0, stats.candidateCount - stats.deduplicatedCount),
    finalResultCount: stats.finalResultCount,
  };
}

export function resolveConfirmationStatusDto(input: {
  confirmationStatus: string | null | undefined;
  runValidity: "CURRENT" | "STALE" | null;
}): ProviderConfirmationStatusDto {
  if (!input.confirmationStatus) return "NOT_REVIEWED";
  if (input.runValidity === "STALE") return "STALE";
  if (input.confirmationStatus === "CONFIRMED") return "CONFIRMED";
  if (input.confirmationStatus === "REJECTED") return "REJECTED";
  return "NOT_REVIEWED";
}
