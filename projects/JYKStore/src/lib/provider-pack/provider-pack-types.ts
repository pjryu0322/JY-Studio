import type { PackPricing, SourceFormat, SourceType } from "@prisma/client";

export type CreateProviderPackInput = {
  packId?: string;
  name: string;
  categoryId: string;
  shortDescription?: string;
  description: string;
  tags?: string[];
  version?: string;
};

export type ResolvedCreateProviderPackInput = {
  packId: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  tags?: string[];
  version?: string;
};

export type UpdateProviderPackInput = {
  name?: string;
  categoryId?: string;
  shortDescription?: string;
  description?: string;
  tags?: string[];
  icon?: string;
  pricing?: PackPricing;
  /** Provider-managed pack language. Null clears. Omit to leave unchanged. */
  language?: "ko" | "en" | null;
  versionOverview?: string;
  versionFeatures?: string[];
  versionIncludedKnowledge?: string[];
  versionSupportedEnvironments?: string[];
  versionTargetUsers?: string[];
  versionUseCases?: string[];
  versionSummary?: string;
};

export type CreatePackVersionInput = {
  version: string;
  overview?: string;
  features?: string[];
  includedKnowledge?: string[];
  supportedEnvironments?: string[];
  targetUsers?: string[];
  useCases?: string[];
  versionSummary?: string;
};

export type CreateSourceDocumentInput = {
  title: string;
  sourceType: SourceType;
  sourceFormat?: SourceFormat;
  sourceUrl?: string;
  fileName?: string;
  mimeType?: string;
  content?: string;
  checksum?: string | null;
  productVersion?: string;
  documentVersion?: string;
  licenseStatus?: string;
};
