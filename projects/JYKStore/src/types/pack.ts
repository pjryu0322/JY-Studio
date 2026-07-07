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

export type KnowledgePackProviderInfo = {
  name: string;
  type: KnowledgePackProviderType;
  description: string;
};

export type KnowledgePack = {
  packId: string;
  name: string;
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
};
