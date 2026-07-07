export type KnowledgePackStatus =
  | "PUBLISHED"
  | "DRAFT"
  | "REVIEWING"
  | "DEPRECATED"
  | "SUSPENDED";

export type KnowledgePack = {
  packId: string;
  name: string;
  category: string;
  provider: string;
  status: KnowledgePackStatus;
  version: string;
  description: string;
  tags: string[];
  icon: string;
  rating: number;
  usageCount: number;
  isVerified: boolean;
  updatedAt: string;
};
