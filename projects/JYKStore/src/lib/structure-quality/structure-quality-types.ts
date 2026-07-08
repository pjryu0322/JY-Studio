export type StructureQualityStatus = "PASS" | "WARNING" | "FAIL";

export type StructureCoverageDocumentInput = {
  id: string;
  sourceType: string;
  title: string;
  content: string | null;
  sourceUrl: string | null;
  validationStatus: string;
  productVersion?: string | null;
  documentVersion?: string | null;
  checksum?: string | null;
  registeredAt?: string;
  blockingIssueCount?: number;
};

export type StructureSectionInput = {
  sectionKey: string;
  title: string;
  required: boolean;
  weight: number;
  sourceTypes: string[];
  keywords: string[];
};

export type StructureCoverageItemResult = {
  sectionKey: string;
  title: string;
  required: boolean;
  covered: boolean;
  score: number;
  matchedDocIds: string[];
  matchedSignals: string[];
  message: string;
};

export type StructureCoverageRunResult = {
  templateKey: string;
  status: StructureQualityStatus;
  coverageScore: number;
  requiredSectionCount: number;
  coveredRequiredCount: number;
  missingRequiredCount: number;
  optionalSectionCount: number;
  coveredOptionalCount: number;
  summary: string;
  items: StructureCoverageItemResult[];
};

export type KnowledgeQualityIssueDraft = {
  severity: "BLOCKER" | "WARNING" | "INFO";
  code: string;
  message: string;
  field?: string | null;
  hint?: string | null;
};

export type KnowledgeQualityRunResult = {
  status: StructureQualityStatus;
  totalScore: number;
  completenessScore: number;
  consistencyScore: number;
  sourceQualityScore: number;
  securityScore: number;
  freshnessScore: number;
  usabilityScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  issues: KnowledgeQualityIssueDraft[];
};
