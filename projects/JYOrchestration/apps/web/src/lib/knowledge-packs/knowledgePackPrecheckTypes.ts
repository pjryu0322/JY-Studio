import type { KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

export type KnowledgePackPrecheckDecision =
  | "REGISTERABLE"
  | "LIMITED_REGISTERABLE"
  | "USER_SOURCE_REQUIRED"
  | "NOT_RECOMMENDED";

export type KnowledgePackPrecheckRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type KnowledgePackPrecheckIssueType =
  | "OFFICIAL_DOCS_MISSING"
  | "LICENSE_UNKNOWN"
  | "COMMERCIAL_LICENSE_RISK"
  | "API_SPEC_MISSING"
  | "AUTH_SECRET_RISK"
  | "PERSONAL_DATA_RISK"
  | "PAYMENT_OR_FINANCE_RISK"
  | "EXTERNAL_SCRIPT_RISK"
  | "PUBLIC_SOURCE_INSUFFICIENT"
  | "RAG_NOT_READY"
  | "TERMS_REVIEW_REQUIRED"
  | "USER_DOCUMENT_REQUIRED";

export type KnowledgePackPrecheckInput = Readonly<{
  productName: string;
  productUrl?: string;
  category: KnowledgePackCategory;
  agents: readonly KnowledgePackAgent[];
  purpose?: string;
  officialDocsUrl?: string;
  apiDocsUrl?: string;
  repositoryUrl?: string;
  licenseHint?: string;
  memo?: string;
}>;

export type KnowledgePackPrecheckIssue = Readonly<{
  type: KnowledgePackPrecheckIssueType;
  riskLevel: KnowledgePackPrecheckRiskLevel;
  title: string;
  description: string;
  recommendedAction: string;
}>;

export type KnowledgePackPrecheckResult = Readonly<{
  decision: KnowledgePackPrecheckDecision;
  riskLevel: KnowledgePackPrecheckRiskLevel;
  score: number;
  summary: string;
  reasons: readonly string[];
  issues: readonly KnowledgePackPrecheckIssue[];
  requiredSources: readonly string[];
  recommendedSources: readonly string[];
  nextActions: readonly string[];
  canGenerateDraft: boolean;
  shouldRequireSecurityReview: boolean;
  shouldRequireLicenseReview: boolean;
  shouldRequireUserProvidedDocs: boolean;
  diagnostics: readonly string[];
}>;

export const PRECHECK_DECISION_LABEL: Record<KnowledgePackPrecheckDecision, string> = {
  REGISTERABLE: "등록 가능",
  LIMITED_REGISTERABLE: "제한 등록",
  USER_SOURCE_REQUIRED: "사용자 자료 필요",
  NOT_RECOMMENDED: "등록 비권장",
};

export const PRECHECK_RISK_LABEL: Record<KnowledgePackPrecheckRiskLevel, string> = {
  LOW: "LOW (낮음)",
  MEDIUM: "MEDIUM (중간)",
  HIGH: "HIGH (높음)",
  CRITICAL: "CRITICAL (매우 높음)",
};
