import type {
  ServiceValidationChannel,
  ServiceValidationStatus,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import {
  isLegacySharedConfirmationMissingFingerprint,
  resolveSharedConfirmationStaleOverride,
} from "@/lib/distribution/service-validation-share";
import {
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
} from "@/lib/distribution/service-validation-policy";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

export type AdminHistoryVersionScope = "ALL" | "LATEST" | "VERSION";

export type AdminHistoryWhere = {
  packId: string;
  versionId?: string;
  channel?: ServiceValidationChannel;
  status?: ServiceValidationStatus;
  createdAt?: { gte?: Date; lte?: Date };
};

export function parseAdminHistoryDateBound(raw: string, endOfDay: boolean): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00.000`);
    if (endOfDay) d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(trimmed);
}

export function normalizeAdminHistoryPagination(input: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number } {
  return {
    page: Math.max(1, input.page ?? 1),
    pageSize: Math.min(100, Math.max(1, input.pageSize ?? 20)),
  };
}

export function resolveAdminHistoryVersionScope(input: {
  versions: Array<{ id: string }>;
  latestVersionId: string;
  versionId?: string | null;
  versionScope?: "ALL" | "LATEST" | null;
}): {
  versionScope: AdminHistoryVersionScope;
  filterVersionId: string | null;
} {
  const explicitVersionId = input.versionId?.trim() || null;
  const scopeRaw = (input.versionScope ?? "").toUpperCase();

  if (explicitVersionId) {
    const owned = input.versions.find((v) => v.id === explicitVersionId);
    if (!owned) {
      throw new PayloadServiceError(
        "NOT_FOUND",
        "선택한 버전이 이 지식팩에 속하지 않습니다.",
        404,
      );
    }
    return { versionScope: "VERSION", filterVersionId: owned.id };
  }
  if (scopeRaw === "LATEST") {
    return { versionScope: "LATEST", filterVersionId: input.latestVersionId };
  }
  return { versionScope: "ALL", filterVersionId: null };
}

export function buildAdminHistoryBaseWhere(input: {
  packId: string;
  filterVersionId: string | null;
  channel?: ServiceChannel | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): AdminHistoryWhere {
  const baseWhere: AdminHistoryWhere = { packId: input.packId };
  if (input.filterVersionId) baseWhere.versionId = input.filterVersionId;
  if (input.channel) baseWhere.channel = input.channel as ServiceValidationChannel;
  if (input.dateFrom || input.dateTo) {
    baseWhere.createdAt = {};
    if (input.dateFrom) {
      baseWhere.createdAt.gte = parseAdminHistoryDateBound(input.dateFrom, false);
    }
    if (input.dateTo) {
      baseWhere.createdAt.lte = parseAdminHistoryDateBound(input.dateTo, true);
    }
  }
  return baseWhere;
}

export function adminHistoryNeedsComputedFilter(input: {
  systemStatus?: string | null;
  providerConfirmationStatus?: string | null;
}): {
  needsComputedFilter: boolean;
  systemFilter: string | null;
  confFilter: string | null;
} {
  const confFilter = input.providerConfirmationStatus?.trim().toUpperCase() || null;
  const systemFilter = input.systemStatus?.trim().toUpperCase() || null;
  const needsComputedFilter =
    systemFilter === "STALE" ||
    systemFilter === "PASS" ||
    confFilter === "STALE" ||
    confFilter === "CONFIRMED" ||
    confFilter === "REJECTED" ||
    confFilter === "NOT_REVIEWED";
  return { needsComputedFilter, systemFilter, confFilter };
}

export function adminHistoryPaginationMeta(input: {
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  return {
    page: input.page,
    pageSize: input.pageSize,
    totalCount: input.totalCount,
    totalPages: Math.max(1, Math.ceil(input.totalCount / input.pageSize) || 1),
  };
}

/**
 * Pure policy: does a shared API/MCP confirmation legacy-fingerprint gap force STALE?
 * DB reads for the peer runs happen in the caller (loadSharedConfirmationPeerFingerprints).
 */
export function resolveAdminRunSharedConfirmationStaleOverride(input: {
  channel: string;
  sharedConfirmationGroupId: string | null | undefined;
  apiResultFingerprint: string | null | undefined;
  mcpResultFingerprint: string | null | undefined;
}): boolean {
  return resolveSharedConfirmationStaleOverride(input);
}

/** Pure policy: why an admin run is invalidated (or null if it isn't). */
export function resolveAdminRunInvalidationReason(input: {
  invalidatedAt: Date | null;
  evidenceIntegrity: "VALID" | "INVALID";
  status: string;
  validity: "CURRENT" | "STALE";
  channel: string;
  resultCount: number;
  sharedStaleOverride: boolean;
}): string | null {
  if (input.sharedStaleOverride) return "RESULT_FINGERPRINT_MISSING";
  if (input.invalidatedAt) return "INVALIDATED_AT";
  if (input.evidenceIntegrity === "INVALID" && input.status === "PASS") {
    return "PIPELINE_EVIDENCE_MISMATCH";
  }
  const isSearchChannel = input.channel === "API" || input.channel === "MCP";
  if (input.validity === "STALE" && isSearchChannel && input.resultCount < 1) {
    return "RESULT_SNAPSHOT_EMPTY";
  }
  if (input.validity === "STALE") return "BINDING_DRIFT";
  return null;
}

export type AdminHistoryCandidateRun = {
  status: string;
  channel: string;
  versionId: string;
  fingerprint: string | null;
  indexGenerationId: string | null;
  invalidatedAt: Date | null;
  details?: unknown;
  confirmation?: {
    status: string;
    sharedConfirmationGroupId: string | null;
  } | null;
  _count: { resultItems: number };
};

/**
 * Pure: whether a computed-filter candidate matches systemStatus / confirmation filters.
 * Peer fingerprints for shared confirmation are resolved by the caller.
 */
export function adminHistoryCandidateMatchesFilters(input: {
  run: AdminHistoryCandidateRun;
  versionBinding: { fingerprint: string; indexGenerationId: string } | null;
  systemFilter: string | null;
  confFilter: string | null;
  peers: Array<{
    run: { channel: string; resultFingerprint: string | null };
  }>;
}): boolean {
  const { run, systemFilter, confFilter } = input;
  let validity = resolveRunCurrentValidity({
    run: run as Parameters<typeof resolveRunCurrentValidity>[0]["run"],
    bindingFingerprint: input.versionBinding?.fingerprint,
    bindingIndexGenerationId: input.versionBinding?.indexGenerationId,
    resultItemCount: run.channel === "DOWNLOAD" ? null : run._count.resultItems,
    expectedRankingPolicyVersion:
      run.channel === "API" || run.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
  if (
    run.confirmation?.sharedConfirmationGroupId &&
    (run.channel === "API" || run.channel === "MCP")
  ) {
    const apiPeer = input.peers.find((p) => p.run.channel === "API")?.run;
    const mcpPeer = input.peers.find((p) => p.run.channel === "MCP")?.run;
    if (
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: run.confirmation.sharedConfirmationGroupId,
        apiResultFingerprint: apiPeer?.resultFingerprint,
        mcpResultFingerprint: mcpPeer?.resultFingerprint,
      })
    ) {
      validity = "STALE";
    }
  }
  const systemStatus = run.status === "PASS" && validity === "STALE" ? "STALE" : run.status;
  const providerConfirmationStatus = resolveConfirmationStatusDto({
    confirmationStatus: run.confirmation?.status,
    runValidity: validity,
  });

  if (systemFilter === "STALE" && systemStatus !== "STALE") return false;
  if (systemFilter === "PASS" && !(run.status === "PASS" && validity === "CURRENT")) {
    return false;
  }
  if (systemFilter === "FAIL" && run.status !== "FAIL") return false;
  if (confFilter && providerConfirmationStatus !== confFilter) return false;
  return true;
}
