import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "@/lib/distribution/payload-types";
import type { PackLanguageCode } from "@/lib/pack-language";
import { isPackLanguageCode } from "@/lib/pack-language";

export type DistributionReviewSubmitSnapshot = {
  mode: "DISTRIBUTION";
  submittedAt: string;
  submittedVersionId: string;
  payloadId: string;
  payloadProfile: string;
  checksumSha256: string;
  validationStatus: "VALID";
  manifestSchemaVersion: string;
  manifestFingerprint: string;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
};

export type DoclingBundleReviewSubmitSnapshot = {
  mode: "DOCLING_BUNDLE";
  submittedAt: string;
  submittedVersionId: string;
  doclingBundleId: string;
  sourceFileId: string;
  jsonPayloadFileId: string;
  markdownPayloadFileId: string | null;
  checksums: {
    source: string;
    json: string;
    markdown: string | null;
  };
  doclingSchemaVersion: string | null;
  adapterVersion: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  warningCount: number;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
  allowApi?: boolean;
  allowMcp?: boolean;
  serviceEndsAt?: string | null;
  rightsBasis?: string | null;
  rightsBasisDetail?: string | null;
  rightsConfirmedAt?: string | null;
  sourceUrl?: string | null;
  sourcePublisherName?: string | null;
  sourceDocumentVersion?: string | null;
  sourcePublishedAt?: string | null;
  sourceRetrievedAt?: string | null;
  serviceValidation?: {
    API?: {
      status: string;
      runId: string | null;
      testedAt: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
    };
    MCP?: {
      status: string;
      runId: string | null;
      testedAt: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
    };
    DOWNLOAD?: {
      status: string;
      runId: string | null;
      testedAt: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
    };
  } | null;
  /** Search-validation preparation evidence (API+MCP+DOWNLOAD) at submit time. */
  preparationValidation?: {
    API?: {
      status: string;
      runId: string;
      testedAt: string | null;
      currentValidity?: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
      pipelineRunId?: string | null;
      normalizedDocumentId?: string | null;
      indexGenerationId?: string | null;
      fingerprint?: string | null;
      resultFingerprint?: string | null;
      downloadTestId?: string | null;
    };
    MCP?: {
      status: string;
      runId: string;
      testedAt: string | null;
      currentValidity?: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
      pipelineRunId?: string | null;
      normalizedDocumentId?: string | null;
      indexGenerationId?: string | null;
      fingerprint?: string | null;
      resultFingerprint?: string | null;
    };
    DOWNLOAD?: {
      status: string;
      runId: string;
      testedAt: string | null;
      currentValidity?: string | null;
      providerConfirmationStatus?: string | null;
      providerConfirmationId?: string | null;
      confirmedAt?: string | null;
      pipelineRunId?: string | null;
      normalizedDocumentId?: string | null;
      indexGenerationId?: string | null;
      fingerprint?: string | null;
      downloadTestId?: string | null;
    };
  } | null;
  distributionChannels?: {
    allowApi: boolean;
    allowMcp: boolean;
    allowDownload: boolean;
  } | null;
  /** Provider-selected pack language at submit time. Legacy snapshots may omit. */
  language: PackLanguageCode | null;
  /** Knowledge pipeline binding — required for new submits; optional for legacy. */
  pipelineRunId?: string | null;
  indexGenerationId?: string | null;
  /** P4: explicit search-index generation binding (Version 2+). */
  searchIndexGenerationId?: string | null;
  /** P4.1 Snapshot V3: generation fingerprint and embedding descriptor. */
  searchGenerationFingerprint?: string | null;
  chunkGenerationId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  /** P5 hardening: pinned model revision (commit SHA) or "legacy-unknown". */
  embeddingModelRevision?: string | null;
  embeddingDimension?: number | null;
  distanceMetric?: string | null;
  retrievalEvaluationStatus?: string | null;
  normalizedDocumentFingerprint?: string | null;
  /**
   * Snapshot schema version. Absent/1 = legacy (serviceValidation only).
   * 2 = three-channel preparationValidation + distributionChannels required.
   * 3 = V2 + READY SearchIndexGeneration binding fields required.
   */
  snapshotSchemaVersion?: number;
};

export const REVIEW_SUBMIT_SNAPSHOT_VERSION = 3 as const;

export type ReviewSubmitSnapshot =
  | DistributionReviewSubmitSnapshot
  | DoclingBundleReviewSubmitSnapshot;

export function buildDistributionReviewSubmitSnapshot(input: {
  submittedVersionId: string;
  payloadId: string;
  payloadProfile: string;
  checksumSha256: string;
  manifestFingerprint: string;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
}): DistributionReviewSubmitSnapshot {
  return {
    mode: "DISTRIBUTION",
    submittedAt: new Date().toISOString(),
    submittedVersionId: input.submittedVersionId,
    payloadId: input.payloadId,
    payloadProfile: input.payloadProfile,
    checksumSha256: input.checksumSha256,
    validationStatus: "VALID",
    manifestSchemaVersion: DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
    manifestFingerprint: input.manifestFingerprint,
    sourceTitle: input.sourceTitle,
    licenseName: input.licenseName,
    visibility: input.visibility,
    allowDownload: input.allowDownload,
  };
}

export function buildDoclingBundleReviewSubmitSnapshot(input: {
  submittedVersionId: string;
  doclingBundleId: string;
  sourceFileId: string;
  jsonPayloadFileId: string;
  markdownPayloadFileId: string | null;
  checksums: { source: string; json: string; markdown: string | null };
  doclingSchemaVersion: string | null;
  adapterVersion: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  warningCount: number;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
  allowApi?: boolean;
  allowMcp?: boolean;
  serviceEndsAt?: string | null;
  rightsBasis?: string | null;
  rightsBasisDetail?: string | null;
  rightsConfirmedAt?: string | null;
  sourceUrl?: string | null;
  sourcePublisherName?: string | null;
  sourceDocumentVersion?: string | null;
  sourcePublishedAt?: string | null;
  sourceRetrievedAt?: string | null;
  serviceValidation?: DoclingBundleReviewSubmitSnapshot["serviceValidation"];
  preparationValidation?: DoclingBundleReviewSubmitSnapshot["preparationValidation"];
  distributionChannels?: DoclingBundleReviewSubmitSnapshot["distributionChannels"];
  language: PackLanguageCode;
  pipelineRunId?: string | null;
  indexGenerationId?: string | null;
  searchIndexGenerationId?: string | null;
  searchGenerationFingerprint?: string | null;
  chunkGenerationId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingModelRevision?: string | null;
  embeddingDimension?: number | null;
  distanceMetric?: string | null;
  retrievalEvaluationStatus?: string | null;
  normalizedDocumentFingerprint?: string | null;
  snapshotSchemaVersion?: number;
}): DoclingBundleReviewSubmitSnapshot {
  return {
    mode: "DOCLING_BUNDLE",
    snapshotSchemaVersion: input.snapshotSchemaVersion ?? REVIEW_SUBMIT_SNAPSHOT_VERSION,
    submittedAt: new Date().toISOString(),
    submittedVersionId: input.submittedVersionId,
    doclingBundleId: input.doclingBundleId,
    sourceFileId: input.sourceFileId,
    jsonPayloadFileId: input.jsonPayloadFileId,
    markdownPayloadFileId: input.markdownPayloadFileId,
    checksums: input.checksums,
    doclingSchemaVersion: input.doclingSchemaVersion,
    adapterVersion: input.adapterVersion,
    normalizedDocumentId: input.normalizedDocumentId,
    fingerprint: input.fingerprint,
    warningCount: input.warningCount,
    sourceTitle: input.sourceTitle,
    licenseName: input.licenseName,
    visibility: input.visibility,
    allowDownload: input.allowDownload,
    allowApi: input.allowApi ?? true,
    allowMcp: input.allowMcp ?? true,
    serviceEndsAt: input.serviceEndsAt ?? null,
    rightsBasis: input.rightsBasis ?? null,
    rightsBasisDetail: input.rightsBasisDetail ?? null,
    rightsConfirmedAt: input.rightsConfirmedAt ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourcePublisherName: input.sourcePublisherName ?? null,
    sourceDocumentVersion: input.sourceDocumentVersion ?? null,
    sourcePublishedAt: input.sourcePublishedAt ?? null,
    sourceRetrievedAt: input.sourceRetrievedAt ?? null,
    serviceValidation: input.serviceValidation ?? null,
    preparationValidation: input.preparationValidation ?? null,
    distributionChannels: input.distributionChannels ?? null,
    language: input.language,
    pipelineRunId: input.pipelineRunId ?? null,
    indexGenerationId: input.indexGenerationId ?? null,
    searchIndexGenerationId: input.searchIndexGenerationId ?? null,
    searchGenerationFingerprint: input.searchGenerationFingerprint ?? null,
    chunkGenerationId: input.chunkGenerationId ?? null,
    embeddingProvider: input.embeddingProvider ?? null,
    embeddingModel: input.embeddingModel ?? null,
    embeddingModelRevision: input.embeddingModelRevision ?? null,
    embeddingDimension: input.embeddingDimension ?? null,
    distanceMetric: input.distanceMetric ?? null,
    retrievalEvaluationStatus: input.retrievalEvaluationStatus ?? null,
    normalizedDocumentFingerprint:
      input.normalizedDocumentFingerprint ?? input.fingerprint ?? null,
  };
}

export function parseDistributionReviewSubmitSnapshot(
  value: unknown,
): DistributionReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "DISTRIBUTION") return null;
  if (typeof raw.submittedAt !== "string") return null;
  if (typeof raw.submittedVersionId !== "string") return null;
  if (typeof raw.payloadId !== "string") return null;
  if (typeof raw.payloadProfile !== "string") return null;
  if (typeof raw.checksumSha256 !== "string") return null;
  if (raw.validationStatus !== "VALID") return null;
  if (typeof raw.manifestSchemaVersion !== "string") return null;
  if (typeof raw.licenseName !== "string") return null;

  return {
    mode: "DISTRIBUTION",
    submittedAt: raw.submittedAt,
    submittedVersionId: raw.submittedVersionId,
    payloadId: raw.payloadId,
    payloadProfile: raw.payloadProfile,
    checksumSha256: raw.checksumSha256,
    validationStatus: "VALID",
    manifestSchemaVersion: raw.manifestSchemaVersion,
    manifestFingerprint:
      typeof raw.manifestFingerprint === "string" ? raw.manifestFingerprint : "",
    sourceTitle: typeof raw.sourceTitle === "string" ? raw.sourceTitle : null,
    licenseName: raw.licenseName,
    visibility: typeof raw.visibility === "string" ? raw.visibility : "PRIVATE",
    allowDownload: raw.allowDownload !== false,
  };
}

/** Pure: required identity/file-id fields must be present and correctly typed. */
function isValidDoclingBundleSnapshotCoreShape(raw: Record<string, unknown>): boolean {
  return (
    raw.mode === "DOCLING_BUNDLE" &&
    typeof raw.submittedAt === "string" &&
    typeof raw.submittedVersionId === "string" &&
    typeof raw.doclingBundleId === "string" &&
    typeof raw.sourceFileId === "string" &&
    typeof raw.jsonPayloadFileId === "string" &&
    (raw.markdownPayloadFileId == null || typeof raw.markdownPayloadFileId === "string") &&
    typeof raw.adapterVersion === "string" &&
    typeof raw.normalizedDocumentId === "string" &&
    typeof raw.licenseName === "string"
  );
}

/** Pure: parse + validate the nested checksums object, or null when malformed. */
function parseSnapshotChecksums(
  raw: Record<string, unknown>,
): DoclingBundleReviewSubmitSnapshot["checksums"] | null {
  if (!raw.checksums || typeof raw.checksums !== "object") return null;
  const checksums = raw.checksums as Record<string, unknown>;
  if (typeof checksums.source !== "string" || typeof checksums.json !== "string") return null;
  if (checksums.markdown != null && typeof checksums.markdown !== "string") return null;
  return {
    source: checksums.source,
    json: checksums.json,
    markdown: typeof checksums.markdown === "string" ? checksums.markdown : null,
  };
}

/** Pure: provider-facing source/rights/license metadata (all optional, legacy-tolerant). */
function parseSnapshotProviderMetadataFields(raw: Record<string, unknown>) {
  return {
    doclingSchemaVersion:
      typeof raw.doclingSchemaVersion === "string" ? raw.doclingSchemaVersion : null,
    warningCount: typeof raw.warningCount === "number" ? raw.warningCount : 0,
    sourceTitle: typeof raw.sourceTitle === "string" ? raw.sourceTitle : null,
    visibility: typeof raw.visibility === "string" ? raw.visibility : "PRIVATE",
    allowDownload: raw.allowDownload !== false,
    allowApi: raw.allowApi !== false,
    allowMcp: raw.allowMcp !== false,
    serviceEndsAt: typeof raw.serviceEndsAt === "string" ? raw.serviceEndsAt : null,
    rightsBasis: typeof raw.rightsBasis === "string" ? raw.rightsBasis : null,
    rightsBasisDetail: typeof raw.rightsBasisDetail === "string" ? raw.rightsBasisDetail : null,
    rightsConfirmedAt: typeof raw.rightsConfirmedAt === "string" ? raw.rightsConfirmedAt : null,
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null,
    sourcePublisherName:
      typeof raw.sourcePublisherName === "string" ? raw.sourcePublisherName : null,
    sourceDocumentVersion:
      typeof raw.sourceDocumentVersion === "string" ? raw.sourceDocumentVersion : null,
    sourcePublishedAt: typeof raw.sourcePublishedAt === "string" ? raw.sourcePublishedAt : null,
    sourceRetrievedAt: typeof raw.sourceRetrievedAt === "string" ? raw.sourceRetrievedAt : null,
  };
}

/** Pure: the three nested validation/channel objects (opaque — shape enforced elsewhere). */
function parseSnapshotValidationFields(raw: Record<string, unknown>) {
  return {
    serviceValidation:
      raw.serviceValidation && typeof raw.serviceValidation === "object"
        ? (raw.serviceValidation as DoclingBundleReviewSubmitSnapshot["serviceValidation"])
        : null,
    preparationValidation:
      raw.preparationValidation && typeof raw.preparationValidation === "object"
        ? (raw.preparationValidation as DoclingBundleReviewSubmitSnapshot["preparationValidation"])
        : null,
    distributionChannels:
      raw.distributionChannels && typeof raw.distributionChannels === "object"
        ? (raw.distributionChannels as DoclingBundleReviewSubmitSnapshot["distributionChannels"])
        : null,
  };
}

/** Pure: knowledge-pipeline / search-generation binding fields (V2/V3 evidence). */
function parseSnapshotBindingFields(raw: Record<string, unknown>, fingerprint: string | null) {
  return {
    pipelineRunId: typeof raw.pipelineRunId === "string" ? raw.pipelineRunId : null,
    indexGenerationId: typeof raw.indexGenerationId === "string" ? raw.indexGenerationId : null,
    searchIndexGenerationId:
      typeof raw.searchIndexGenerationId === "string" ? raw.searchIndexGenerationId : null,
    searchGenerationFingerprint:
      typeof raw.searchGenerationFingerprint === "string"
        ? raw.searchGenerationFingerprint
        : null,
    chunkGenerationId: typeof raw.chunkGenerationId === "string" ? raw.chunkGenerationId : null,
    embeddingProvider: typeof raw.embeddingProvider === "string" ? raw.embeddingProvider : null,
    embeddingModel: typeof raw.embeddingModel === "string" ? raw.embeddingModel : null,
    embeddingModelRevision:
      typeof raw.embeddingModelRevision === "string" ? raw.embeddingModelRevision : null,
    embeddingDimension:
      typeof raw.embeddingDimension === "number" ? raw.embeddingDimension : null,
    distanceMetric: typeof raw.distanceMetric === "string" ? raw.distanceMetric : null,
    retrievalEvaluationStatus:
      typeof raw.retrievalEvaluationStatus === "string" ? raw.retrievalEvaluationStatus : null,
    normalizedDocumentFingerprint:
      typeof raw.normalizedDocumentFingerprint === "string"
        ? raw.normalizedDocumentFingerprint
        : fingerprint,
    snapshotSchemaVersion:
      typeof raw.snapshotSchemaVersion === "number" ? raw.snapshotSchemaVersion : undefined,
  };
}

export function parseDoclingBundleReviewSubmitSnapshot(
  value: unknown,
): DoclingBundleReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isValidDoclingBundleSnapshotCoreShape(raw)) return null;
  const checksums = parseSnapshotChecksums(raw);
  if (!checksums) return null;

  // Legacy snapshots may omit language; invalid values coerce to null (still parse).
  const language: PackLanguageCode | null = isPackLanguageCode(raw.language) ? raw.language : null;
  const fingerprint = typeof raw.fingerprint === "string" ? raw.fingerprint : null;

  return {
    mode: "DOCLING_BUNDLE",
    submittedAt: raw.submittedAt as string,
    submittedVersionId: raw.submittedVersionId as string,
    doclingBundleId: raw.doclingBundleId as string,
    sourceFileId: raw.sourceFileId as string,
    jsonPayloadFileId: raw.jsonPayloadFileId as string,
    markdownPayloadFileId:
      typeof raw.markdownPayloadFileId === "string" ? raw.markdownPayloadFileId : null,
    checksums,
    adapterVersion: raw.adapterVersion as string,
    normalizedDocumentId: raw.normalizedDocumentId as string,
    licenseName: raw.licenseName as string,
    fingerprint,
    language,
    ...parseSnapshotProviderMetadataFields(raw),
    ...parseSnapshotValidationFields(raw),
    ...parseSnapshotBindingFields(raw, fingerprint),
  };
}

/**
 * True when the snapshot is a Version 2 review snapshot: three-channel
 * preparationValidation with required binding fields + distributionChannels.
 */
export function isReviewSubmitSnapshotV2(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): boolean {
  if ((snapshot.snapshotSchemaVersion ?? 1) < 2) return false;
  const prep = snapshot.preparationValidation;
  if (!prep) return false;
  for (const channel of ["API", "MCP", "DOWNLOAD"] as const) {
    const entry = prep[channel];
    if (!entry) return false;
    if (typeof entry.runId !== "string" || entry.runId.length === 0) return false;
    if (entry.status !== "PASS") return false;
    if (entry.currentValidity != null && entry.currentValidity !== "CURRENT") return false;
    if (entry.providerConfirmationStatus !== "CONFIRMED") return false;
    if (typeof entry.providerConfirmationId !== "string" || entry.providerConfirmationId.length === 0) {
      return false;
    }
    if (typeof entry.pipelineRunId !== "string" || entry.pipelineRunId.length === 0) return false;
    if (typeof entry.normalizedDocumentId !== "string" || entry.normalizedDocumentId.length === 0) {
      return false;
    }
    if (typeof entry.fingerprint !== "string" || entry.fingerprint.length === 0) return false;
    const genId =
      (entry as { indexGenerationId?: unknown }).indexGenerationId ??
      (entry as { searchIndexGenerationId?: unknown }).searchIndexGenerationId;
    if (typeof genId !== "string" || genId.length === 0) return false;
  }
  return Boolean(snapshot.distributionChannels);
}

/**
 * Version 3: V2 requirements plus READY SearchIndexGeneration binding fields.
 * Version 1·2 remain readable via parse; only V3 is accepted for new submits.
 * P5.1: embeddingModelRevision must be a pinned 40-char commit SHA (not legacy-unknown).
 */
export function isReviewSubmitSnapshotV3(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): boolean {
  if ((snapshot.snapshotSchemaVersion ?? 1) < 3) return false;
  if (!isReviewSubmitSnapshotV2(snapshot)) return false;
  if (
    typeof snapshot.searchIndexGenerationId !== "string" ||
    snapshot.searchIndexGenerationId.length === 0
  ) {
    return false;
  }
  if (
    typeof snapshot.searchGenerationFingerprint !== "string" ||
    snapshot.searchGenerationFingerprint.length === 0
  ) {
    return false;
  }
  if (typeof snapshot.chunkGenerationId !== "string" || snapshot.chunkGenerationId.length === 0) {
    return false;
  }
  if (typeof snapshot.embeddingProvider !== "string" || snapshot.embeddingProvider.length === 0) {
    return false;
  }
  if (typeof snapshot.embeddingModel !== "string" || snapshot.embeddingModel.length === 0) {
    return false;
  }
  if (
    typeof snapshot.embeddingModelRevision !== "string" ||
    snapshot.embeddingModelRevision.length === 0 ||
    snapshot.embeddingModelRevision === "legacy-unknown" ||
    !/^[0-9a-f]{40}$/.test(snapshot.embeddingModelRevision)
  ) {
    return false;
  }
  if (typeof snapshot.embeddingDimension !== "number" || snapshot.embeddingDimension <= 0) {
    return false;
  }
  if (typeof snapshot.distanceMetric !== "string" || snapshot.distanceMetric.length === 0) {
    return false;
  }
  if (snapshot.retrievalEvaluationStatus !== "PASS") {
    return false;
  }
  return true;
}

export function parseReviewSubmitSnapshot(value: unknown): ReviewSubmitSnapshot | null {
  return (
    parseDistributionReviewSubmitSnapshot(value) ??
    parseDoclingBundleReviewSubmitSnapshot(value)
  );
}
