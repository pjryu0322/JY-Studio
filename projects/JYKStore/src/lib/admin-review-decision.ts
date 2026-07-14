import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  isAdminReviewAccepted,
  PackReviewStatus,
} from "@/lib/pack-review-status";
import {
  isDistributionReviewSnapshot,
  isDoclingBundleReviewSnapshot,
  type AnyReviewSubmitSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import {
  buildDistributionProcessingEvidence,
  buildDoclingProcessingEvidence,
  buildLegacyProcessingEvidence,
} from "@/lib/review-evidence/review-processing-evidence-adapters";
import { resolveApprovalPublishGuidance } from "@/lib/review-evidence/review-processing-evidence-service";
import {
  ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_BODY,
  ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_TITLE,
  ADMIN_REVIEW_ACCEPT_PHASE_READY_BODY,
  ADMIN_REVIEW_ACCEPT_PHASE_READY_TITLE,
  ADMIN_REVIEW_ACCEPT_PHASE_WARNING_BODY,
  ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE,
  ADMIN_REVIEW_STATE_BLOCKED_BODY,
  ADMIN_REVIEW_STATE_BLOCKED_TITLE,
  ADMIN_REVIEW_STATE_CHANGED_BODY,
  ADMIN_REVIEW_STATE_CHANGED_TITLE,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE,
  ADMIN_REVIEW_STATE_PUBLISHED_BODY,
  ADMIN_REVIEW_STATE_PUBLISHED_TITLE,
  ADMIN_REVIEW_STATE_READY_BODY,
  ADMIN_REVIEW_STATE_READY_TITLE,
  ADMIN_REVIEW_STATE_REFRESH_REQUIRED_BODY,
  ADMIN_REVIEW_STATE_REFRESH_REQUIRED_TITLE,
  ADMIN_REVIEW_STATE_WARNING_BODY,
  ADMIN_REVIEW_STATE_WARNING_TITLE,
} from "@/lib/role-based-ux-copy";

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
): AnyReviewSubmitSnapshot | null {
  return detail.latestReview?.submitSnapshot ?? null;
}

export function detectSubmitSnapshotDrift(detail: AdminReviewDetailDto): {
  changed: boolean;
  reasons: string[];
} {
  const snapshot = getSubmitSnapshot(detail);
  if (!snapshot) return { changed: false, reasons: [] };

  if (isDistributionReviewSnapshot(snapshot)) {
    const reasons: string[] = [];
    const payload = detail.payload;
    const distribution = detail.distribution;
    const submittedVersionId = snapshot.submittedVersionId;
    const currentVersionId = detail.versions[0]?.id;

    if (submittedVersionId && currentVersionId && submittedVersionId !== currentVersionId) {
      reasons.push("제출 버전이 현재 검수 버전과 다릅니다.");
    }
    if (!payload) {
      reasons.push("제출 시점 Payload가 현재 없습니다.");
    } else {
      if (payload.id !== snapshot.payloadId) {
        reasons.push("Payload가 제출 시점과 다릅니다.");
      }
      if (payload.checksumSha256 !== snapshot.checksumSha256) {
        reasons.push("Payload Checksum이 제출 시점과 다릅니다.");
      }
      if (payload.profile !== snapshot.payloadProfile) {
        reasons.push("Payload Profile이 제출 시점과 다릅니다.");
      }
      if (payload.validationStatus !== "VALID" || snapshot.validationStatus !== "VALID") {
        reasons.push("Payload 검증 상태가 VALID가 아닙니다.");
      }
    }
    if (
      snapshot.manifestFingerprint &&
      detail.currentManifestFingerprint &&
      snapshot.manifestFingerprint !== detail.currentManifestFingerprint
    ) {
      reasons.push("Manifest가 제출 시점과 다릅니다.");
    }
    if (snapshot.manifestSchemaVersion && snapshot.manifestSchemaVersion !== "jyk-distribution-0.2") {
      // Allow approve path to require refresh to 0.2 via fingerprint/stale checks on submit;
      // if current fingerprint exists and snapshot is old schema, treat as drift.
      if (detail.currentManifestFingerprint) {
        reasons.push("Manifest schemaVersion이 제출 시점과 다릅니다.");
      }
    }
    if (distribution) {
      if (distribution.visibility !== snapshot.visibility) {
        reasons.push("공개범위가 제출 시점과 다릅니다.");
      }
      if (distribution.allowDownload !== snapshot.allowDownload) {
        reasons.push("다운로드 허용 설정이 제출 시점과 다릅니다.");
      }
      if ((distribution.sourceTitle ?? null) !== (snapshot.sourceTitle ?? null)) {
        reasons.push("출처 정보가 제출 시점과 다릅니다.");
      }
      if (distribution.licenseName !== snapshot.licenseName) {
        reasons.push("라이선스가 제출 시점과 다릅니다.");
      }
    } else {
      reasons.push("유통정보가 없습니다.");
    }
    return { changed: reasons.length > 0, reasons };
  }

  if (isDoclingBundleReviewSnapshot(snapshot)) {
    const reasons: string[] = [];
    const distribution = detail.distribution;
    const submittedVersionId = snapshot.submittedVersionId;
    const currentVersionId = detail.versions[0]?.id;

    if (submittedVersionId && currentVersionId && submittedVersionId !== currentVersionId) {
      reasons.push("제출 버전이 현재 검수 버전과 다릅니다.");
    }
    if (distribution) {
      if (distribution.visibility !== snapshot.visibility) {
        reasons.push("공개범위가 제출 시점과 다릅니다.");
      }
      if (distribution.allowDownload !== snapshot.allowDownload) {
        reasons.push("다운로드 허용 설정이 제출 시점과 다릅니다.");
      }
      if ((distribution.sourceTitle ?? null) !== (snapshot.sourceTitle ?? null)) {
        reasons.push("출처 정보가 제출 시점과 다릅니다.");
      }
      if (distribution.licenseName !== snapshot.licenseName) {
        reasons.push("라이선스가 제출 시점과 다릅니다.");
      }
    } else {
      reasons.push("유통정보가 없습니다.");
    }
    return { changed: reasons.length > 0, reasons };
  }

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

function hasDoclingIntegrityBlock(detail: AdminReviewDetailDto): boolean {
  return detail.doclingReviewIntegrity?.status === "BLOCKED";
}

/** Map integrity codes to Provider/Admin-facing messages (no internal model names). */
function formatDoclingIntegrityIssue(issue: { code: string; message: string }): string {
  switch (issue.code) {
    case "DOCLING_REVIEW_FILE_NOT_FOUND":
    case "SOURCE_ORIGINAL_MISSING":
      if (/원본|SOURCE_ORIGINAL/i.test(issue.message)) {
        return "원본문서 파일이 없습니다. (SOURCE_ORIGINAL_MISSING)";
      }
      if (/JSON|DOCLING_JSON/i.test(issue.message)) {
        return "Docling JSON 파일이 없습니다. (DOCLING_JSON_MISSING)";
      }
      if (/Markdown|DOCLING_MARKDOWN/i.test(issue.message)) {
        return "Docling Markdown은 선택 자료입니다. 원본·JSON 무결성을 확인하세요.";
      }
      return issue.message.includes("필수")
        ? issue.message
        : "필수 Docling 파일이 없습니다.";
    case "DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISSING":
      return "정규화 문서가 없습니다.";
    case "DOCLING_REVIEW_NORMALIZED_DOCUMENT_MISMATCH":
      return "정규화 문서가 제출 스냅샷과 일치하지 않습니다.";
    case "DOCLING_REVIEW_BUNDLE_NOT_FOUND":
      return "Docling Bundle이 없습니다.";
    case "DOCLING_REVIEW_BUNDLE_NOT_ACTIVE":
      return "Docling Bundle이 비활성 상태입니다.";
    case "DOCLING_REVIEW_BUNDLE_NOT_READY":
      return "Docling Bundle 상태가 검수 준비가 아닙니다.";
    case "DOCLING_REVIEW_FINGERPRINT_MISMATCH":
    case "DOCLING_REVIEW_FINGERPRINT_RECALCULATION_FAILED":
    case "DOCLING_REVIEW_FINGERPRINT_VERSION_UNSUPPORTED":
      return "문서 Fingerprint가 일치하지 않습니다.";
    case "DOCLING_REVIEW_ADAPTER_VERSION_MISMATCH":
      return "Adapter Version이 제출 시점과 다릅니다.";
    case "DOCLING_REVIEW_OBJECT_MISSING":
    case "DOCLING_REVIEW_OBJECT_SIZE_MISMATCH":
    case "DOCLING_REVIEW_OBJECT_INTEGRITY_FAILED":
    case "DOCLING_REVIEW_CHECKSUM_MISMATCH":
      return "Object Storage 무결성 검증에 실패했습니다.";
    default:
      return issue.message || "Docling 무결성 검증에 실패했습니다.";
  }
}

function doclingIntegrityBlockers(detail: AdminReviewDetailDto): string[] {
  if (!hasDoclingIntegrityBlock(detail)) return [];
  const messages =
    detail.doclingReviewIntegrity?.errors.map((e) => formatDoclingIntegrityIssue(e)) ?? [];
  if (messages.length === 0) {
    return ["제출 시점 원본 파일과 현재 저장 파일의 무결성이 일치하지 않습니다."];
  }
  return [...new Set(messages)];
}

function doclingIntegrityWarnings(detail: AdminReviewDetailDto): string[] {
  const warnings = detail.doclingReviewIntegrity?.warnings ?? [];
  return [...new Set(warnings.map((w) => formatDoclingIntegrityIssue(w)))];
}

export function isSubmitSnapshotApprovalEligible(detail: AdminReviewDetailDto): boolean {
  const snapshot = getSubmitSnapshot(detail);
  if (!snapshot) return false;
  if (detail.pack.status !== "REVIEWING") return false;

  if (isDistributionReviewSnapshot(snapshot)) {
    if (snapshot.validationStatus !== "VALID") return false;
    if (!detail.payload || detail.payload.validationStatus !== "VALID") return false;
    if (detectSubmitSnapshotDrift(detail).changed) return false;
    return true;
  }

  if (isDoclingBundleReviewSnapshot(snapshot)) {
    if (!detail.distribution) return false;
    if (detectSubmitSnapshotDrift(detail).changed) return false;
    if (hasDoclingIntegrityBlock(detail)) return false;
    return true;
  }

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
  if (detail.payload && isDistributionReviewSnapshot(getSubmitSnapshot(detail))) {
    return false;
  }
  if (isDoclingBundleReviewSnapshot(getSubmitSnapshot(detail))) {
    return isSubmitSnapshotApprovalEligible(detail);
  }
  return (
    detail.pack.status === "REVIEWING" &&
    detail.readiness.canApprove &&
    hasCurrentReleaseGate(detail) &&
    detail.readiness.releaseGateStatus !== "FAIL"
  );
}

export function collectAcceptBlockers(detail: AdminReviewDetailDto): string[] {
  const blockers: string[] = [];
  const snapshot = getSubmitSnapshot(detail);

  if (!snapshot) {
    blockers.push("제출 스냅샷이 없습니다.");
    return [...new Set(blockers)];
  }

  if (isDistributionReviewSnapshot(snapshot)) {
    if (snapshot.validationStatus !== "VALID") {
      blockers.push("Payload 검증이 VALID가 아닙니다.");
    }
    blockers.push(
      "ZIP Knowledge Package 검수는 더 이상 지원되지 않습니다. Docling import로 다시 제출해 주세요.",
    );
    return [...new Set(blockers)];
  }

  if (isDoclingBundleReviewSnapshot(snapshot)) {
    if (!detail.distribution) {
      blockers.push("유통정보가 없습니다.");
    } else if (!detail.distribution.licenseName.trim()) {
      blockers.push("라이선스명이 없습니다.");
    }
    blockers.push(...collectPrimaryArtifactBlockers(detail));
    if (!snapshot.doclingBundleId || !snapshot.normalizedDocumentId) {
      blockers.push("Docling import 제출 정보가 불완전합니다.");
    }
    const drift = detectSubmitSnapshotDrift(detail);
    if (drift.changed) {
      blockers.push(...drift.reasons);
    }
    blockers.push(...doclingIntegrityBlockers(detail));
    return [...new Set(blockers)];
  }

  if (!snapshot.releaseGateStatus) {
    blockers.push("릴리스 게이트 결과가 없습니다.");
  } else if (
    snapshot.releaseGateStatus !== "PASS" &&
    snapshot.releaseGateStatus !== "WARNING"
  ) {
    blockers.push(`릴리스 게이트가 ${snapshot.releaseGateStatus}입니다.`);
  }
  if (snapshot.sourceDocumentCount < 1) {
    blockers.push("제출 패키지에 원천 문서가 없습니다.");
  }
  if (snapshot.activeChunkCount < 1) {
    blockers.push("제출 패키지에 검수용 Chunk가 없습니다.");
  }

  if (detail.readiness.sourceValidation.failCount > 0) {
    blockers.push(
      `원천 문서 ${detail.readiness.sourceValidation.failCount}개가 FAIL 상태입니다.`,
    );
  }
  if (detail.readiness.releaseGateStatus === "FAIL") {
    blockers.push("릴리스 게이트가 FAIL입니다.");
  }

  return [...new Set(blockers)];
}

/** PENDING 상태에서 관리자가 접수할 수 있는지. */
export function canAcceptAdminReview(detail: AdminReviewDetailDto): boolean {
  if (detail.pack.status !== "REVIEWING") return false;
  if (detail.latestReview?.status !== PackReviewStatus.PENDING) return false;
  return collectAcceptBlockers(detail).length === 0;
}

/**
 * 제출 패키지 결함 등 시스템 오류 시 접수 없이 반려 가능.
 * 권장 흐름은 접수 후 반려이며, 예외적으로만 사용한다.
 */
export function canRejectWithoutAccept(detail: AdminReviewDetailDto): boolean {
  if (detail.pack.status !== "REVIEWING") return false;
  if (detail.latestReview?.status !== PackReviewStatus.PENDING) return false;
  return !canAcceptAdminReview(detail);
}

export type ReviewStatusCopy = {
  title: string;
  body: string;
  tone: string;
};

export function resolvePendingAcceptCopy(detail: AdminReviewDetailDto): ReviewStatusCopy {
  if (!canAcceptAdminReview(detail)) {
    return {
      title: ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_TITLE,
      body: ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_BODY,
      tone: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (hasWarningSignals(detail) || collectReviewWarnings(detail).length > 0) {
    return {
      title: ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE,
      body: ADMIN_REVIEW_ACCEPT_PHASE_WARNING_BODY,
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    };
  }
  return {
    title: ADMIN_REVIEW_ACCEPT_PHASE_READY_TITLE,
    body: ADMIN_REVIEW_ACCEPT_PHASE_READY_BODY,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
}

export function resolveDecisionStatusCopy(detail: AdminReviewDetailDto): ReviewStatusCopy {
  const state = resolveReviewDecisionState(detail);
  switch (state) {
    case "review_refresh_required":
      return {
        title: ADMIN_REVIEW_STATE_REFRESH_REQUIRED_TITLE,
        body: ADMIN_REVIEW_STATE_REFRESH_REQUIRED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "submit_package_changed":
      return {
        title: ADMIN_REVIEW_STATE_CHANGED_TITLE,
        body: ADMIN_REVIEW_STATE_CHANGED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "release_gate_required":
      return {
        title: ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE,
        body: ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "approval_ready":
      return {
        title: ADMIN_REVIEW_STATE_READY_TITLE,
        body: ADMIN_REVIEW_STATE_READY_BODY,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      };
    case "approval_warning":
      return {
        title: ADMIN_REVIEW_STATE_WARNING_TITLE,
        body: ADMIN_REVIEW_STATE_WARNING_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "approval_blocked":
      return {
        title: ADMIN_REVIEW_STATE_BLOCKED_TITLE,
        body: ADMIN_REVIEW_STATE_BLOCKED_BODY,
        tone: "border-red-200 bg-red-50 text-red-900",
      };
    case "already_published":
      return {
        title: ADMIN_REVIEW_STATE_PUBLISHED_TITLE,
        body: ADMIN_REVIEW_STATE_PUBLISHED_BODY,
        tone: "border-slate-200 bg-slate-50 text-slate-800",
      };
    default:
      return {
        title: ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE,
        body: ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY,
        tone: "border-slate-200 bg-slate-50 text-slate-800",
      };
  }
}

function hasWarningSignals(detail: AdminReviewDetailDto): boolean {
  const r = detail.readiness;
  const snapshot = getSubmitSnapshot(detail);
  // Docling / ZIP warnings are mode-specific; do not use Legacy readiness signals.
  if (isDoclingBundleReviewSnapshot(snapshot) || isDistributionReviewSnapshot(snapshot)) {
    return false;
  }
  const snapshotReleaseWarning =
    snapshot &&
    !isDistributionReviewSnapshot(snapshot) &&
    !isDoclingBundleReviewSnapshot(snapshot) &&
    snapshot.releaseGateStatus === "WARNING";
  return (
    snapshotReleaseWarning ||
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
  if (isDistributionReviewSnapshot(snapshot)) {
    if (detectSubmitSnapshotDrift(detail).changed) {
      return "submit_package_changed";
    }
    if (snapshot.validationStatus !== "VALID" || detail.payload?.validationStatus !== "VALID") {
      return "approval_blocked";
    }
    return "approval_ready";
  }

  if (isDoclingBundleReviewSnapshot(snapshot)) {
    if (detectSubmitSnapshotDrift(detail).changed) {
      return "submit_package_changed";
    }
    if (!detail.distribution || hasDoclingIntegrityBlock(detail)) {
      return "approval_blocked";
    }
    return "approval_ready";
  }

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
  const snapshot = getSubmitSnapshot(detail);
  if (isDoclingBundleReviewSnapshot(snapshot) || isDistributionReviewSnapshot(snapshot)) {
    const drift = detectSubmitSnapshotDrift(detail);
    return drift.changed ? drift.reasons : [];
  }

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

function collectPrimaryArtifactBlockers(detail: AdminReviewDetailDto): string[] {
  const blockers: string[] = [];
  if (!detail.artifactOptions) return blockers;
  // Docling-only: require SOURCE_ORIGINAL ready when distribution metadata exists.
  if (detail.distribution && !detail.artifactOptions.externalImportReady) {
    blockers.push("공개 다운로드 Artifact(원본문서)가 준비되지 않았습니다.");
  }
  return blockers;
}

function collectDoclingReviewBlockers(detail: AdminReviewDetailDto): string[] {
  const blockers: string[] = [];

  if (!detail.distribution) {
    blockers.push("유통정보가 없습니다.");
  } else {
    if (!detail.distribution.licenseName?.trim()) {
      blockers.push("라이선스명이 없습니다.");
    }
    if (
      !detail.distribution.sourceTitle?.trim() &&
      !detail.distribution.sourceUrl?.trim()
    ) {
      blockers.push("출처 제목 또는 출처 URL이 없습니다.");
    }
  }

  blockers.push(...collectPrimaryArtifactBlockers(detail));

  const snapshot = getSubmitSnapshot(detail);
  if (!isDoclingBundleReviewSnapshot(snapshot)) {
    blockers.push("Docling Bundle 제출 스냅샷이 없습니다.");
    return [...new Set(blockers)];
  }

  if (!snapshot.doclingBundleId || !snapshot.normalizedDocumentId) {
    blockers.push("Docling import 제출 정보가 불완전합니다.");
  }

  const drift = detectSubmitSnapshotDrift(detail);
  if (drift.changed) {
    blockers.push(...drift.reasons);
  }

  blockers.push(...doclingIntegrityBlockers(detail));
  return [...new Set(blockers)];
}

function collectDistributionReviewBlockers(detail: AdminReviewDetailDto): string[] {
  void detail;
  return [
    "ZIP Knowledge Package 검수는 더 이상 지원되지 않습니다. Docling import로 다시 제출해 주세요.",
  ];
}

function collectLegacyReviewBlockers(detail: AdminReviewDetailDto): string[] {
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

export function collectReviewBlockers(detail: AdminReviewDetailDto): string[] {
  const snapshot = getSubmitSnapshot(detail);
  if (isDoclingBundleReviewSnapshot(snapshot)) {
    return collectDoclingReviewBlockers(detail);
  }
  if (isDistributionReviewSnapshot(snapshot)) {
    return collectDistributionReviewBlockers(detail);
  }
  return collectLegacyReviewBlockers(detail);
}

function collectDoclingReviewWarnings(detail: AdminReviewDetailDto): string[] {
  return [...new Set(doclingIntegrityWarnings(detail))];
}

function collectDistributionReviewWarnings(detail: AdminReviewDetailDto): string[] {
  const warnings: string[] = [];
  const payloadMessage = detail.payload?.validationMessage?.trim();
  if (payloadMessage && detail.payload?.validationStatus === "VALID") {
    warnings.push(payloadMessage);
  }
  return [...new Set(warnings)];
}

function collectLegacyReviewWarnings(detail: AdminReviewDetailDto): string[] {
  const warnings: string[] = [];
  const r = detail.readiness;
  const snapshot = getSubmitSnapshot(detail);

  if (
    snapshot &&
    !isDistributionReviewSnapshot(snapshot) &&
    !isDoclingBundleReviewSnapshot(snapshot) &&
    snapshot.warnings?.length
  ) {
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
  if (
    r.releaseGateStatus === "WARNING" ||
    (snapshot &&
      !isDistributionReviewSnapshot(snapshot) &&
      !isDoclingBundleReviewSnapshot(snapshot) &&
      snapshot.releaseGateStatus === "WARNING")
  ) {
    warnings.push("릴리스 게이트가 WARNING입니다.");
  }

  return [...new Set(warnings)];
}

export function collectReviewWarnings(detail: AdminReviewDetailDto): string[] {
  const snapshot = getSubmitSnapshot(detail);
  if (isDoclingBundleReviewSnapshot(snapshot)) {
    return collectDoclingReviewWarnings(detail);
  }
  if (isDistributionReviewSnapshot(snapshot)) {
    return collectDistributionReviewWarnings(detail);
  }
  return collectLegacyReviewWarnings(detail);
}

/** Test helper: acceptability must never contradict blocker list. */
export function assertAdminReviewDecisionConsistency(detail: AdminReviewDetailDto): {
  consistent: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (canAcceptAdminReview(detail) && collectReviewBlockers(detail).length > 0) {
    reasons.push("접수 가능한데 차단 이슈가 있습니다.");
  }
  return { consistent: reasons.length === 0, reasons };
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
    const snapshot = getSubmitSnapshot(detail);
    if (isDoclingBundleReviewSnapshot(snapshot)) {
      const evidence = buildDoclingProcessingEvidence({
        detail,
        bundle: null,
        capabilities: null,
      });
      // Prefer download-only guidance when retrieval/MCP are not known READY on detail alone.
      if (detail.doclingReviewIntegrity?.status === "PASS" || !detail.doclingReviewIntegrity) {
        return resolveApprovalPublishGuidance(evidence);
      }
    }
    if (isDistributionReviewSnapshot(snapshot) || detail.payload) {
      return resolveApprovalPublishGuidance(buildDistributionProcessingEvidence(detail));
    }
    return resolveApprovalPublishGuidance(buildLegacyProcessingEvidence(detail));
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
