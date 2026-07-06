export type KnowledgePackStatus = "PUBLISHED" | "DRAFT" | "REVIEWING";

export type KnowledgePack = Readonly<{
  readonly packId: string;
  readonly name: string;
  readonly category: string;
  readonly provider?: string;
  readonly verified?: boolean;
  readonly status: KnowledgePackStatus;
  readonly version: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly rating: number;
  readonly usageCount: number;
  readonly iconLabel: string;
}>;

export type BottomTabId = "today" | "search" | "categories" | "library" | "account";
