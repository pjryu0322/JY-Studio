/**
 * 지식팩 **관리·버전·매핑** 고도화용 설계 타입 (DB/ API 미연동).
 * 런타임 seed `KnowledgePack`과 별도 계층이다.
 */

import type { KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

/** DB 도입 시 상태값과 정렬할 수 있는 라이프사이클 (초안). */
export type KnowledgePackLifecycleStatus =
  | "DRAFT"
  | "REVIEW_REQUESTED"
  | "APPROVED"
  | "ACTIVE"
  | "ARCHIVED";

export type KnowledgePackVersionDraft = Readonly<{
  id: string;
  knowledgePackId: string;
  version: string;
  changeSummary: string;
  sourceType: "MANUAL" | "AI_GENERATED" | "DOCUMENT_IMPORTED";
  status: "DRAFT" | "APPROVED" | "ACTIVE" | "ARCHIVED";
  createdBy: string;
  createdAt: string;
}>;

export type KnowledgePackSectionKey =
  | "SUMMARY"
  | "RECOMMENDED_USE_CASES"
  | "NOT_RECOMMENDED_USE_CASES"
  | "CAPABILITIES"
  | "CONSTRAINTS"
  | "IMPLEMENTATION_GUIDELINES"
  | "CURSOR_PROMPT_RULES"
  | "FORBIDDEN_PATTERNS"
  | "REVIEW_CHECKLIST"
  | "SECURITY_CHECKLIST"
  | "ALTERNATIVES"
  | "REFERENCES"
  | "PREVIEW_SPEC";

export type AgentCategoryUsageMode = "REFERENCE" | "PROMPT_INJECTION" | "REVIEW_CHECKLIST" | "SECURITY_GATE";

export type AgentCategoryMappingDraft = Readonly<{
  id: string;
  agentRole: KnowledgePackAgent | string;
  categoryId: KnowledgePackCategory | string;
  enabled: boolean;
  usageMode: AgentCategoryUsageMode;
  priority: number;
}>;

export type AgentKnowledgeProfileDraft = Readonly<{
  id: string;
  versionId: string;
  agentRole: KnowledgePackAgent;
  purpose: string;
  promptInjectionSummary: string;
  mustIncludeRules: readonly string[];
  forbiddenRules: readonly string[];
  checklist: readonly string[];
}>;
