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

const KNOWLEDGE_PACK_CATEGORY_SET = new Set<string>(["GRID", "AUTH", "SECURITY", "UI", "API", "DATA", "INTEGRATION"]);

export function isKnowledgePackCategory(value: string): value is KnowledgePackCategory {
  return KNOWLEDGE_PACK_CATEGORY_SET.has(value);
}

export type KnowledgePackLicenseType =
  | "MIT"
  | "COMMERCIAL"
  | "OPEN_SOURCE"
  | "UNKNOWN"
  | "PARTNER_LICENSE"
  | "USER_PROVIDED_LICENSE"
  | "EXTERNAL_SERVICE";

export type KnowledgePackStatus = "ACTIVE" | "DRAFT" | "ARCHIVED" | "REVIEW_REQUESTED" | "APPROVED";

/** 향후 RAG 원천자료 단위 (DB·색인은 다음 단계). */
export type KnowledgePackSourceType =
  | "URL"
  | "FILE"
  | "TEXT"
  | "MARKDOWN"
  | "OPENAPI"
  | "CODE_SAMPLE"
  | "LICENSE"
  | "MANUAL"
  | "API_REFERENCE";

export type KnowledgePackSource = Readonly<{
  id: string;
  knowledgePackId: string;
  sourceType: KnowledgePackSourceType;
  title: string;
  url?: string;
  fileId?: string;
  rawText?: string;
  description?: string;
  version?: string;
  isOfficial: boolean;
  ragEnabled: boolean;
  indexedAt?: string | null;
}>;

export type KnowledgePack = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly scope: KnowledgePackScope;
  readonly category: KnowledgePackCategory;
  readonly agents: readonly KnowledgePackAgent[];
  readonly status: KnowledgePackStatus;
  readonly summary: string;
  readonly description?: string;
  readonly vendor?: string;
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
  /** 향후 DB·RAG 연동 시 명시적 원천자료. 없으면 `references`에서 유도한다. */
  readonly sources?: readonly KnowledgePackSource[];
  /** API·목록 병합용 */
  readonly source?: "STATIC" | "DB";
  readonly editable?: boolean;
  readonly securityChecklist?: readonly string[];
  readonly previewSpec?: string;
};
