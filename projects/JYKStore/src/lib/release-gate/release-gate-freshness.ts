import type { ReleaseGateRunDto, ReleaseGateFreshnessSnapshot } from "@/lib/release-gate/release-gate-dto";
import { FRESHNESS_GRACE_MS } from "@/lib/release-gate/release-gate-runner";

function isAfterWithGrace(later: Date, earlier: Date): boolean {
  return later.getTime() > earlier.getTime() + FRESHNESS_GRACE_MS;
}

export function computeReleaseGateFreshness(input: {
  latestRun: ReleaseGateRunDto | null;
  versionId: string | null;
  versionUpdatedAt: Date | null;
  maxSourceDocumentUpdatedAt: Date | null;
  maxSourceValidationCheckedAt: Date | null;
  maxStructureQualityCheckedAt: Date | null;
  maxChunkQualityCheckedAt: Date | null;
  maxRetrievalEvaluationCheckedAt: Date | null;
}): ReleaseGateFreshnessSnapshot {
  if (!input.latestRun) {
    return {
      status: "MISSING",
      reason: "릴리스 게이트 점검 이력이 없습니다. 재점검을 실행해 주세요.",
      checkedAt: null,
      versionId: input.versionId,
    };
  }

  const checkedAt = new Date(input.latestRun.checkedAt);
  const runVersionId = input.latestRun.versionId;

  if (input.versionId && runVersionId && input.versionId !== runVersionId) {
    return {
      status: "STALE",
      reason: "릴리스 게이트가 최신 버전 기준이 아닙니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (input.versionUpdatedAt && isAfterWithGrace(input.versionUpdatedAt, checkedAt)) {
    return {
      status: "STALE",
      reason: "버전 정보가 릴리스 게이트 이후 변경되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (
    input.maxSourceDocumentUpdatedAt &&
    isAfterWithGrace(input.maxSourceDocumentUpdatedAt, checkedAt)
  ) {
    return {
      status: "STALE",
      reason: "원천 문서가 릴리스 게이트 이후 변경되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (
    input.maxSourceValidationCheckedAt &&
    isAfterWithGrace(input.maxSourceValidationCheckedAt, checkedAt)
  ) {
    return {
      status: "STALE",
      reason: "원천 검증 리포트가 릴리스 게이트 이후 갱신되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (
    input.maxStructureQualityCheckedAt &&
    isAfterWithGrace(input.maxStructureQualityCheckedAt, checkedAt)
  ) {
    return {
      status: "STALE",
      reason: "구조/지식 품질 리포트가 릴리스 게이트 이후 갱신되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (input.maxChunkQualityCheckedAt && isAfterWithGrace(input.maxChunkQualityCheckedAt, checkedAt)) {
    return {
      status: "STALE",
      reason: "청킹 품질 리포트가 릴리스 게이트 이후 갱신되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  if (
    input.maxRetrievalEvaluationCheckedAt &&
    isAfterWithGrace(input.maxRetrievalEvaluationCheckedAt, checkedAt)
  ) {
    return {
      status: "STALE",
      reason: "검색 품질 평가가 릴리스 게이트 이후 갱신되었습니다.",
      checkedAt: input.latestRun.checkedAt,
      versionId: input.versionId,
    };
  }

  return {
    status: "CURRENT",
    reason: null,
    checkedAt: input.latestRun.checkedAt,
    versionId: input.versionId,
  };
}
