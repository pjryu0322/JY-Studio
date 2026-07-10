import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";

export type ReviewDecisionState =
  | "release_gate_required"
  | "approval_ready"
  | "approval_warning"
  | "approval_blocked"
  | "already_published"
  | "not_reviewing";

export function hasCurrentReleaseGate(detail: AdminReviewDetailDto): boolean {
  return Boolean(
    detail.releaseGate?.latestRun && detail.releaseGate.freshness.status === "CURRENT",
  );
}

export function canApproveAdminReview(detail: AdminReviewDetailDto): boolean {
  return (
    detail.pack.status === "REVIEWING" &&
    detail.readiness.canApprove &&
    hasCurrentReleaseGate(detail) &&
    detail.readiness.releaseGateStatus !== "FAIL"
  );
}

function hasWarningSignals(detail: AdminReviewDetailDto): boolean {
  const r = detail.readiness;
  return (
    r.releaseGateStatus === "WARNING" ||
    r.sourceValidation.warningCount > 0 ||
    r.structureCoverageStatus === "WARNING" ||
    r.knowledgeQualityStatus === "WARNING" ||
    r.chunkQualityStatus === "WARNING" ||
    r.retrievalEvaluationStatus === "WARNING"
  );
}

export function resolveReviewDecisionState(detail: AdminReviewDetailDto): ReviewDecisionState {
  if (detail.pack.status === "PUBLISHED" || detail.pack.status === "VERIFIED") {
    return "already_published";
  }

  if (detail.pack.status !== "REVIEWING") {
    return "not_reviewing";
  }

  if (!hasCurrentReleaseGate(detail)) {
    return "release_gate_required";
  }

  if (detail.readiness.releaseGateStatus === "FAIL" || !detail.readiness.canApprove) {
    return "approval_blocked";
  }

  if (hasWarningSignals(detail)) {
    return "approval_warning";
  }

  return "approval_ready";
}

export function collectReviewBlockers(detail: AdminReviewDetailDto): string[] {
  const blockers: string[] = [];
  const r = detail.readiness;

  if (r.sourceValidation.failCount > 0) {
    blockers.push(`원천 문서 ${r.sourceValidation.failCount}개가 FAIL 상태입니다.`);
  }
  if (r.sourceValidation.notCheckedCount > 0) {
    blockers.push(`원천 문서 ${r.sourceValidation.notCheckedCount}개가 아직 검증되지 않았습니다.`);
  }
  if (r.structureQualityMessage) blockers.push(r.structureQualityMessage);
  if (r.chunkQualityMessage) blockers.push(r.chunkQualityMessage);
  if (r.retrievalEvaluationMessage) blockers.push(r.retrievalEvaluationMessage);
  if (r.releaseGateMessage) blockers.push(r.releaseGateMessage);
  if (r.releaseGateStatus === "FAIL") {
    blockers.push("릴리스 게이트가 FAIL입니다.");
  }
  if (!r.hasRequiredDescription) {
    blockers.push("지식팩 설명이 부족합니다.");
  }
  if (r.versionCount < 1) blockers.push("버전이 없습니다.");
  if (r.sourceDocumentCount < 1) blockers.push("원천 문서가 없습니다.");

  return [...new Set(blockers)];
}

export function collectReviewWarnings(detail: AdminReviewDetailDto): string[] {
  const warnings: string[] = [];
  const r = detail.readiness;

  if (r.sourceValidation.warningCount > 0) {
    warnings.push(`원천 문서 ${r.sourceValidation.warningCount}개가 WARNING 상태입니다.`);
  }

  const missingProductVersion = detail.versions
    .flatMap((v) => v.sourceDocuments)
    .filter((d) => !d.productVersion?.trim()).length;
  if (missingProductVersion > 0) {
    warnings.push(`productVersion이 없는 원천 문서가 ${missingProductVersion}개 있습니다.`);
  }

  if (r.structureCoverageStatus === "WARNING" || r.knowledgeQualityStatus === "WARNING") {
    warnings.push("구조 커버리지 또는 지식 품질이 WARNING입니다.");
  }
  if (r.chunkQualityStatus === "WARNING") {
    warnings.push("청킹 품질이 WARNING입니다.");
  }
  if (r.retrievalEvaluationStatus === "WARNING") {
    warnings.push("검색 품질 평가가 WARNING입니다.");
  }
  if (r.releaseGateStatus === "WARNING") {
    warnings.push("릴리스 게이트가 WARNING입니다.");
  }

  return warnings;
}

export function collectReviewActions(detail: AdminReviewDetailDto): string[] {
  const state = resolveReviewDecisionState(detail);
  if (state === "release_gate_required") {
    return ["공개 승인 전 릴리스 게이트 최종 점검을 실행하세요."];
  }
  if (state === "approval_blocked") {
    return ["반려 사유를 작성해 제공자에게 보완을 요청하세요."];
  }
  if (state === "approval_warning") {
    return [
      "공개에 문제 없는 항목인지 확인하세요.",
      "필요하면 반려 사유에 보완 요청을 작성하세요.",
    ];
  }
  if (state === "approval_ready") {
    return ["승인하면 일반 카탈로그와 Context API에 공개됩니다."];
  }
  return [];
}

export type AdminReviewDetailSectionKey =
  | "structure"
  | "chunk"
  | "retrieval"
  | "releaseGate"
  | "sources"
  | "advanced";

export function defaultOpenAdminReviewSections(
  detail: AdminReviewDetailDto,
): Partial<Record<AdminReviewDetailSectionKey, boolean>> {
  const r = detail.readiness;
  return {
    structure:
      r.structureCoverageStatus === "FAIL" || r.knowledgeQualityStatus === "FAIL",
    chunk: r.chunkQualityStatus === "FAIL",
    retrieval: r.retrievalEvaluationStatus === "FAIL",
    releaseGate: r.releaseGateStatus === "FAIL",
    sources: r.sourceValidation.failCount > 0 || r.sourceValidation.notCheckedCount > 0,
    advanced: false,
  };
}
