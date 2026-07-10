import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { isAdminReviewAccepted } from "@/lib/pack-review-status";
import type { ProviderReviewSubmitSnapshot } from "@/lib/provider-review-submit-snapshot";

export type ReviewDecisionState =
  | "review_refresh_required"
  | "submit_package_changed"
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

function getSubmitSnapshot(
  detail: AdminReviewDetailDto,
): ProviderReviewSubmitSnapshot | null {
  return detail.latestReview?.submitSnapshot ?? null;
}

export function detectSubmitSnapshotDrift(detail: AdminReviewDetailDto): {
  changed: boolean;
  reasons: string[];
} {
  const snapshot = getSubmitSnapshot(detail);
  if (!snapshot) return { changed: false, reasons: [] };

  const reasons: string[] = [];
  const version = snapshot.submittedVersionId
    ? detail.versions.find((v) => v.id === snapshot.submittedVersionId)
    : undefined;
  const currentSourceCount =
    version?.sourceDocuments.length ?? detail.readiness.sourceDocumentCount;

  if (currentSourceCount !== snapshot.sourceDocumentCount) {
    reasons.push(
      `원천 문서 수 불일치 (제출 ${snapshot.sourceDocumentCount} → 현재 ${currentSourceCount})`,
    );
  }

  if (version && snapshot.sourceDocumentIds.length > 0) {
    const currentIds = new Set(version.sourceDocuments.map((d) => d.id));
    const missing = snapshot.sourceDocumentIds.some((id) => !currentIds.has(id));
    const extra = version.sourceDocuments.some(
      (d) => !snapshot.sourceDocumentIds.includes(d.id),
    );
    if (missing || extra) {
      reasons.push("원천 문서 구성이 제출 시점과 다릅니다.");
    }
  }

  const currentChunkCount = detail.chunkQuality?.report?.activeChunkCount;
  if (
    currentChunkCount != null &&
    currentChunkCount !== snapshot.activeChunkCount
  ) {
    reasons.push(
      `active chunk 수 불일치 (제출 ${snapshot.activeChunkCount} → 현재 ${currentChunkCount})`,
    );
  }

  if (
    snapshot.releaseGateRunId &&
    detail.releaseGate?.latestRun?.id &&
    snapshot.releaseGateRunId !== detail.releaseGate.latestRun.id
  ) {
    reasons.push("릴리스 게이트 실행이 제출 시점과 다릅니다.");
  }

  if (
    snapshot.retrievalEvaluationRunId &&
    detail.retrievalEvaluation?.latestRun?.id &&
    snapshot.retrievalEvaluationRunId !== detail.retrievalEvaluation.latestRun.id
  ) {
    reasons.push("검색 평가 실행이 제출 시점과 다릅니다.");
  }

  if (reasons.length === 0 && hasStaleQualitySignals(detail)) {
    reasons.push("제출 이후 원천/점검 데이터가 변경된 것으로 보입니다.");
  }

  return { changed: reasons.length > 0, reasons };
}

export function isSubmitSnapshotApprovalEligible(detail: AdminReviewDetailDto): boolean {
  const snapshot = getSubmitSnapshot(detail);
  if (!snapshot) return false;
  if (detail.pack.status !== "REVIEWING") return false;
  if (snapshot.releaseGateStatus !== "PASS" && snapshot.releaseGateStatus !== "WARNING") {
    return false;
  }
  if (detail.readiness.sourceValidation.failCount > 0) return false;
  if (detail.readiness.sourceValidation.notCheckedCount > 0) return false;
  if (detail.readiness.releaseGateStatus === "FAIL") return false;
  if (detectSubmitSnapshotDrift(detail).changed) return false;
  return true;
}

export function canApproveAdminReview(detail: AdminReviewDetailDto): boolean {
  if (!isAdminReviewAccepted(detail.latestReview?.status)) {
    return false;
  }
  if (isSubmitSnapshotApprovalEligible(detail)) {
    return true;
  }
  return (
    detail.pack.status === "REVIEWING" &&
    detail.readiness.canApprove &&
    hasCurrentReleaseGate(detail) &&
    detail.readiness.releaseGateStatus !== "FAIL"
  );
}

function hasWarningSignals(detail: AdminReviewDetailDto): boolean {
  const r = detail.readiness;
  const snapshot = getSubmitSnapshot(detail);
  return (
    snapshot?.releaseGateStatus === "WARNING" ||
    r.releaseGateStatus === "WARNING" ||
    r.sourceValidation.warningCount > 0 ||
    r.structureCoverageStatus === "WARNING" ||
    r.knowledgeQualityStatus === "WARNING" ||
    r.chunkQualityStatus === "WARNING" ||
    r.retrievalEvaluationStatus === "WARNING"
  );
}

/** Freshness / source-change messages that need re-check, not reject. */
export function isRefreshMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  if (
    message.includes("(FAIL)") &&
    !message.includes("최신") &&
    !message.includes("일치하지") &&
    !message.includes("변경")
  ) {
    return false;
  }
  return (
    message.includes("최신") ||
    message.includes("변경") ||
    message.includes("재평가") ||
    (message.includes("재점검") && !message.includes("(FAIL)"))
  );
}

function isReleaseGateRefreshMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  if (message.includes("(FAIL)")) return false;
  return message.includes("일치하지") || message.includes("최신 데이터");
}

export function hasStaleQualitySignals(detail: AdminReviewDetailDto): boolean {
  const structureFresh = detail.structureQuality?.freshness.status;
  const chunkFresh = detail.chunkQuality?.freshness.status;
  const retrievalFresh = detail.retrievalEvaluation?.freshness.status;
  const releaseFresh = detail.releaseGate?.freshness.status;

  if (
    structureFresh === "STALE" ||
    chunkFresh === "STALE" ||
    retrievalFresh === "STALE" ||
    releaseFresh === "STALE"
  ) {
    return true;
  }

  // Loaded summaries marked MISSING (absent summaries fall through to message heuristics).
  if (
    (detail.structureQuality && structureFresh === "MISSING") ||
    (detail.chunkQuality && chunkFresh === "MISSING") ||
    (detail.retrievalEvaluation && retrievalFresh === "MISSING")
  ) {
    return true;
  }

  const r = detail.readiness;
  return Boolean(
    isRefreshMessage(r.structureQualityMessage) ||
      isRefreshMessage(r.chunkQualityMessage) ||
      isRefreshMessage(r.retrievalEvaluationMessage) ||
      isReleaseGateRefreshMessage(r.releaseGateMessage),
  );
}

export function resolveReviewDecisionState(detail: AdminReviewDetailDto): ReviewDecisionState {
  if (detail.pack.status === "PUBLISHED" || detail.pack.status === "VERIFIED") {
    return "already_published";
  }

  if (detail.pack.status !== "REVIEWING") {
    return "not_reviewing";
  }

  const snapshot = getSubmitSnapshot(detail);
  if (snapshot && (snapshot.releaseGateStatus === "PASS" || snapshot.releaseGateStatus === "WARNING")) {
    if (
      detail.readiness.sourceValidation.failCount > 0 ||
      detail.readiness.releaseGateStatus === "FAIL"
    ) {
      return "approval_blocked";
    }
    if (detectSubmitSnapshotDrift(detail).changed) {
      return "submit_package_changed";
    }
    if (hasWarningSignals(detail)) {
      return "approval_warning";
    }
    return "approval_ready";
  }

  if (hasStaleQualitySignals(detail)) {
    return "review_refresh_required";
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

export function collectReviewRefreshReasons(detail: AdminReviewDetailDto): string[] {
  const drift = detectSubmitSnapshotDrift(detail);
  if (drift.changed) {
    return drift.reasons;
  }

  const reasons: string[] = [];
  const r = detail.readiness;

  if (
    (detail.structureQuality &&
      (detail.structureQuality.freshness.status === "STALE" ||
        detail.structureQuality.freshness.status === "MISSING")) ||
    isRefreshMessage(r.structureQualityMessage)
  ) {
    reasons.push("원천 문서 변경으로 구조/품질 재점검이 필요합니다.");
  }

  if (
    (detail.chunkQuality &&
      (detail.chunkQuality.freshness.status === "STALE" ||
        detail.chunkQuality.freshness.status === "MISSING")) ||
    isRefreshMessage(r.chunkQualityMessage)
  ) {
    reasons.push("청킹 품질 결과가 최신 상태가 아닙니다.");
  }

  if (
    (detail.retrievalEvaluation &&
      (detail.retrievalEvaluation.freshness.status === "STALE" ||
        detail.retrievalEvaluation.freshness.status === "MISSING")) ||
    isRefreshMessage(r.retrievalEvaluationMessage)
  ) {
    reasons.push("검색 품질 평가 결과가 최신 상태가 아닙니다.");
  }

  if (
    detail.releaseGate?.freshness.status === "STALE" ||
    isReleaseGateRefreshMessage(r.releaseGateMessage)
  ) {
    reasons.push("릴리스 게이트 최종 점검이 최신 상태가 아닙니다.");
  }

  return [...new Set(reasons)];
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
  if (r.structureQualityMessage && !isRefreshMessage(r.structureQualityMessage)) {
    blockers.push(r.structureQualityMessage);
  }
  if (r.chunkQualityMessage && !isRefreshMessage(r.chunkQualityMessage)) {
    blockers.push(r.chunkQualityMessage);
  }
  if (r.retrievalEvaluationMessage && !isRefreshMessage(r.retrievalEvaluationMessage)) {
    blockers.push(r.retrievalEvaluationMessage);
  }
  if (
    r.releaseGateMessage &&
    !isRefreshMessage(r.releaseGateMessage) &&
    !isReleaseGateRefreshMessage(r.releaseGateMessage)
  ) {
    blockers.push(r.releaseGateMessage);
  }
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
  const snapshot = getSubmitSnapshot(detail);

  if (snapshot?.warnings?.length) {
    warnings.push(...snapshot.warnings);
  }

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
  if (r.releaseGateStatus === "WARNING" || snapshot?.releaseGateStatus === "WARNING") {
    warnings.push("릴리스 게이트가 WARNING입니다.");
  }

  return [...new Set(warnings)];
}

export function collectReviewActions(detail: AdminReviewDetailDto): string[] {
  const state = resolveReviewDecisionState(detail);
  if (state === "submit_package_changed") {
    return [
      "제출 패키지 기준으로 승인/반려하거나, 제공자에게 재제출을 요청하세요.",
      "필요하면 고급 작업에서 현재 데이터 기준 전체 재점검을 실행할 수 있습니다.",
    ];
  }
  if (state === "review_refresh_required") {
    return ["최신 데이터 기준으로 전체 재점검을 실행하세요."];
  }
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
