import { prisma } from "@/lib/prisma";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import { getLatestChunkQualityReport } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import {
  getLatestKnowledgeQualityReport,
  getLatestStructureCoverageReport,
} from "@/lib/structure-quality/structure-quality-evaluate-service";

export type ChunkQualityFreshnessStatus = "CURRENT" | "STALE" | "MISSING";

export type ChunkQualityFreshnessReasonCode =
  | "MISSING_REPORT"
  | "VERSION_MISMATCH"
  | "CHUNK_CHANGED"
  | "SOURCE_CHANGED"
  | "VALIDATION_CHANGED"
  | "STRUCTURE_REPORT_CHANGED"
  | "KNOWLEDGE_REPORT_CHANGED"
  | "STRUCTURE_QUALITY_STALE";

export type ChunkQualityFreshnessSnapshot = {
  status: ChunkQualityFreshnessStatus;
  reason: string | null;
  reasonCode: ChunkQualityFreshnessReasonCode | null;
  latestVersionId: string | null;
  reportVersionId: string | null;
  reportCheckedAt: string | null;
  latestChunkActivityAt: string | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
  latestStructureCoverageCheckedAt: string | null;
  latestKnowledgeQualityCheckedAt: string | null;
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
  code: ChunkQualityFreshnessReasonCode | null,
): string | null {
  switch (code) {
    case "MISSING_REPORT":
      return "청킹 품질 점검을 먼저 실행해 주세요.";
    case "VERSION_MISMATCH":
      return "청킹 품질 점검 결과가 최신 버전 기준이 아닙니다. 재평가해 주세요.";
    case "CHUNK_CHANGED":
      return "청킹 품질 점검 이후 chunk가 변경되었습니다. 재평가해 주세요.";
    case "SOURCE_CHANGED":
      return "청킹 품질 점검 이후 원천 문서가 변경되었습니다. 재평가해 주세요.";
    case "VALIDATION_CHANGED":
      return "청킹 품질 점검 이후 원천 문서 검증 결과가 변경되었습니다. 재평가해 주세요.";
    case "STRUCTURE_REPORT_CHANGED":
      return "구조/품질 점검 결과가 변경되었습니다. 청킹 품질을 재평가해 주세요.";
    case "KNOWLEDGE_REPORT_CHANGED":
      return "지식 품질 점검 결과가 변경되었습니다. 청킹 품질을 재평가해 주세요.";
    case "STRUCTURE_QUALITY_STALE":
      return "구조/품질 점검이 최신 상태가 아닙니다. 구조/품질 재평가 후 청킹 품질을 실행해 주세요.";
    default:
      return null;
  }
}

export function computeChunkQualityFreshness(input: {
  latestVersionId: string | null;
  report: { versionId: string; checkedAt: string } | null;
  latestChunkActivityAt: string | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
  latestStructureCoverageCheckedAt: string | null;
  latestKnowledgeQualityCheckedAt: string | null;
  structureQualityFreshnessStatus: "CURRENT" | "STALE" | "MISSING";
}): ChunkQualityFreshnessSnapshot {
  const base: ChunkQualityFreshnessSnapshot = {
    status: "MISSING",
    reason: freshnessReasonToMessage("MISSING_REPORT"),
    reasonCode: "MISSING_REPORT",
    latestVersionId: input.latestVersionId,
    reportVersionId: input.report?.versionId ?? null,
    reportCheckedAt: input.report?.checkedAt ?? null,
    latestChunkActivityAt: input.latestChunkActivityAt,
    latestSourceDocumentUpdatedAt: input.latestSourceDocumentUpdatedAt,
    latestSourceValidationCheckedAt: input.latestSourceValidationCheckedAt,
    latestStructureCoverageCheckedAt: input.latestStructureCoverageCheckedAt,
    latestKnowledgeQualityCheckedAt: input.latestKnowledgeQualityCheckedAt,
  };

  if (!input.report) {
    return base;
  }

  if (input.structureQualityFreshnessStatus !== "CURRENT") {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("STRUCTURE_QUALITY_STALE"),
      reasonCode: "STRUCTURE_QUALITY_STALE",
    };
  }

  if (!input.latestVersionId || input.report.versionId !== input.latestVersionId) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VERSION_MISMATCH"),
      reasonCode: "VERSION_MISMATCH",
    };
  }

  const chunkMs = parseTime(input.latestChunkActivityAt);
  if (isStrictlyAfter(chunkMs, input.report.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("CHUNK_CHANGED"),
      reasonCode: "CHUNK_CHANGED",
    };
  }

  const sourceMs = parseTime(input.latestSourceDocumentUpdatedAt);
  if (isStrictlyAfter(sourceMs, input.report.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("SOURCE_CHANGED"),
      reasonCode: "SOURCE_CHANGED",
    };
  }

  const validationMs = parseTime(input.latestSourceValidationCheckedAt);
  if (isStrictlyAfter(validationMs, input.report.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VALIDATION_CHANGED"),
      reasonCode: "VALIDATION_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestStructureCoverageCheckedAt), input.report.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("STRUCTURE_REPORT_CHANGED"),
      reasonCode: "STRUCTURE_REPORT_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestKnowledgeQualityCheckedAt), input.report.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("KNOWLEDGE_REPORT_CHANGED"),
      reasonCode: "KNOWLEDGE_REPORT_CHANGED",
    };
  }

  return {
    ...base,
    status: "CURRENT",
    reason: null,
    reasonCode: null,
  };
}

function latestActivityIso(dates: Date[]): string | null {
  if (dates.length === 0) return null;
  let max = 0;
  for (const d of dates) {
    const t = d.getTime();
    if (t > max) max = t;
  }
  return new Date(max).toISOString();
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
  return latestActivityIso([...latestByDoc.values()]);
}

export async function loadChunkQualitySummaryForPack(
  packId: string,
): Promise<ChunkQualitySummaryDto> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sourceDocuments: true,
          chunks: true,
        },
      },
    },
  });

  const version = pack?.versions[0];
  const report = await getLatestChunkQualityReport(packId);
  const structureQuality = await loadStructureQualitySummaryForPack(packId);

  const docIds = version?.sourceDocuments.map((d) => d.id) ?? [];
  const chunks = version?.chunks ?? [];

  const chunkActivity = latestActivityIso(
    chunks.flatMap((c) => [c.createdAt, c.updatedAt]),
  );
  const sourceActivity = latestActivityIso(
    (version?.sourceDocuments ?? []).flatMap((d) => [d.createdAt, d.updatedAt]),
  );
  const latestSourceValidationCheckedAt = await loadLatestSourceValidationCheckedAt(docIds);

  const [structureCoverage, knowledgeQuality] = await Promise.all([
    getLatestStructureCoverageReport(packId),
    getLatestKnowledgeQualityReport(packId),
  ]);

  const freshness = computeChunkQualityFreshness({
    latestVersionId: version?.id ?? null,
    report: report
      ? { versionId: report.versionId, checkedAt: report.checkedAt }
      : null,
    latestChunkActivityAt: chunkActivity,
    latestSourceDocumentUpdatedAt: sourceActivity,
    latestSourceValidationCheckedAt,
    latestStructureCoverageCheckedAt: structureCoverage?.checkedAt ?? null,
    latestKnowledgeQualityCheckedAt: knowledgeQuality?.checkedAt ?? null,
    structureQualityFreshnessStatus: structureQuality?.freshness.status ?? "MISSING",
  });

  return {
    report,
    freshness,
  };
}
