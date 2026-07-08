import { prisma } from "@/lib/prisma";
import { getLatestChunkQualityReport } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import {
  getLatestKnowledgeQualityReport,
  getLatestStructureCoverageReport,
} from "@/lib/structure-quality/structure-quality-evaluate-service";

export type RetrievalEvaluationFreshnessStatus = "CURRENT" | "STALE" | "MISSING";

export type RetrievalEvaluationFreshnessReasonCode =
  | "MISSING_RUN"
  | "NO_ACTIVE_SET"
  | "NO_ACTIVE_CASES"
  | "VERSION_MISMATCH"
  | "CASE_CHANGED"
  | "CHUNK_CHANGED"
  | "SOURCE_CHANGED"
  | "VALIDATION_CHANGED"
  | "STRUCTURE_REPORT_CHANGED"
  | "KNOWLEDGE_REPORT_CHANGED"
  | "CHUNK_QUALITY_REPORT_CHANGED"
  | "CHUNK_QUALITY_STALE";

export type RetrievalEvaluationFreshnessSnapshot = {
  status: RetrievalEvaluationFreshnessStatus;
  reason: string | null;
  reasonCode: RetrievalEvaluationFreshnessReasonCode | null;
  latestVersionId: string | null;
  runVersionId: string | null;
  runCheckedAt: string | null;
  activeSetId: string | null;
  activeCaseCount: number;
  latestCaseUpdatedAt: string | null;
  latestChunkActivityAt: string | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
  latestStructureCoverageCheckedAt: string | null;
  latestKnowledgeQualityCheckedAt: string | null;
  latestChunkQualityCheckedAt: string | null;
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
  code: RetrievalEvaluationFreshnessReasonCode | null,
): string | null {
  switch (code) {
    case "MISSING_RUN":
      return "검색 품질 평가 케이스를 생성하고 평가를 실행해 주세요.";
    case "NO_ACTIVE_SET":
    case "NO_ACTIVE_CASES":
      return "검색 품질 평가 케이스를 생성하고 평가를 실행해 주세요.";
    case "VERSION_MISMATCH":
      return "검색 품질 평가 결과가 최신 버전 기준이 아닙니다. 재평가해 주세요.";
    case "CASE_CHANGED":
      return "검색 품질 평가 이후 케이스가 변경되었습니다. 재평가해 주세요.";
    case "CHUNK_CHANGED":
      return "검색 품질 평가 이후 chunk가 변경되었습니다. 재평가해 주세요.";
    case "SOURCE_CHANGED":
      return "검색 품질 평가 이후 원천 문서가 변경되었습니다. 재평가해 주세요.";
    case "VALIDATION_CHANGED":
      return "검색 품질 평가 이후 원천 문서 검증 결과가 변경되었습니다. 재평가해 주세요.";
    case "STRUCTURE_REPORT_CHANGED":
      return "구조/품질 점검 결과가 변경되었습니다. 검색 품질을 재평가해 주세요.";
    case "KNOWLEDGE_REPORT_CHANGED":
      return "지식 품질 점검 결과가 변경되었습니다. 검색 품질을 재평가해 주세요.";
    case "CHUNK_QUALITY_REPORT_CHANGED":
      return "청킹 품질 점검 결과가 변경되었습니다. 검색 품질을 재평가해 주세요.";
    case "CHUNK_QUALITY_STALE":
      return "청킹 품질 점검이 최신 상태가 아닙니다. 재평가 후 검색 품질을 실행해 주세요.";
    default:
      return null;
  }
}

export function computeRetrievalEvaluationFreshness(input: {
  latestVersionId: string | null;
  run: { versionId: string; checkedAt: string } | null;
  activeSetId: string | null;
  activeCaseCount: number;
  latestCaseUpdatedAt: string | null;
  latestChunkActivityAt: string | null;
  latestSourceDocumentUpdatedAt: string | null;
  latestSourceValidationCheckedAt: string | null;
  latestStructureCoverageCheckedAt: string | null;
  latestKnowledgeQualityCheckedAt: string | null;
  latestChunkQualityCheckedAt: string | null;
  chunkQualityFreshnessStatus: "CURRENT" | "STALE" | "MISSING";
}): RetrievalEvaluationFreshnessSnapshot {
  const base: RetrievalEvaluationFreshnessSnapshot = {
    status: "MISSING",
    reason: freshnessReasonToMessage("MISSING_RUN"),
    reasonCode: "MISSING_RUN",
    latestVersionId: input.latestVersionId,
    runVersionId: input.run?.versionId ?? null,
    runCheckedAt: input.run?.checkedAt ?? null,
    activeSetId: input.activeSetId,
    activeCaseCount: input.activeCaseCount,
    latestCaseUpdatedAt: input.latestCaseUpdatedAt,
    latestChunkActivityAt: input.latestChunkActivityAt,
    latestSourceDocumentUpdatedAt: input.latestSourceDocumentUpdatedAt,
    latestSourceValidationCheckedAt: input.latestSourceValidationCheckedAt,
    latestStructureCoverageCheckedAt: input.latestStructureCoverageCheckedAt,
    latestKnowledgeQualityCheckedAt: input.latestKnowledgeQualityCheckedAt,
    latestChunkQualityCheckedAt: input.latestChunkQualityCheckedAt,
  };

  if (!input.activeSetId) {
    return {
      ...base,
      status: "MISSING",
      reason: freshnessReasonToMessage("NO_ACTIVE_SET"),
      reasonCode: "NO_ACTIVE_SET",
    };
  }

  if (input.activeCaseCount <= 0) {
    return {
      ...base,
      status: "MISSING",
      reason: freshnessReasonToMessage("NO_ACTIVE_CASES"),
      reasonCode: "NO_ACTIVE_CASES",
    };
  }

  if (!input.run) {
    return base;
  }

  if (input.chunkQualityFreshnessStatus !== "CURRENT") {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("CHUNK_QUALITY_STALE"),
      reasonCode: "CHUNK_QUALITY_STALE",
    };
  }

  if (!input.latestVersionId || input.run.versionId !== input.latestVersionId) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("VERSION_MISMATCH"),
      reasonCode: "VERSION_MISMATCH",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestCaseUpdatedAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("CASE_CHANGED"),
      reasonCode: "CASE_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestChunkActivityAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("CHUNK_CHANGED"),
      reasonCode: "CHUNK_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestChunkQualityCheckedAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("CHUNK_QUALITY_REPORT_CHANGED"),
      reasonCode: "CHUNK_QUALITY_REPORT_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestStructureCoverageCheckedAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("STRUCTURE_REPORT_CHANGED"),
      reasonCode: "STRUCTURE_REPORT_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestKnowledgeQualityCheckedAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("KNOWLEDGE_REPORT_CHANGED"),
      reasonCode: "KNOWLEDGE_REPORT_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestSourceDocumentUpdatedAt), input.run.checkedAt)) {
    return {
      ...base,
      status: "STALE",
      reason: freshnessReasonToMessage("SOURCE_CHANGED"),
      reasonCode: "SOURCE_CHANGED",
    };
  }

  if (isStrictlyAfter(parseTime(input.latestSourceValidationCheckedAt), input.run.checkedAt)) {
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

function emptyModeCounts(): { pass: number; warning: number; fail: number } {
  return { pass: 0, warning: 0, fail: 0 };
}

function mapRunDto(run: {
  id: string;
  setId: string;
  packId: string;
  versionId: string;
  status: string;
  retrievalMode: string;
  totalCaseCount: number;
  evaluatedCaseCount: number;
  passCaseCount: number;
  warningCaseCount: number;
  failCaseCount: number;
  hitRate: number;
  meanReciprocalRank: number;
  averageTopRank: number | null;
  averageScore: number;
  totalScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  checkedBy: string;
  checkedAt: Date;
  issues: {
    severity: string;
    code: string;
    message: string;
    field: string | null;
    hint: string | null;
  }[];
  results?: {
    caseId: string;
    retrievalMode: string;
    query: string;
    status: string;
    issueCodes: string[];
  }[];
}): NonNullable<RetrievalEvaluationSummaryDto["latestRun"]> {
  const modeSummary = {
    keyword: emptyModeCounts(),
    hybrid: emptyModeCounts(),
  };
  const failedResults: NonNullable<
    RetrievalEvaluationSummaryDto["latestRun"]
  >["failedResults"] = [];

  for (const result of run.results ?? []) {
    const bucket =
      result.retrievalMode === "hybrid" ? modeSummary.hybrid : modeSummary.keyword;
    if (result.status === "PASS") bucket.pass += 1;
    else if (result.status === "WARNING") bucket.warning += 1;
    else bucket.fail += 1;

    if (result.status === "FAIL") {
      failedResults.push({
        caseId: result.caseId,
        retrievalMode: result.retrievalMode,
        query: result.query,
        status: result.status,
        issueCodes: result.issueCodes,
      });
    }
  }

  return {
    id: run.id,
    setId: run.setId,
    packId: run.packId,
    versionId: run.versionId,
    status: run.status,
    retrievalMode: run.retrievalMode,
    totalCaseCount: run.totalCaseCount,
    evaluatedCaseCount: run.evaluatedCaseCount,
    passCaseCount: run.passCaseCount,
    warningCaseCount: run.warningCaseCount,
    failCaseCount: run.failCaseCount,
    hitRate: run.hitRate,
    meanReciprocalRank: run.meanReciprocalRank,
    averageTopRank: run.averageTopRank,
    averageScore: run.averageScore,
    totalScore: run.totalScore,
    blockingIssueCount: run.blockingIssueCount,
    warningIssueCount: run.warningIssueCount,
    summary: run.summary,
    checkedBy: run.checkedBy,
    checkedAt: run.checkedAt.toISOString(),
    issues: run.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      field: issue.field,
      hint: issue.hint,
    })),
    modeSummary,
    failedResults: failedResults.slice(0, 20),
  };
}

export async function getLatestRetrievalEvaluationRun(packId: string) {
  const run = await prisma.retrievalEvaluationRun.findFirst({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: {
      issues: { orderBy: { createdAt: "asc" } },
      results: {
        orderBy: { createdAt: "asc" },
        select: {
          caseId: true,
          retrievalMode: true,
          query: true,
          status: true,
          issueCodes: true,
        },
      },
    },
  });
  if (!run) return null;
  return mapRunDto(run);
}

export async function loadRetrievalEvaluationSummaryForPack(
  packId: string,
): Promise<RetrievalEvaluationSummaryDto> {
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
  const activeSet = await prisma.retrievalEvaluationSet.findFirst({
    where: { packId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      cases: {
        where: { isActive: true },
        select: { id: true, updatedAt: true },
      },
    },
  });

  const latestRun = await getLatestRetrievalEvaluationRun(packId);
  const chunkQuality = await loadChunkQualitySummaryForPack(packId);
  const chunkQualityReport = await getLatestChunkQualityReport(packId);

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

  const activeCases = activeSet?.cases ?? [];
  const latestCaseUpdatedAt = latestActivityIso(activeCases.map((c) => c.updatedAt));

  const freshness = computeRetrievalEvaluationFreshness({
    latestVersionId: version?.id ?? null,
    run: latestRun
      ? { versionId: latestRun.versionId, checkedAt: latestRun.checkedAt }
      : null,
    activeSetId: activeSet?.id ?? null,
    activeCaseCount: activeCases.length,
    latestCaseUpdatedAt,
    latestChunkActivityAt: chunkActivity,
    latestSourceDocumentUpdatedAt: sourceActivity,
    latestSourceValidationCheckedAt,
    latestStructureCoverageCheckedAt: structureCoverage?.checkedAt ?? null,
    latestKnowledgeQualityCheckedAt: knowledgeQuality?.checkedAt ?? null,
    latestChunkQualityCheckedAt: chunkQualityReport?.checkedAt ?? null,
    chunkQualityFreshnessStatus: chunkQuality.freshness.status,
  });

  return {
    set: activeSet
      ? {
          id: activeSet.id,
          name: activeSet.name,
          activeCaseCount: activeCases.length,
          updatedAt: activeSet.updatedAt.toISOString(),
        }
      : null,
    latestRun,
    freshness,
  };
}
