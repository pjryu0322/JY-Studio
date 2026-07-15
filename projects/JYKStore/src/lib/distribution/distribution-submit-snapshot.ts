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
  /** Provider-selected pack language at submit time. Legacy snapshots may omit. */
  language: PackLanguageCode | null;
  /** Knowledge pipeline binding — required for new submits; optional for legacy. */
  pipelineRunId?: string | null;
  indexGenerationId?: string | null;
  retrievalEvaluationStatus?: string | null;
  normalizedDocumentFingerprint?: string | null;
};

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
  language: PackLanguageCode;
  pipelineRunId?: string | null;
  indexGenerationId?: string | null;
  retrievalEvaluationStatus?: string | null;
  normalizedDocumentFingerprint?: string | null;
}): DoclingBundleReviewSubmitSnapshot {
  return {
    mode: "DOCLING_BUNDLE",
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
    language: input.language,
    pipelineRunId: input.pipelineRunId ?? null,
    indexGenerationId: input.indexGenerationId ?? null,
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

export function parseDoclingBundleReviewSubmitSnapshot(
  value: unknown,
): DoclingBundleReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "DOCLING_BUNDLE") return null;
  if (typeof raw.submittedAt !== "string") return null;
  if (typeof raw.submittedVersionId !== "string") return null;
  if (typeof raw.doclingBundleId !== "string") return null;
  if (typeof raw.sourceFileId !== "string") return null;
  if (typeof raw.jsonPayloadFileId !== "string") return null;
  if (
    raw.markdownPayloadFileId != null &&
    typeof raw.markdownPayloadFileId !== "string"
  ) {
    return null;
  }
  if (typeof raw.adapterVersion !== "string") return null;
  if (typeof raw.normalizedDocumentId !== "string") return null;
  if (typeof raw.licenseName !== "string") return null;
  if (!raw.checksums || typeof raw.checksums !== "object") return null;
  const checksums = raw.checksums as Record<string, unknown>;
  if (typeof checksums.source !== "string") return null;
  if (typeof checksums.json !== "string") return null;
  if (
    checksums.markdown != null &&
    typeof checksums.markdown !== "string"
  ) {
    return null;
  }

  // Legacy snapshots may omit language; invalid values coerce to null (still parse).
  const language: PackLanguageCode | null = isPackLanguageCode(raw.language)
    ? raw.language
    : null;

  return {
    mode: "DOCLING_BUNDLE",
    submittedAt: raw.submittedAt,
    submittedVersionId: raw.submittedVersionId,
    doclingBundleId: raw.doclingBundleId,
    sourceFileId: raw.sourceFileId,
    jsonPayloadFileId: raw.jsonPayloadFileId,
    markdownPayloadFileId:
      typeof raw.markdownPayloadFileId === "string"
        ? raw.markdownPayloadFileId
        : null,
    checksums: {
      source: checksums.source,
      json: checksums.json,
      markdown: typeof checksums.markdown === "string" ? checksums.markdown : null,
    },
    doclingSchemaVersion:
      typeof raw.doclingSchemaVersion === "string" ? raw.doclingSchemaVersion : null,
    adapterVersion: raw.adapterVersion,
    normalizedDocumentId: raw.normalizedDocumentId,
    fingerprint: typeof raw.fingerprint === "string" ? raw.fingerprint : null,
    warningCount: typeof raw.warningCount === "number" ? raw.warningCount : 0,
    sourceTitle: typeof raw.sourceTitle === "string" ? raw.sourceTitle : null,
    licenseName: raw.licenseName,
    visibility: typeof raw.visibility === "string" ? raw.visibility : "PRIVATE",
    allowDownload: raw.allowDownload !== false,
    language,
    pipelineRunId: typeof raw.pipelineRunId === "string" ? raw.pipelineRunId : null,
    indexGenerationId:
      typeof raw.indexGenerationId === "string" ? raw.indexGenerationId : null,
    retrievalEvaluationStatus:
      typeof raw.retrievalEvaluationStatus === "string"
        ? raw.retrievalEvaluationStatus
        : null,
    normalizedDocumentFingerprint:
      typeof raw.normalizedDocumentFingerprint === "string"
        ? raw.normalizedDocumentFingerprint
        : typeof raw.fingerprint === "string"
          ? raw.fingerprint
          : null,
  };
}

export function parseReviewSubmitSnapshot(value: unknown): ReviewSubmitSnapshot | null {
  return (
    parseDistributionReviewSubmitSnapshot(value) ??
    parseDoclingBundleReviewSubmitSnapshot(value)
  );
}
