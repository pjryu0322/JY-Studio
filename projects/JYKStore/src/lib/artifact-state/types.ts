import type { DistributionVisibility } from "@prisma/client";

export type ExternalImportArtifactInput = {
  bundleId: string;
  isActive: boolean;
  status: string;
  storageStatus: string;
  deletedAt: Date | null;
  normalizedDocument: {
    id: string;
    isActive: boolean;
  } | null;
  generatorName: string | null;
};

export type LatestPackArtifactState =
  | {
      kind: "LEGACY";
      ready: true;
    }
  | {
      kind: "EXTERNAL_IMPORT";
      ready: true;
      visibility: DistributionVisibility;
      allowDownload: boolean;
      generatorName: string | null;
      normalizedDocumentReady: boolean;
    }
  | {
      kind: "INVALID";
      ready: false;
      reason:
        | "NO_ARTIFACT"
        | "METADATA_WITHOUT_ARTIFACT"
        | "ARTIFACT_NOT_READY"
        | "NORMALIZED_DOCUMENT_MISSING"
        | "STORAGE_NOT_ACTIVE"
        | "VERSION_NOT_PUBLIC"
        | "PACK_PRIMARY_ARTIFACT_NOT_READY";
    };

export type LatestPackVersionArtifactInput = {
  distributionMetadata?: {
    visibility: DistributionVisibility;
    allowDownload: boolean;
  } | null;
  /** Generic external import bundle(s); adapters map tool-specific rows into this shape. */
  externalImports?: ExternalImportArtifactInput[] | null;
} | null | undefined;
