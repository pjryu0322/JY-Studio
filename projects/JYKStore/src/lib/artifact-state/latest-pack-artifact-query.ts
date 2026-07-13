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
    },
  },
  distributionMetadata: {
    select: {
      visibility: true,
      allowDownload: true,
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
    },
  },
  _count: {
    select: {
      chunks: { where: { isActive: true } },
    },
  },
} satisfies Prisma.KnowledgePackVersionInclude;

export type LatestPackArtifactVersionRow = {
  payload?: { id: string; validationStatus?: string } | null;
  distributionMetadata?: {
    visibility: import("@prisma/client").DistributionVisibility;
    allowDownload: boolean;
  } | null;
  doclingImportBundles?: Array<{
    id: string;
    isActive: boolean;
    status: string;
    storageStatus: string;
    deletedAt: Date | null;
    adapterType?: string | null;
    normalizedDocuments?: Array<{ id: string; isActive: boolean }> | null;
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
    distributionMetadata: version.distributionMetadata ?? null,
    externalImports,
  };
}
