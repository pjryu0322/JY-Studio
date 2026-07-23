import type { PublicPackCapabilities } from "@/lib/public-pack-capability";
import type { PublicPackContentType } from "@/lib/public-pack-content-type";

export type KnowledgePackStatus =
  | "PUBLISHED"
  | "DRAFT"
  | "REVIEWING"
  | "DEPRECATED"
  | "SUSPENDED";

export type KnowledgePackPricing = "FREE" | "PAID" | "ENTERPRISE";

export type KnowledgePackProviderType = "JYK_VERIFIED" | "OFFICIAL" | "COMMUNITY";

export type KnowledgePackVersionEntry = {
  version: string;
  date: string;
  summary: string;
};

export type { PublicPackCapabilities, PublicPackContentType };

export type KnowledgePackProviderInfo = {
  name: string;
  type: KnowledgePackProviderType;
  description: string;
};

export type PublicPackSourceInfo = {
  publisherName: string | null;
  /** Additive: original publisher homepage / catalog URL. */
  publisherUrl?: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  /** Additive: document edition / revision label. */
  documentVersion?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
};

export type PublicPackLicenseInfo = {
  name: string | null;
  url: string | null;
  usageTerms: string | null;
  allowDownload: boolean | null;
  commercialUseAllowed: boolean | null;
  redistributionAllowed: boolean | null;
  attributionRequired: boolean | null;
};

export type PublicPackDownloadArtifactKind = "SOURCE_ORIGINAL";

export type PublicPackDownloadInfo = {
  available: boolean;
  /** Additive: distinguishes original source files from ZIP knowledge packages. */
  artifactKind?: PublicPackDownloadArtifactKind;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  checksumSha256: string | null;
};

export type KnowledgePack = {
  packId: string;
  name: string;
  /** Natural-language public title (additive). Falls back to normalized `name`. */
  displayName?: string;
  category: string;
  categoryId: string;
  provider: string;
  status: KnowledgePackStatus;
  version: string;
  description: string;
  shortDescription: string;
  tags: string[];
  icon: string;
  rating: number;
  usageCount: number;
  isVerified: boolean;
  updatedAt: string;
  pricing: KnowledgePackPricing;
  overview: string;
  features: string[];
  includedKnowledge: string[];
  supportedEnvironments: string[];
  targetUsers: string[];
  useCases: string[];
  versionHistory: KnowledgePackVersionEntry[];
  providerInfo: KnowledgePackProviderInfo;
  /** Additive public runtime/catalog capabilities. */
  capabilities?: PublicPackCapabilities;
  /** Inferred content shape for section layout; null when unclear. */
  contentType?: PublicPackContentType | null;
  sourceInfo?: PublicPackSourceInfo | null;
  licenseInfo?: PublicPackLicenseInfo | null;
  downloadInfo?: PublicPackDownloadInfo | null;
  /** Provider-selected document language (`ko`/`en`); null when unset. */
  language?: import("@/lib/pack-language").PackLanguageCode | null;
  searchScore?: number;
  matchReasons?: {
    field: string;
    token: string;
    weight: number;
    reason: string;
  }[];
};

export type StoreCategory = {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
};
