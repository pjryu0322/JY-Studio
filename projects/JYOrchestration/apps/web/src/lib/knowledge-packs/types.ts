export type KnowledgePackScope = "PLATFORM" | "ORGANIZATION" | "USER" | "PROJECT";

export type KnowledgePackAgent =
  | "AI_DEVELOPER"
  | "AI_PLANNER"
  | "AI_ANALYST"
  | "AI_ARCHITECT"
  | "AI_DESIGNER"
  | "AI_REVIEWER"
  | "AI_SECURITY";

export type KnowledgePackCategory =
  | "GRID"
  | "AUTH"
  | "SECURITY"
  | "UI"
  | "API"
  | "DATA"
  | "INTEGRATION";

export type KnowledgePackLicenseType = "MIT" | "COMMERCIAL" | "OPEN_SOURCE" | "UNKNOWN";

export type KnowledgePackStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type KnowledgePack = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly scope: KnowledgePackScope;
  readonly category: KnowledgePackCategory;
  readonly agents: readonly KnowledgePackAgent[];
  readonly status: KnowledgePackStatus;
  readonly summary: string;
  readonly license: {
    readonly type: KnowledgePackLicenseType;
    readonly notes: readonly string[];
  };
  readonly recommendedUseCases: readonly string[];
  readonly notRecommendedUseCases: readonly string[];
  readonly capabilities: readonly string[];
  readonly constraints: readonly string[];
  readonly implementationGuidelines: readonly string[];
  readonly cursorPromptRules: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly reviewChecklist: readonly string[];
  readonly alternatives: readonly string[];
  readonly references: readonly { readonly label: string; readonly url: string }[];
};
