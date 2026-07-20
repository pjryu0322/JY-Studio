import { createHash } from "node:crypto";

export type ShareableValidationRun = {
  status: string;
  query: string | null;
  pipelineRunId: string | null;
  indexGenerationId: string | null;
  fingerprint: string | null;
  normalizedDocumentId: string | null;
  resultCount: number | null;
  resultFingerprint?: string | null;
  invalidatedAt?: Date | null;
  /** From run.details.retrievalRankingPolicyVersion (API/MCP). */
  rankingPolicyVersion?: string | null;
};

export type ShareableResultItem = {
  rank: number;
  chunkId: string;
  sourceDocumentId: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ShareBinding = {
  fingerprint?: string | null;
  indexGenerationId?: string | null;
  normalizedDocumentId?: string | null;
  pipelineRunId?: string | null;
};

export function normalizeValidationQuery(query: string | null | undefined): string {
  return (query ?? "").replace(/\s+/g, " ").trim();
}

export function computeResultFingerprint(input: {
  query: string | null | undefined;
  indexGenerationId: string | null | undefined;
  items: ShareableResultItem[];
  /** When set, included so ranking-policy changes invalidate prior fingerprints. */
  rankingPolicyVersion?: string | null;
}): string {
  const normalizedQuery = normalizeValidationQuery(input.query);
  const rows = [...input.items]
    .sort((a, b) => a.rank - b.rank)
    .map(
      (item) =>
        `${item.rank}:${item.chunkId}:${item.sourceDocumentId}:${item.pageStart ?? ""}:${item.pageEnd ?? ""}`,
    )
    .join("|");
  const payload = [
    normalizedQuery,
    input.indexGenerationId ?? "",
    input.rankingPolicyVersion?.trim() || "",
    rows,
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function compareShareableResultItems(
  left: ShareableResultItem[],
  right: ShareableResultItem[],
): boolean {
  if (left.length !== right.length) return false;
  if (left.length === 0) return false;
  const a = [...left].sort((x, y) => x.rank - y.rank);
  const b = [...right].sort((x, y) => x.rank - y.rank);
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.rank !== y.rank ||
      x.chunkId !== y.chunkId ||
      x.sourceDocumentId !== y.sourceDocumentId ||
      x.pageStart !== y.pageStart ||
      x.pageEnd !== y.pageEnd
    ) {
      return false;
    }
  }
  return true;
}

function isCurrentAgainstBinding(
  run: ShareableValidationRun,
  binding: ShareBinding | null | undefined,
): boolean {
  if (run.invalidatedAt) return false;
  if (run.status !== "PASS") return false;
  if (
    binding?.fingerprint &&
    run.fingerprint &&
    run.fingerprint !== binding.fingerprint
  ) {
    return false;
  }
  if (
    binding?.indexGenerationId &&
    run.indexGenerationId &&
    run.indexGenerationId !== binding.indexGenerationId
  ) {
    return false;
  }
  return true;
}

/** Pure: both runs PASSed and are still current against the shared binding. */
function runsPassAndCurrent(
  apiRun: ShareableValidationRun,
  mcpRun: ShareableValidationRun,
  binding?: ShareBinding | null,
): boolean {
  if (apiRun.status !== "PASS" || mcpRun.status !== "PASS") return false;
  return isCurrentAgainstBinding(apiRun, binding) && isCurrentAgainstBinding(mcpRun, binding);
}

/** Pure: both runs were tested with the same query against the same knowledge binding. */
function runsShareSameQueryAndBinding(
  apiRun: ShareableValidationRun,
  mcpRun: ShareableValidationRun,
): boolean {
  if (normalizeValidationQuery(apiRun.query) !== normalizeValidationQuery(mcpRun.query)) {
    return false;
  }
  return (
    (apiRun.pipelineRunId ?? "") === (mcpRun.pipelineRunId ?? "") &&
    (apiRun.indexGenerationId ?? "") === (mcpRun.indexGenerationId ?? "") &&
    (apiRun.fingerprint ?? "") === (mcpRun.fingerprint ?? "") &&
    (apiRun.normalizedDocumentId ?? "") === (mcpRun.normalizedDocumentId ?? "") &&
    (apiRun.resultCount ?? -1) === (mcpRun.resultCount ?? -2)
  );
}

/** Pure: both retrieval snapshots are non-empty, equal length, and item-for-item equal. */
function resultSnapshotsMatch(
  apiResults: ShareableResultItem[],
  mcpResults: ShareableResultItem[],
): boolean {
  if (apiResults.length === 0 || mcpResults.length === 0) return false;
  if (apiResults.length !== mcpResults.length) return false;
  return compareShareableResultItems(apiResults, mcpResults);
}

/** Pure: both runs used the same ranking policy and have equal, non-empty result fingerprints. */
function rankingPolicyAndFingerprintMatch(
  apiRun: ShareableValidationRun,
  mcpRun: ShareableValidationRun,
): boolean {
  const apiPolicy = (apiRun.rankingPolicyVersion ?? "").trim();
  const mcpPolicy = (mcpRun.rankingPolicyVersion ?? "").trim();
  if (!apiPolicy || !mcpPolicy || apiPolicy !== mcpPolicy) return false;

  const apiFp = apiRun.resultFingerprint?.trim() ?? "";
  const mcpFp = mcpRun.resultFingerprint?.trim() ?? "";
  if (!apiFp || !mcpFp) return false;
  return apiFp === mcpFp;
}

/**
 * Shared API+MCP provider confirmation is allowed only when system runs
 * and retrieval snapshots are effectively identical.
 */
export function canShareProviderConfirmation(input: {
  apiRun: ShareableValidationRun | null | undefined;
  mcpRun: ShareableValidationRun | null | undefined;
  apiResults: ShareableResultItem[];
  mcpResults: ShareableResultItem[];
  binding?: ShareBinding | null;
}): boolean {
  const { apiRun, mcpRun, apiResults, mcpResults, binding } = input;
  if (!apiRun || !mcpRun) return false;
  return (
    runsPassAndCurrent(apiRun, mcpRun, binding) &&
    runsShareSameQueryAndBinding(apiRun, mcpRun) &&
    resultSnapshotsMatch(apiResults, mcpResults) &&
    rankingPolicyAndFingerprintMatch(apiRun, mcpRun)
  );
}

export type SharedConfirmationEvidenceFailure = {
  ok: false;
  code: "SERVICE_VALIDATION_EVIDENCE_MISMATCH";
  message: string;
  reason: "RESULT_FINGERPRINT_MISSING" | "RESULT_FINGERPRINT_MISMATCH" | "RESULT_SNAPSHOT_MISMATCH";
};

/**
 * Shared API+MCP confirmation requires stored fingerprints and identical snapshots.
 * Legacy shared confirmations without fingerprints must not pass submit/admin gates.
 */
export function assertSharedConfirmationEvidence(input: {
  apiRun: Pick<ShareableValidationRun, "resultFingerprint" | "resultCount"> | null | undefined;
  mcpRun: Pick<ShareableValidationRun, "resultFingerprint" | "resultCount"> | null | undefined;
  apiResults: ShareableResultItem[];
  mcpResults: ShareableResultItem[];
}): { ok: true } | SharedConfirmationEvidenceFailure {
  const { apiRun, mcpRun, apiResults, mcpResults } = input;
  if (!apiRun || !mcpRun) {
    return {
      ok: false,
      code: "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      message: "공통 품질 확인 증적이 이전 형식이므로 다시 검증해 주세요.",
      reason: "RESULT_FINGERPRINT_MISSING",
    };
  }
  const apiFp = apiRun.resultFingerprint?.trim() ?? "";
  const mcpFp = mcpRun.resultFingerprint?.trim() ?? "";
  if (!apiFp || !mcpFp) {
    return {
      ok: false,
      code: "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      message: "공통 품질 확인 증적이 이전 형식이므로 다시 검증해 주세요.",
      reason: "RESULT_FINGERPRINT_MISSING",
    };
  }
  if (apiFp !== mcpFp) {
    return {
      ok: false,
      code: "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      message: "공통 품질 확인 증적의 검색 결과가 일치하지 않습니다. 다시 검증해 주세요.",
      reason: "RESULT_FINGERPRINT_MISMATCH",
    };
  }
  if (
    apiResults.length < 1 ||
    mcpResults.length < 1 ||
    !compareShareableResultItems(apiResults, mcpResults)
  ) {
    return {
      ok: false,
      code: "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      message: "공통 품질 확인 증적의 검색 결과가 일치하지 않습니다. 다시 검증해 주세요.",
      reason: "RESULT_SNAPSHOT_MISMATCH",
    };
  }
  return { ok: true };
}

/** True when a shared confirmation lacks usable stored result fingerprints. */
export function isLegacySharedConfirmationMissingFingerprint(input: {
  sharedConfirmationGroupId?: string | null;
  apiResultFingerprint?: string | null;
  mcpResultFingerprint?: string | null;
}): boolean {
  if (!input.sharedConfirmationGroupId?.trim()) return false;
  const apiFp = input.apiResultFingerprint?.trim() ?? "";
  const mcpFp = input.mcpResultFingerprint?.trim() ?? "";
  return !apiFp || !mcpFp;
}

/**
 * Pure policy: does a shared API/MCP confirmation legacy-fingerprint gap force STALE
 * for this channel? DB reads for the peer runs happen in the caller.
 */
export function resolveSharedConfirmationStaleOverride(input: {
  channel: string;
  sharedConfirmationGroupId: string | null | undefined;
  apiResultFingerprint: string | null | undefined;
  mcpResultFingerprint: string | null | undefined;
}): boolean {
  if (!input.sharedConfirmationGroupId) return false;
  if (input.channel !== "API" && input.channel !== "MCP") return false;
  return isLegacySharedConfirmationMissingFingerprint({
    sharedConfirmationGroupId: input.sharedConfirmationGroupId,
    apiResultFingerprint: input.apiResultFingerprint,
    mcpResultFingerprint: input.mcpResultFingerprint,
  });
}
