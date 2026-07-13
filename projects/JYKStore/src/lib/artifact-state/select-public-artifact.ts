import {
  isExternalImportArtifactReady,
  toExternalImportArtifactInput,
} from "@/lib/artifact-state/adapters/external-import-artifact-adapter";
import { isLegacyArtifactVersion } from "@/lib/artifact-state/adapters/legacy-artifact-adapter";
import type { LatestPackArtifactVersionRow } from "@/lib/artifact-state/latest-pack-artifact-query";
import { toLatestPackVersionArtifactInput } from "@/lib/artifact-state/latest-pack-artifact-query";

export type PublicArtifactVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export type SelectedPublicArtifact =
  | {
      kind: "SOURCE_ORIGINAL";
      artifactId: string;
      versionId: string;
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      checksumSha256: string;
      visibility: PublicArtifactVisibility;
      allowDownload: boolean;
      generatorName: string | null;
    }
  | {
      kind: "KNOWLEDGE_PACKAGE";
      artifactId: string;
      versionId: string;
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      checksumSha256: string;
      visibility: PublicArtifactVisibility;
      allowDownload: boolean;
    }
  | {
      kind: "LEGACY";
      versionId: string;
    }
  | {
      kind: "INVALID";
      reason: string;
    };

/** Ops-only diagnostic when more than one public artifact is ready. */
export const PACK_MULTIPLE_PUBLIC_ARTIFACTS = "PACK_MULTIPLE_PUBLIC_ARTIFACTS" as const;

function toNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
  return Number.isFinite(value) ? value : 0;
}

function hasZipPayload(version: LatestPackArtifactVersionRow | null | undefined): boolean {
  return Boolean(version?.payload?.id);
}

function isZipDownloadable(version: LatestPackArtifactVersionRow | null | undefined): boolean {
  const payload = version?.payload;
  if (!payload?.id) return false;
  const status = payload.validationStatus;
  if (status != null && status !== "VALID") return false;
  return true;
}

function pickReadySourceOriginal(version: LatestPackArtifactVersionRow | null | undefined): {
  artifactId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  generatorName: string | null;
} | null {
  for (const bundle of version?.doclingImportBundles ?? []) {
    const input = toExternalImportArtifactInput(bundle);
    if (!isExternalImportArtifactReady(input)) continue;
    const file = bundle.files?.find((row) => row.role === "SOURCE_ORIGINAL");
    if (!file) continue;
    const objectKey = file.storageKey?.trim() ?? "";
    const artifactId = file.id?.trim() || bundle.id;
    return {
      artifactId,
      objectKey,
      originalFileName: file.originalFileName,
      mimeType: file.mimeType || "application/octet-stream",
      fileSize: toNumber(file.fileSize),
      checksumSha256: file.checksumSha256,
      generatorName: input.generatorName,
    };
  }
  return null;
}

export function diagnoseMultiplePublicArtifacts(
  version: LatestPackArtifactVersionRow | null | undefined,
): typeof PACK_MULTIPLE_PUBLIC_ARTIFACTS | null {
  const meta = version?.distributionMetadata;
  if (!meta) return null;
  const zipReady = hasZipPayload(version);
  const sourceReady = Boolean(pickReadySourceOriginal(version));
  if (zipReady && sourceReady) return PACK_MULTIPLE_PUBLIC_ARTIFACTS;
  return null;
}

/**
 * Single public download artifact selection for DTO, UI, and download service.
 * Policy: explicit primaryArtifactType when ready; else ZIP-first when both ready.
 */
export function selectPublicArtifact(
  version: LatestPackArtifactVersionRow | null | undefined,
): SelectedPublicArtifact {
  const versionId = version?.id?.trim() ?? "";
  const meta = version?.distributionMetadata ?? null;
  const zipDownloadable = Boolean(meta) && isZipDownloadable(version);
  const source = meta ? pickReadySourceOriginal(version) : null;
  const sourceReady = Boolean(source);
  const primary = meta?.primaryArtifactType ?? null;

  let chosen: "SOURCE_ORIGINAL" | "KNOWLEDGE_PACKAGE" | null = null;

  if (primary === "SOURCE_ORIGINAL" && sourceReady) {
    chosen = "SOURCE_ORIGINAL";
  } else if (primary === "KNOWLEDGE_PACKAGE" && zipDownloadable) {
    chosen = "KNOWLEDGE_PACKAGE";
  } else if (primary === "SOURCE_ORIGINAL" && !sourceReady && zipDownloadable) {
    chosen = "KNOWLEDGE_PACKAGE";
  } else if (primary === "KNOWLEDGE_PACKAGE" && !zipDownloadable && sourceReady) {
    chosen = "SOURCE_ORIGINAL";
  } else if (zipDownloadable && sourceReady) {
    chosen = "KNOWLEDGE_PACKAGE";
  } else if (zipDownloadable) {
    chosen = "KNOWLEDGE_PACKAGE";
  } else if (sourceReady) {
    chosen = "SOURCE_ORIGINAL";
  }

  if (chosen === "SOURCE_ORIGINAL" && source && meta) {
    return {
      kind: "SOURCE_ORIGINAL",
      artifactId: source.artifactId,
      versionId,
      objectKey: source.objectKey,
      originalFileName: source.originalFileName,
      mimeType: source.mimeType,
      fileSize: source.fileSize,
      checksumSha256: source.checksumSha256,
      visibility: meta.visibility,
      allowDownload: meta.allowDownload,
      generatorName: source.generatorName,
    };
  }

  if (chosen === "KNOWLEDGE_PACKAGE" && version?.payload && meta) {
    const payload = version.payload;
    return {
      kind: "KNOWLEDGE_PACKAGE",
      artifactId: payload.id,
      versionId,
      objectKey: payload.storagePath?.trim() ?? "",
      originalFileName: payload.originalFileName ?? "pack.zip",
      mimeType: payload.mimeType?.trim() || "application/zip",
      fileSize: toNumber(payload.fileSize),
      checksumSha256: payload.checksumSha256 ?? "",
      visibility: meta.visibility,
      allowDownload: meta.allowDownload,
    };
  }

  if (isLegacyArtifactVersion(toLatestPackVersionArtifactInput(version))) {
    return { kind: "LEGACY", versionId };
  }

  if (meta && !hasZipPayload(version) && !sourceReady) {
    return { kind: "INVALID", reason: "METADATA_WITHOUT_ARTIFACT" };
  }
  if (hasZipPayload(version) && !meta) {
    return { kind: "INVALID", reason: "PAYLOAD_WITHOUT_METADATA" };
  }
  return { kind: "INVALID", reason: "NO_ARTIFACT" };
}

export function selectedArtifactKindLabel(
  selected: SelectedPublicArtifact,
): "원본문서" | "지식팩 패키지" | null {
  if (selected.kind === "SOURCE_ORIGINAL") return "원본문서";
  if (selected.kind === "KNOWLEDGE_PACKAGE") return "지식팩 패키지";
  return null;
}
