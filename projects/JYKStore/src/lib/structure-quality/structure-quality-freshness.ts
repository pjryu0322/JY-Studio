import { prisma } from "@/lib/prisma";
import { getStructureTemplateDefinition } from "@/lib/structure-quality/structure-template-definitions";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import {
  getLatestKnowledgeQualityReport,
  getLatestStructureCoverageReport,
} from "@/lib/structure-quality/structure-quality-evaluate-service";
import { selectStructureTemplateKey } from "@/lib/structure-quality/structure-template-selector";

export type StructureQualityFreshnessStatus = "CURRENT" | "STALE" | "MISSING";

export type StructureQualityFreshnessReasonCode =
  | "MISSING_REPORT"
  | "VERSION_MISMATCH"
  | "SOURCE_CHANGED"
  | "VALIDATION_CHANGED"
  | "TEMPLATE_CHANGED"
  | "REPORT_OUT_OF_SYNC";

export type StructureQualityFreshnessSnapshot = {
  status: StructureQualityFreshnessStatus;
  reason: string | null;
  reasonCode: StructureQualityFreshnessReasonCode | null;
  latestVersionId: string | null;
  coverageReportVersionId: string | null;
  qualityReportVersionId: string | null;
  coverageCheckedAt: string | null;
  qualityCheckedAt: string | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
};

const FRESHNESS_GRACE_MS = 1000;

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function isStrictlyAfter(laterMs: number | null, earlierIso: string | null): boolean {
  const earlierMs = parseTime(earlierIso);
  if (laterMs === null || earlierMs === null) return false;
  return laterMs > earlierMs + FRESHNESS_GRACE_MS;
}

export function freshnessReasonToMessage(
  code: StructureQualityFreshnessReasonCode | null,
): string | null {
  switch (code) {
    case "MISSING_REPORT":
      return "구조/품질 점검을 먼저 실행해 주세요.";
    case "VERSION_MISMATCH":
      return "구조/품질 점검 결과가 최신 버전 기준이 아닙니다. 최신 버전으로 재평가해 주세요.";
    case "SOURCE_CHANGED":
      return "구조/품질 점검 이후 원천 문서가 변경되었습니다. 재평가해 주세요.";
    case "VALIDATION_CHANGED":
      return "구조/품질 점검 이후 원천 문서 검증 결과가 변경되었습니다. 재평가해 주세요.";
    case "TEMPLATE_CHANGED":
      return "구조 템플릿이 변경되었습니다. 재평가해 주세요.";
    case "REPORT_OUT_OF_SYNC":
      return "구조/품질 점검 결과가 최신 원천 문서 또는 검증 상태와 일치하지 않습니다. 재평가를 실행해 주세요.";
    default:
      return null;
  }
}

export function computeStructureQualityFreshness(input: {
  latestVersionId: string | null;
  coverageReport: { versionId: string; templateKey: string; checkedAt: string } | null;
  qualityReport: { versionId: string; checkedAt: string } | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
  currentTemplateKey: string | null;
}): StructureQualityFreshnessSnapshot {
  const base: StructureQualityFreshnessSnapshot = {
    status: "MISSING",
    reason: freshnessReasonToMessage("MISSING_REPORT"),
    reasonCode: "MISSING_REPORT",
    latestVersionId: input.latestVersionId,
    coverageReportVersionId: input.coverageReport?.versionId ?? null,
    qualityReportVersionId: input.qualityReport?.versionId ?? null,
    coverageCheckedAt: input.coverageReport?.checkedAt ?? null,
    qualityCheckedAt: input.qualityReport?.checkedAt ?? null,
    latestSourceDocumentUpdatedAt: input.latestSourceDocumentUpdatedAt,
    latestSourceValidationCheckedAt: input.latestSourceValidationCheckedAt,
  };

  if (!input.coverageReport || !input.qualityReport) {
    return base;
  }

  if (!input.latestVersionId) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VERSION_MISMATCH"),
      reasonCode: "VERSION_MISMATCH",
    };
  }

  if (
    input.coverageReport.versionId !== input.latestVersionId ||
    input.qualityReport.versionId !== input.latestVersionId
  ) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VERSION_MISMATCH"),
      reasonCode: "VERSION_MISMATCH",
    };
  }

  if (input.coverageReport.versionId !== input.qualityReport.versionId) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("REPORT_OUT_OF_SYNC"),
      reasonCode: "REPORT_OUT_OF_SYNC",
    };
  }

  if (
    input.currentTemplateKey &&
    input.coverageReport.templateKey !== input.currentTemplateKey
  ) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("TEMPLATE_CHANGED"),
      reasonCode: "TEMPLATE_CHANGED",
    };
  }

  const docUpdatedMs = parseTime(input.latestSourceDocumentUpdatedAt);
  if (
    isStrictlyAfter(docUpdatedMs, input.coverageReport.checkedAt) ||
    isStrictlyAfter(docUpdatedMs, input.qualityReport.checkedAt)
  ) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("SOURCE_CHANGED"),
      reasonCode: "SOURCE_CHANGED",
    };
  }

  const validationMs = parseTime(input.latestSourceValidationCheckedAt);
  if (
    isStrictlyAfter(validationMs, input.coverageReport.checkedAt) ||
    isStrictlyAfter(validationMs, input.qualityReport.checkedAt)
  ) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VALIDATION_CHANGED"),
      reasonCode: "VALIDATION_CHANGED",
    };
  }

  return {
    ...base,
    status: "CURRENT",
    reason: null,
    reasonCode: null,
  };
}

export function createCurrentFreshnessSnapshot(input: {
  latestVersionId: string;
  coverageReport: { versionId: string; templateKey: string; checkedAt: string };
  qualityReport: { versionId: string; checkedAt: string };
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
}): StructureQualityFreshnessSnapshot {
  return {
    status: "CURRENT",
    reason: null,
    reasonCode: null,
    latestVersionId: input.latestVersionId,
    coverageReportVersionId: input.coverageReport.versionId,
    qualityReportVersionId: input.qualityReport.versionId,
    coverageCheckedAt: input.coverageReport.checkedAt,
    qualityCheckedAt: input.qualityReport.checkedAt,
    latestSourceDocumentUpdatedAt: input.latestSourceDocumentUpdatedAt,
    latestSourceValidationCheckedAt: input.latestSourceValidationCheckedAt,
  };
}

async function loadLatestSourceValidationCheckedAt(
  sourceDocumentIds: string[],
): Promise<string | null> {
  if (sourceDocumentIds.length === 0) return null;

  const reports = await prisma.sourceValidationReport.findMany({
    where: { sourceDocumentId: { in: sourceDocumentIds } },
    orderBy: { checkedAt: "desc" },
    select: { sourceDocumentId: true, checkedAt: true },
  });

  const latestByDoc = new Map<string, Date>();
  for (const report of reports) {
    if (!latestByDoc.has(report.sourceDocumentId)) {
      latestByDoc.set(report.sourceDocumentId, report.checkedAt);
    }
  }

  let max: Date | null = null;
  for (const checkedAt of latestByDoc.values()) {
    if (!max || checkedAt > max) {
      max = checkedAt;
    }
  }

  return max?.toISOString() ?? null;
}

function latestDocumentActivityIso(
  docs: { createdAt: Date; updatedAt: Date }[],
): string | null {
  if (docs.length === 0) return null;
  let maxMs = 0;
  for (const doc of docs) {
    const t = Math.max(doc.createdAt.getTime(), doc.updatedAt.getTime());
    if (t > maxMs) maxMs = t;
  }
  return new Date(maxMs).toISOString();
}

export async function loadStructureQualitySummaryForPack(
  packId: string,
): Promise<StructureQualitySummaryDto | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack) return null;

  const version = pack.versions[0];
  if (!version) return null;

  const [structureCoverage, knowledgeQuality] = await Promise.all([
    getLatestStructureCoverageReport(packId),
    getLatestKnowledgeQualityReport(packId),
  ]);

  if (!structureCoverage && !knowledgeQuality) {
    return null;
  }

  const docs = version.sourceDocuments;
  const docIds = docs.map((d) => d.id);
  const latestSourceDocumentUpdatedAt = latestDocumentActivityIso(docs);
  const latestSourceValidationCheckedAt = await loadLatestSourceValidationCheckedAt(docIds);

  const currentTemplateKey = selectStructureTemplateKey({
    categoryId: pack.categoryId,
    tags: pack.tags,
    sourceTypes: docs.map((d) => d.sourceType),
    explicitTemplateKey: pack.structureTemplateKey ?? undefined,
  });

  const freshness = computeStructureQualityFreshness({
    latestVersionId: version.id,
    coverageReport: structureCoverage
      ? {
          versionId: structureCoverage.versionId,
          templateKey: structureCoverage.templateKey,
          checkedAt: structureCoverage.checkedAt,
        }
      : null,
    qualityReport: knowledgeQuality
      ? {
          versionId: knowledgeQuality.versionId,
          checkedAt: knowledgeQuality.checkedAt,
        }
      : null,
    latestSourceDocumentUpdatedAt,
    latestSourceValidationCheckedAt,
    currentTemplateKey,
  });

  const templateName =
    structureCoverage?.templateName ??
    getStructureTemplateDefinition(currentTemplateKey)?.name ??
    currentTemplateKey;

  return {
    structureTemplateKey: currentTemplateKey,
    structureTemplateName: templateName,
    structureCoverage,
    knowledgeQuality,
    freshness,
  };
}
