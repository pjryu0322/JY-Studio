import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import {
  chunkQualityGateSnapshotFromSummary,
  getChunkQualityBlockingMessage,
} from "@/lib/chunk-quality/chunk-quality-readiness";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import {
  getRetrievalEvaluationBlockingMessage,
  retrievalEvaluationGateSnapshotFromSummary,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";
import { MIN_RETRIEVAL_EVAL_CASES } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import {
  getStructureQualityBlockingMessage,
  hasStructureQualityWarning,
  structureQualityGateSnapshotFromSummary,
} from "@/lib/structure-quality/structure-quality-readiness";
import type {
  ReleaseGateEvaluationInput,
  ReleaseGateEvaluationResult,
  ReleaseGateIssue,
  ReleaseGateSectionStatus,
  ReleaseGateSourceDocument,
  ReleaseGateSourceValidationReport,
  ReleaseGateStatus,
} from "@/lib/release-gate/release-gate-types";

export const FRESHNESS_GRACE_MS = 1000;

function isAfterWithGrace(laterIso: string, earlierIso: string): boolean {
  const laterMs = new Date(laterIso).getTime();
  const earlierMs = new Date(earlierIso).getTime();
  return laterMs > earlierMs + FRESHNESS_GRACE_MS;
}

export function computeReleaseGateStatus(issues: ReleaseGateIssue[]): {
  status: ReleaseGateStatus;
  blockingIssueCount: number;
  warningIssueCount: number;
} {
  const blockingIssueCount = issues.filter((i) => i.severity === "BLOCKER").length;
  const warningIssueCount = issues.filter((i) => i.severity === "WARNING").length;
  if (blockingIssueCount > 0) {
    return { status: "FAIL", blockingIssueCount, warningIssueCount };
  }
  if (warningIssueCount > 0) {
    return { status: "WARNING", blockingIssueCount, warningIssueCount };
  }
  return { status: "PASS", blockingIssueCount, warningIssueCount };
}

export function evaluateSourceValidationReleaseGate(input: {
  sourceDocuments: ReleaseGateSourceDocument[];
  latestReportsByDocumentId: Record<string, ReleaseGateSourceValidationReport | undefined>;
  now?: Date;
}): { issues: ReleaseGateIssue[]; sectionStatus: ReleaseGateSectionStatus } {
  const issues: ReleaseGateIssue[] = [];
  const docs = input.sourceDocuments;

  if (docs.length === 0) {
    issues.push({
      severity: "BLOCKER",
      code: "SOURCE_DOCUMENT_MISSING",
      message: "최신 버전에 원천 문서가 없습니다.",
      hint: "원천 문서를 등록한 뒤 검증을 실행해 주세요.",
    });
    return { issues, sectionStatus: "FAIL" };
  }

  for (const doc of docs) {
    const field = `sourceDocument:${doc.id}`;
    if (doc.validationStatus === "NOT_CHECKED") {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_NOT_CHECKED",
        message: `원천 문서「${doc.title}」이(가) 검증되지 않았습니다.`,
        field,
        hint: "원천 문서 재검증을 실행해 주세요.",
      });
      continue;
    }
    if (doc.validationStatus === "FAIL") {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_FAILED",
        message: `원천 문서「${doc.title}」검증이 FAIL입니다.`,
        field,
      });
      continue;
    }

    if (doc.validationStatus !== "PASS" && doc.validationStatus !== "WARNING") {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_FAILED",
        message: `원천 문서「${doc.title}」검증 상태가 허용되지 않습니다 (${doc.validationStatus}).`,
        field,
      });
      continue;
    }

    const report = input.latestReportsByDocumentId[doc.id];
    if (!report) {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_REPORT_MISSING",
        message: `원천 문서「${doc.title}」에 대한 최신 검증 리포트가 없습니다.`,
        field,
        hint: "원천 문서 재검증을 실행해 주세요.",
      });
      continue;
    }

    if (isAfterWithGrace(doc.updatedAt, report.checkedAt)) {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_REPORT_STALE",
        message: `원천 문서「${doc.title}」가 검증 이후 수정되었습니다. 재검증이 필요합니다.`,
        field,
        hint: "문서 수정 후 재검증하고 릴리스 게이트를 다시 실행해 주세요.",
      });
    }

    if (doc.validationStatus !== report.status) {
      issues.push({
        severity: "BLOCKER",
        code: "SOURCE_VALIDATION_STATUS_MISMATCH",
        message: `원천 문서「${doc.title}」의 validationStatus(${doc.validationStatus})와 리포트 상태(${report.status})가 일치하지 않습니다.`,
        field,
        hint: "재검증을 실행해 문서 상태와 리포트를 맞춰 주세요.",
      });
    }
  }

  const hasBlocker = issues.some((i) => i.severity === "BLOCKER");
  if (hasBlocker) {
    return { issues, sectionStatus: "FAIL" };
  }
  const hasWarningDoc = docs.some((d) => d.validationStatus === "WARNING");
  if (hasWarningDoc) {
    return { issues, sectionStatus: "WARNING" };
  }
  return { issues, sectionStatus: "PASS" };
}

export function evaluateStructureQualityReleaseGate(
  summary: StructureQualitySummaryDto | null,
): { issues: ReleaseGateIssue[]; sectionStatus: ReleaseGateSectionStatus } {
  const issues: ReleaseGateIssue[] = [];
  const snapshot = structureQualityGateSnapshotFromSummary(summary);

  if (snapshot.freshnessStatus === "MISSING" || !summary) {
    issues.push({
      severity: "BLOCKER",
      code: "STRUCTURE_QUALITY_MISSING",
      message: getStructureQualityBlockingMessage(snapshot, summary) ?? "구조/지식 품질 점검이 필요합니다.",
    });
    return { issues, sectionStatus: "MISSING" };
  }
  if (snapshot.freshnessStatus === "STALE") {
    issues.push({
      severity: "BLOCKER",
      code: "STRUCTURE_QUALITY_STALE",
      message:
        getStructureQualityBlockingMessage(snapshot, summary) ??
        "구조/지식 품질 점검 결과가 최신 상태가 아닙니다.",
    });
    return { issues, sectionStatus: "FAIL" };
  }
  if (snapshot.structureCoverageStatus === "FAIL") {
    issues.push({
      severity: "BLOCKER",
      code: "STRUCTURE_COVERAGE_FAILED",
      message: "구조 커버리지가 FAIL입니다.",
    });
  }
  if (snapshot.knowledgeQualityStatus === "FAIL") {
    issues.push({
      severity: "BLOCKER",
      code: "KNOWLEDGE_QUALITY_FAILED",
      message: "지식 품질이 FAIL입니다.",
    });
  }
  if (hasStructureQualityWarning(snapshot)) {
    issues.push({
      severity: "WARNING",
      code: "STRUCTURE_QUALITY_WARNING",
      message: "구조 커버리지 또는 지식 품질이 WARNING입니다.",
    });
  }

  const hasBlocker = issues.some((i) => i.severity === "BLOCKER");
  if (hasBlocker) {
    return { issues, sectionStatus: "FAIL" };
  }
  if (issues.some((i) => i.severity === "WARNING")) {
    return { issues, sectionStatus: "WARNING" };
  }
  return { issues, sectionStatus: "PASS" };
}

export function evaluateChunkQualityReleaseGate(
  summary: ChunkQualitySummaryDto | null,
): { issues: ReleaseGateIssue[]; sectionStatus: ReleaseGateSectionStatus } {
  const issues: ReleaseGateIssue[] = [];
  const snapshot = chunkQualityGateSnapshotFromSummary(summary);

  if (snapshot.freshnessStatus === "MISSING" || !summary?.report) {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_QUALITY_MISSING",
      message: getChunkQualityBlockingMessage(snapshot, summary) ?? "청킹 품질 점검이 필요합니다.",
    });
    return { issues, sectionStatus: "MISSING" };
  }
  if (snapshot.freshnessStatus === "STALE") {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_QUALITY_STALE",
      message:
        getChunkQualityBlockingMessage(snapshot, summary) ??
        "청킹 품질 점검 결과가 최신 상태가 아닙니다.",
    });
    return { issues, sectionStatus: "FAIL" };
  }
  if (snapshot.reportStatus === "FAIL") {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_QUALITY_FAILED",
      message: getChunkQualityBlockingMessage(snapshot, summary) ?? "청킹 품질이 FAIL입니다.",
    });
    return { issues, sectionStatus: "FAIL" };
  }
  if (snapshot.reportStatus === "WARNING") {
    issues.push({
      severity: "WARNING",
      code: "CHUNK_QUALITY_WARNING",
      message: "청킹 품질이 WARNING입니다.",
    });
  }

  const hasBlocker = issues.some((i) => i.severity === "BLOCKER");
  if (hasBlocker) {
    return { issues, sectionStatus: "FAIL" };
  }
  if (issues.some((i) => i.severity === "WARNING")) {
    return { issues, sectionStatus: "WARNING" };
  }
  return { issues, sectionStatus: "PASS" };
}

export function evaluateRetrievalEvaluationReleaseGate(
  summary: RetrievalEvaluationSummaryDto | null,
): { issues: ReleaseGateIssue[]; sectionStatus: ReleaseGateSectionStatus } {
  const issues: ReleaseGateIssue[] = [];
  const snapshot = retrievalEvaluationGateSnapshotFromSummary(summary);
  const latestRun = summary?.latestRun;

  if (snapshot.freshnessStatus === "MISSING" || !latestRun) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVALUATION_MISSING",
      message:
        getRetrievalEvaluationBlockingMessage(snapshot, summary) ??
        "검색 품질 평가가 필요합니다.",
    });
    return { issues, sectionStatus: "MISSING" };
  }
  if (snapshot.freshnessStatus === "STALE") {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVALUATION_STALE",
      message:
        getRetrievalEvaluationBlockingMessage(snapshot, summary) ??
        "검색 품질 평가 결과가 최신 상태가 아닙니다.",
    });
    return { issues, sectionStatus: "FAIL" };
  }
  if (latestRun.evaluatedCaseCount < MIN_RETRIEVAL_EVAL_CASES) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVALUATION_FAILED",
      message: `검색 품질 평가 케이스가 부족합니다 (최소 ${MIN_RETRIEVAL_EVAL_CASES}건).`,
    });
  }
  if (latestRun.evaluatedResultCount < latestRun.evaluatedCaseCount) {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVALUATION_FAILED",
      message: "검색 품질 평가 결과 수가 케이스 수보다 적습니다.",
    });
  }
  if (snapshot.reportStatus === "FAIL") {
    issues.push({
      severity: "BLOCKER",
      code: "RETRIEVAL_EVALUATION_FAILED",
      message:
        getRetrievalEvaluationBlockingMessage(snapshot, summary) ??
        "검색 품질 평가가 FAIL입니다.",
    });
  }
  if (snapshot.reportStatus === "WARNING") {
    issues.push({
      severity: "WARNING",
      code: "RETRIEVAL_EVALUATION_WARNING",
      message: "검색 품질 평가가 WARNING입니다.",
    });
  }
  const hasDivergence = latestRun.issues.some((i) => i.code === "RETRIEVAL_MODE_DIVERGENCE");
  if (hasDivergence) {
    issues.push({
      severity: "WARNING",
      code: "RETRIEVAL_EVALUATION_WARNING",
      message: "keyword/hybrid 검색 모드 결과가 크게 다릅니다.",
      hint: "검색 품질 평가 이슈를 확인해 주세요.",
    });
  }

  const hasBlocker = issues.some((i) => i.severity === "BLOCKER");
  if (hasBlocker) {
    return { issues, sectionStatus: "FAIL" };
  }
  if (issues.some((i) => i.severity === "WARNING")) {
    return { issues, sectionStatus: "WARNING" };
  }
  return { issues, sectionStatus: "PASS" };
}

export function evaluateGraphReleaseGate(graphNodeCount: number): {
  issues: ReleaseGateIssue[];
  sectionStatus: ReleaseGateSectionStatus;
} {
  const issues: ReleaseGateIssue[] = [];
  if (graphNodeCount <= 0) {
    issues.push({
      severity: "WARNING",
      code: "GRAPH_NOT_BUILT",
      message: "지식 그래프 노드가 없습니다.",
      hint: "그래프 재구성을 권장합니다.",
    });
    return { issues, sectionStatus: "WARNING" };
  }
  return { issues, sectionStatus: "PASS" };
}

export function runReleaseGateEvaluation(
  input: ReleaseGateEvaluationInput,
): ReleaseGateEvaluationResult {
  const issues: ReleaseGateIssue[] = [];

  if (input.requireReviewingStatus && input.packStatus !== "REVIEWING") {
    issues.push({
      severity: "BLOCKER",
      code: "PACK_NOT_REVIEWING",
      message: "검수 중(REVIEWING) 상태의 지식팩만 승인할 수 있습니다.",
    });
  }

  if (!input.versionId) {
    issues.push({
      severity: "BLOCKER",
      code: "VERSION_MISSING",
      message: "승인할 버전이 없습니다.",
    });
  }

  if (!input.hasRequiredDescription) {
    issues.push({
      severity: "BLOCKER",
      code: "DESCRIPTION_MISSING",
      message: "짧은 설명과 상세 설명이 모두 필요합니다.",
    });
  }

  const source = evaluateSourceValidationReleaseGate({
    sourceDocuments: input.sourceDocuments,
    latestReportsByDocumentId: input.latestReportsByDocumentId,
  });
  issues.push(...source.issues);

  const structure = evaluateStructureQualityReleaseGate(input.structureQuality);
  issues.push(...structure.issues);

  const chunk = evaluateChunkQualityReleaseGate(input.chunkQuality);
  issues.push(...chunk.issues);

  const retrieval = evaluateRetrievalEvaluationReleaseGate(input.retrievalEvaluation);
  issues.push(...retrieval.issues);

  const graph = evaluateGraphReleaseGate(input.graphNodeCount);
  issues.push(...graph.issues);

  if (
    input.packStatus === "PUBLISHED" ||
    input.packStatus === "VERIFIED" ||
    input.packStatus === "SUSPENDED"
  ) {
    issues.push({
      severity: "WARNING",
      code: "PUBLIC_STATUS_INVALID",
      message: `현재 팩 상태(${input.packStatus})에서 공개 전환을 다시 점검하고 있습니다.`,
    });
  }

  const { status, blockingIssueCount, warningIssueCount } = computeReleaseGateStatus(issues);

  const summary = [
    `릴리스 게이트 ${status}`,
    `원천 ${source.sectionStatus}`,
    `구조 ${structure.sectionStatus}`,
    `청킹 ${chunk.sectionStatus}`,
    `검색 ${retrieval.sectionStatus}`,
    `그래프 ${graph.sectionStatus}`,
    `차단 ${blockingIssueCount} · 경고 ${warningIssueCount}`,
  ].join(" · ");

  return {
    status,
    blockingIssueCount,
    warningIssueCount,
    sourceStatus: source.sectionStatus,
    structureStatus: structure.sectionStatus,
    chunkStatus: chunk.sectionStatus,
    retrievalStatus: retrieval.sectionStatus,
    graphStatus: graph.sectionStatus,
    issues,
    summary,
    versionId: input.versionId,
    targetStatus: input.targetStatus,
  };
}

export function getFirstBlockerMessage(
  issues: Array<{ severity: string; message: string }>,
): string | null {
  const blocker = issues.find((i) => i.severity === "BLOCKER");
  return blocker?.message ?? null;
}

export const RELEASE_GATE_APPROVAL_BLOCKED_MESSAGE =
  "릴리스 게이트를 통과하지 못했습니다. 차단 항목을 확인한 뒤 재평가해 주세요.";
