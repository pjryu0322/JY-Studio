import type { DistributionVisibility, Prisma } from "@prisma/client";
import {
  canInstallLatestPackArtifact,
  canPubliclyDownloadLatestPack,
  isLatestVersionCatalogVisible as isArtifactCatalogVisible,
  resolveLatestPackArtifactState,
  toLatestPackVersionArtifactInput,
  type LatestPackArtifactState,
} from "@/lib/artifact-state/latest-pack-artifact-state";
import {
  latestKnowledgePackVersionOrderBy as artifactVersionOrderBy,
  latestPackArtifactVersionInclude,
  type LatestPackArtifactVersionRow,
} from "@/lib/artifact-state/latest-pack-artifact-query";

export const latestKnowledgePackVersionOrderBy = artifactVersionOrderBy;

/** Shared include for catalog / My Packs visibility resolution. */
export const distributionVersionAccessInclude = latestPackArtifactVersionInclude;

/**
 * Compatibility state used by existing catalog/My Packs callers.
 * Prefer LatestPackArtifactState for new code.
 */
export type LatestDistributionState =
  | { kind: "LEGACY" }
  | {
      kind: "DISTRIBUTION";
      visibility: DistributionVisibility;
      allowDownload: boolean;
      allowApi?: boolean;
      allowMcp?: boolean;
      serviceEndsAt?: Date | string | null;
      artifact?: "EXTERNAL_IMPORT";
      generatorName?: string | null;
    }
  | {
      kind: "INVALID_DISTRIBUTION";
      reason:
        | "METADATA_WITHOUT_PAYLOAD"
        | "METADATA_WITHOUT_ARTIFACT"
        | "ARTIFACT_NOT_READY"
        | "NORMALIZED_DOCUMENT_MISSING"
        | "STORAGE_NOT_ACTIVE";
    };

export type LatestDistributionVersionInput = LatestPackArtifactVersionRow | {
  distributionMetadata?: {
    visibility: DistributionVisibility;
    allowDownload: boolean;
    allowApi?: boolean;
    allowMcp?: boolean;
    serviceEndsAt?: Date | string | null;
  } | null;
  doclingImportBundles?: LatestPackArtifactVersionRow["doclingImportBundles"];
  externalImports?: import("@/lib/artifact-state/types").ExternalImportArtifactInput[] | null;
} | null | undefined;

function toCompatibilityState(state: LatestPackArtifactState): LatestDistributionState {
  switch (state.kind) {
    case "LEGACY":
      return { kind: "LEGACY" };
    case "EXTERNAL_IMPORT":
      return {
        kind: "DISTRIBUTION",
        visibility: state.visibility,
        allowDownload: state.allowDownload,
        allowApi: state.allowApi,
        allowMcp: state.allowMcp,
        serviceEndsAt: state.serviceEndsAt,
        artifact: "EXTERNAL_IMPORT",
        generatorName: state.generatorName,
      };
    case "INVALID":
      return {
        kind: "INVALID_DISTRIBUTION",
        reason:
          state.reason === "METADATA_WITHOUT_ARTIFACT"
            ? "METADATA_WITHOUT_PAYLOAD"
            : state.reason === "ARTIFACT_NOT_READY" ||
                state.reason === "NORMALIZED_DOCUMENT_MISSING" ||
                state.reason === "STORAGE_NOT_ACTIVE"
              ? state.reason
              : "METADATA_WITHOUT_PAYLOAD",
      };
    default:
      return { kind: "INVALID_DISTRIBUTION", reason: "METADATA_WITHOUT_PAYLOAD" };
  }
}

export function resolveLatestDistributionState(
  version: LatestDistributionVersionInput,
): LatestDistributionState {
  const artifactInput =
    version && "externalImports" in version && version.externalImports
      ? {
          distributionMetadata: version.distributionMetadata ?? null,
          externalImports: version.externalImports,
        }
      : toLatestPackVersionArtifactInput(version as LatestPackArtifactVersionRow | null | undefined);

  return toCompatibilityState(resolveLatestPackArtifactState(artifactInput));
}

export function isLatestVersionCatalogVisible(
  state: LatestDistributionState,
  purpose: "list" | "detail",
): boolean {
  return isArtifactCatalogVisible(fromCompatibilityState(state), purpose);
}

function fromCompatibilityState(state: LatestDistributionState): LatestPackArtifactState {
  if (state.kind === "LEGACY") return { kind: "LEGACY", ready: true };
  if (state.kind === "INVALID_DISTRIBUTION") {
    return {
      kind: "INVALID",
      ready: false,
      reason:
        state.reason === "METADATA_WITHOUT_PAYLOAD" || state.reason === "METADATA_WITHOUT_ARTIFACT"
          ? "METADATA_WITHOUT_ARTIFACT"
          : state.reason === "ARTIFACT_NOT_READY" ||
              state.reason === "NORMALIZED_DOCUMENT_MISSING" ||
              state.reason === "STORAGE_NOT_ACTIVE"
            ? state.reason
            : "METADATA_WITHOUT_ARTIFACT",
    };
  }
  return {
    kind: "EXTERNAL_IMPORT",
    ready: true,
    visibility: state.visibility,
    allowDownload: state.allowDownload,
    allowApi: state.allowApi ?? true,
    allowMcp: state.allowMcp ?? true,
    serviceEndsAt: state.serviceEndsAt ?? null,
    generatorName: state.generatorName ?? null,
    normalizedDocumentReady: true,
  };
}

/** My Packs install & list visibility for the latest version. */
export function canInstallLatestDistributionPack(state: LatestDistributionState): boolean {
  return canInstallLatestPackArtifact(fromCompatibilityState(state));
}

export function canShowInstalledPackInMyPacks(state: LatestDistributionState): boolean {
  return canInstallLatestDistributionPack(state);
}

/** Public catalog download for the latest version (Docling source original). */
export function canPubliclyDownloadLatestDistributionPack(
  state: LatestDistributionState,
): boolean {
  return canPubliclyDownloadLatestPack(fromCompatibilityState(state));
}

/** Re-export Prisma include typing helper for callers that need the include shape. */
export type DistributionVersionAccessInclude = typeof distributionVersionAccessInclude &
  Prisma.KnowledgePackVersionInclude;
