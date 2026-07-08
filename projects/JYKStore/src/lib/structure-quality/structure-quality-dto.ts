import type { StructureQualityFreshnessSnapshot } from "@/lib/structure-quality/structure-quality-freshness";

export type StructureCoverageItemDto = {
  sectionKey: string;
  title: string;
  required: boolean;
  covered: boolean;
  score: number;
  matchedDocIds: string[];
  matchedSignals: string[];
  message: string;
};

export type StructureCoverageReportDto = {
  id: string;
  packId: string;
  versionId: string;
  templateKey: string;
  templateName: string;
  status: string;
  coverageScore: number;
  requiredSectionCount: number;
  coveredRequiredCount: number;
  missingRequiredCount: number;
  optionalSectionCount: number;
  coveredOptionalCount: number;
  summary: string;
  checkedAt: string;
  items: StructureCoverageItemDto[];
};

export type KnowledgeQualityIssueDto = {
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type KnowledgeQualityReportDto = {
  id: string;
  packId: string;
  versionId: string;
  status: string;
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
  checkedAt: string;
  issues: KnowledgeQualityIssueDto[];
};

export type StructureQualitySummaryDto = {
  structureTemplateKey: string;
  structureTemplateName: string;
  structureCoverage: StructureCoverageReportDto | null;
  knowledgeQuality: KnowledgeQualityReportDto | null;
  freshness: StructureQualityFreshnessSnapshot;
};
