import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "@/lib/distribution/payload-types";

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
