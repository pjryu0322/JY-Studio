import type { Prisma } from "@prisma/client";
import { toExternalImportArtifactInput } from "@/lib/artifact-state/adapters/external-import-artifact-adapter";
import type {
  ExternalImportArtifactInput,
  LatestPackVersionArtifactInput,
} from "@/lib/artifact-state/types";

export const latestKnowledgePackVersionOrderBy: Prisma.KnowledgePackVersionOrderByWithRelationInput[] =
  [{ createdAt: "desc" }, { id: "desc" }];

/**
 * Shared include for catalog / My Packs artifact visibility.
 * Concrete import models stay in the query layer; callers map via toLatestPackVersionArtifactInput.
 */
export const latestPackArtifactVersionInclude = {
  payload: {
    select: {
      id: true,
      validationStatus: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      checksumSha256: true,
      storagePath: true,
    },
  },
  distributionMetadata: {
    select: {
      visibility: true,
      allowDownload: true,
      sourceTitle: true,
      sourceUrl: true,
      sourcePublisherName: true,
      sourcePublisherUrl: true,
      sourceDocumentVersion: true,
      sourcePublishedAt: true,
      sourceRetrievedAt: true,
      licenseName: true,
      licenseUrl: true,
      usageTerms: true,
      primaryArtifactType: true,
      contentType: true,
    },
  },
  doclingImportBundles: {
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" as const }, { createdAt: "desc" as const }],
    take: 3,
    select: {
      id: true,
      isActive: true,
      status: true,
      storageStatus: true,
      deletedAt: true,
      adapterType: true,
      normalizedDocuments: {
        where: { isActive: true },
        take: 1,
        select: { id: true, isActive: true },
      },
      files: {
        where: { role: "SOURCE_ORIGINAL" as const },
        take: 1,
        select: {
          id: true,
          role: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          checksumSha256: true,
          storageKey: true,
        },
      },
    },
  },
  _count: {
    select: {
      chunks: { where: { isActive: true } },
    },
  },
} satisfies Prisma.KnowledgePackVersionInclude;

export type LatestPackArtifactVersionRow = {
  id?: string;
  payload?: {
    id: string;
    validationStatus?: string;
    originalFileName?: string | null;
    mimeType?: string | null;
    fileSize?: bigint | number | null;
    checksumSha256?: string | null;
    storagePath?: string | null;
  } | null;
  distributionMetadata?: {
    visibility: import("@prisma/client").DistributionVisibility;
    allowDownload: boolean;
    sourceTitle?: string | null;
    sourceUrl?: string | null;
    sourcePublisherName?: string | null;
    sourcePublisherUrl?: string | null;
    sourceDocumentVersion?: string | null;
    sourcePublishedAt?: Date | string | null;
    sourceRetrievedAt?: Date | string | null;
    licenseName?: string | null;
    licenseUrl?: string | null;
    usageTerms?: string | null;
    primaryArtifactType?: "SOURCE_ORIGINAL" | "KNOWLEDGE_PACKAGE" | null;
    contentType?:
      | "DOCUMENT"
      | "PRODUCT"
      | "API"
      | "FRAMEWORK"
      | "DATA"
      | "MIXED"
      | null;
  } | null;
  doclingImportBundles?: Array<{
    id: string;
    isActive: boolean;
    status: string;
    storageStatus: string;
    deletedAt: Date | null;
    adapterType?: string | null;
    normalizedDocuments?: Array<{ id: string; isActive: boolean }> | null;
    files?: Array<{
      id?: string;
      role: string;
      originalFileName: string;
      mimeType: string;
      fileSize: bigint | number;
      checksumSha256: string;
      storageKey?: string | null;
    }> | null;
  }> | null;
  _count?: { chunks?: number };
};

export function toLatestPackVersionArtifactInput(
  version: LatestPackArtifactVersionRow | null | undefined,
): LatestPackVersionArtifactInput {
  if (!version) return null;

  const externalImports: ExternalImportArtifactInput[] = (
    version.doclingImportBundles ?? []
  ).map((bundle) => toExternalImportArtifactInput(bundle));

  return {
    payload: version.payload ?? null,
    distributionMetadata: version.distributionMetadata
      ? {
          visibility: version.distributionMetadata.visibility,
          allowDownload: version.distributionMetadata.allowDownload,
          primaryArtifactType: version.distributionMetadata.primaryArtifactType ?? null,
        }
      : null,
    externalImports,
  };
}
