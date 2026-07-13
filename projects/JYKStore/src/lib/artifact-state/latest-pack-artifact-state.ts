import { hasDistributionMetadata, hasDistributionZipPayload } from "@/lib/artifact-state/adapters/distribution-zip-artifact-adapter";
import {
  isExternalImportArtifactReady,
  pickReadyExternalImport,
} from "@/lib/artifact-state/adapters/external-import-artifact-adapter";
import { isLegacyArtifactVersion } from "@/lib/artifact-state/adapters/legacy-artifact-adapter";
import type {
  LatestPackArtifactState,
  LatestPackVersionArtifactInput,
} from "@/lib/artifact-state/types";

export type { LatestPackArtifactState, LatestPackVersionArtifactInput } from "@/lib/artifact-state/types";
export {
  isExternalImportArtifactReady,
  pickReadyExternalImport,
  toExternalImportArtifactInput,
} from "@/lib/artifact-state/adapters/external-import-artifact-adapter";
export {
  latestKnowledgePackVersionOrderBy,
  latestPackArtifactVersionInclude,
  toLatestPackVersionArtifactInput,
} from "@/lib/artifact-state/latest-pack-artifact-query";

/**
 * Resolve the latest version's public artifact state without tool-specific branching.
 */
export function resolveLatestPackArtifactState(
  version: LatestPackVersionArtifactInput,
): LatestPackArtifactState {
  const hasZip = hasDistributionZipPayload(version);
  const hasMeta = hasDistributionMetadata(version);
  const readyExternal = pickReadyExternalImport(version?.externalImports);
  const metadata = version?.distributionMetadata ?? null;

  if (hasZip && hasMeta && metadata) {
    return {
      kind: "DISTRIBUTION_ZIP",
      ready: true,
      visibility: metadata.visibility,
      allowDownload: metadata.allowDownload,
    };
  }

  if (readyExternal && hasMeta && metadata) {
    return {
      kind: "EXTERNAL_IMPORT",
      ready: true,
      visibility: metadata.visibility,
      allowDownload: metadata.allowDownload,
      generatorName: readyExternal.generatorName,
      normalizedDocumentReady: Boolean(readyExternal.normalizedDocument?.isActive),
    };
  }

  if (hasZip && !hasMeta) {
    return { kind: "INVALID", ready: false, reason: "PAYLOAD_WITHOUT_METADATA" };
  }

  if (hasMeta && !hasZip && !readyExternal) {
    const candidates = version?.externalImports ?? [];
    if (candidates.some((item) => item.isActive && item.status !== "REVIEW_READY")) {
      return { kind: "INVALID", ready: false, reason: "ARTIFACT_NOT_READY" };
    }
    if (
      candidates.some(
        (item) =>
          item.isActive &&
          item.status === "REVIEW_READY" &&
          item.storageStatus !== "ACTIVE",
      )
    ) {
      return { kind: "INVALID", ready: false, reason: "STORAGE_NOT_ACTIVE" };
    }
    if (
      candidates.some(
        (item) =>
          item.isActive &&
          item.status === "REVIEW_READY" &&
          item.storageStatus === "ACTIVE" &&
          !item.normalizedDocument?.isActive,
      )
    ) {
      return { kind: "INVALID", ready: false, reason: "NORMALIZED_DOCUMENT_MISSING" };
    }
    return { kind: "INVALID", ready: false, reason: "METADATA_WITHOUT_ARTIFACT" };
  }

  if (isLegacyArtifactVersion(version)) {
    return { kind: "LEGACY", ready: true };
  }

  return { kind: "INVALID", ready: false, reason: "NO_ARTIFACT" };
}

export function isLatestVersionCatalogVisible(
  state: LatestPackArtifactState,
  purpose: "list" | "detail",
): boolean {
  if (state.kind === "INVALID") return false;
  if (state.kind === "LEGACY") return true;
  return purpose === "list"
    ? state.visibility === "PUBLIC"
    : state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

export function canInstallLatestPackArtifact(state: LatestPackArtifactState): boolean {
  if (state.kind === "INVALID") return false;
  if (state.kind === "LEGACY") return true;
  return state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
}

export function canPubliclyDownloadLatestPack(state: LatestPackArtifactState): boolean {
  if (state.kind === "DISTRIBUTION_ZIP" || state.kind === "EXTERNAL_IMPORT") {
    if (!state.allowDownload) return false;
    return state.visibility === "PUBLIC" || state.visibility === "UNLISTED";
  }
  return false;
}

/** Ops/diagnostic code when a published pack is hidden from catalog. */
export function catalogHideReasonCode(state: LatestPackArtifactState): string | null {
  if (state.kind !== "INVALID") {
    if (
      (state.kind === "DISTRIBUTION_ZIP" || state.kind === "EXTERNAL_IMPORT") &&
      state.visibility === "PRIVATE"
    ) {
      return "PACK_CATALOG_VISIBILITY_PRIVATE";
    }
    return null;
  }
  switch (state.reason) {
    case "METADATA_WITHOUT_ARTIFACT":
      return "PACK_CATALOG_METADATA_WITHOUT_ARTIFACT";
    case "ARTIFACT_NOT_READY":
    case "NORMALIZED_DOCUMENT_MISSING":
    case "STORAGE_NOT_ACTIVE":
      return "PACK_CATALOG_EXTERNAL_IMPORT_NOT_READY";
    case "PAYLOAD_WITHOUT_METADATA":
      return "PACK_CATALOG_ARTIFACT_NOT_READY";
    default:
      return "PACK_CATALOG_ARTIFACT_NOT_READY";
  }
}

export function isExternalImportReadyForCatalog(
  input: Parameters<typeof isExternalImportArtifactReady>[0],
): boolean {
  return isExternalImportArtifactReady(input);
}
