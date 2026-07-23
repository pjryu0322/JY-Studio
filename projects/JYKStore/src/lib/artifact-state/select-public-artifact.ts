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

      kind: "LEGACY";

      versionId: string;

    }

  | {

      kind: "INVALID";

      reason: string;

    };



/** Ops-only diagnostic when more than one public artifact is ready (Docling-only era: unused). */

export const PACK_MULTIPLE_PUBLIC_ARTIFACTS = "PACK_MULTIPLE_PUBLIC_ARTIFACTS" as const;



function toNumber(value: bigint | number | null | undefined): number {

  if (value == null) return 0;

  if (typeof value === "bigint") {

    const asNumber = Number(value);

    return Number.isFinite(asNumber) ? asNumber : 0;

  }

  return Number.isFinite(value) ? value : 0;

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

    const checksum = file.checksumSha256?.trim() ?? "";

    const fileSize = toNumber(file.fileSize);

    if (!objectKey || !checksum || fileSize <= 0) continue;

    const artifactId = file.id?.trim() || bundle.id;

    return {

      artifactId,

      objectKey,

      originalFileName: file.originalFileName,

      mimeType: file.mimeType || "application/octet-stream",

      fileSize,

      checksumSha256: checksum,

      generatorName: input.generatorName,

    };

  }

  return null;

}



export function diagnoseMultiplePublicArtifacts(

  _version: LatestPackArtifactVersionRow | null | undefined,

): typeof PACK_MULTIPLE_PUBLIC_ARTIFACTS | null {

  return null;

}



/**

 * Single public download artifact selection for DTO, UI, and download service.

 * Policy: Docling SOURCE_ORIGINAL only (ZIP / KNOWLEDGE_PACKAGE removed).

 */

export function selectPublicArtifact(

  version: LatestPackArtifactVersionRow | null | undefined,

): SelectedPublicArtifact {

  const versionId = version?.id?.trim() ?? "";

  const meta = version?.distributionMetadata ?? null;

  const source = meta ? pickReadySourceOriginal(version) : null;



  if (source && meta) {

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



  if (isLegacyArtifactVersion(toLatestPackVersionArtifactInput(version))) {

    return { kind: "LEGACY", versionId };

  }



  if (meta && !source) {

    return { kind: "INVALID", reason: "METADATA_WITHOUT_ARTIFACT" };

  }

  return { kind: "INVALID", reason: "NO_ARTIFACT" };

}



export function selectedArtifactKindLabel(

  selected: SelectedPublicArtifact,

): "원본문서" | null {

  if (selected.kind === "SOURCE_ORIGINAL") return "원본문서";

  return null;

}

