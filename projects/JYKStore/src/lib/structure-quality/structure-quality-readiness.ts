import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { StructureQualityFreshnessStatus } from "@/lib/structure-quality/structure-quality-freshness";
import { freshnessReasonToMessage } from "@/lib/structure-quality/structure-quality-freshness";

export type StructureQualityGateSnapshot = {
  structureCoverageStatus: string | null;
  knowledgeQualityStatus: string | null;
  freshnessStatus: StructureQualityFreshnessStatus;
};

export function structureQualityGateSnapshotFromSummary(
  summary: StructureQualitySummaryDto | null,
): StructureQualityGateSnapshot {
  if (!summary) {
    return {
      structureCoverageStatus: null,
      knowledgeQualityStatus: null,
      freshnessStatus: "MISSING",
    };
  }
  return {
    structureCoverageStatus: summary.structureCoverage?.status ?? null,
    knowledgeQualityStatus: summary.knowledgeQuality?.status ?? null,
    freshnessStatus: summary.freshness.status,
  };
}

/** Submit/approve: reports must exist, be CURRENT, and neither may be FAIL. */
export function meetsStructureQualityGate(snapshot: StructureQualityGateSnapshot): boolean {
  if (snapshot.freshnessStatus !== "CURRENT") {
    return false;
  }
  if (!snapshot.structureCoverageStatus || !snapshot.knowledgeQualityStatus) {
    return false;
  }
  return (
    snapshot.structureCoverageStatus !== "FAIL" && snapshot.knowledgeQualityStatus !== "FAIL"
  );
}

export function getStructureQualityBlockingMessage(
  snapshot: StructureQualityGateSnapshot,
  summary?: StructureQualitySummaryDto | null,
): string | null {
  if (snapshot.freshnessStatus === "MISSING") {
    return summary?.freshness.reason ?? "구조/품질 점검을 먼저 실행해 주세요.";
  }
  if (snapshot.freshnessStatus === "STALE") {
    return (
      summary?.freshness.reason ??
      "구조/품질 점검 결과가 최신 원천 문서 또는 검증 상태와 일치하지 않습니다. 재평가를 실행해 주세요."
    );
  }
  if (!snapshot.structureCoverageStatus || !snapshot.knowledgeQualityStatus) {
    return "구조/품질 점검을 먼저 실행해 주세요.";
  }
  if (snapshot.structureCoverageStatus === "FAIL") {
    return "구조 커버리지(FAIL) 결과로 제출·승인할 수 없습니다. 필수 섹션을 보완한 뒤 재평가하세요.";
  }
  if (snapshot.knowledgeQualityStatus === "FAIL") {
    return "지식 품질(FAIL) 결과로 제출·승인할 수 없습니다. 이슈를 해결한 뒤 재평가하세요.";
  }
  return null;
}

export function hasStructureQualityWarning(snapshot: StructureQualityGateSnapshot): boolean {
  if (snapshot.freshnessStatus !== "CURRENT") {
    return false;
  }
  return (
    snapshot.structureCoverageStatus === "WARNING" ||
    snapshot.knowledgeQualityStatus === "WARNING"
  );
}

/** @deprecated use summary.freshness.reasonCode mapping — kept for tests */
export function staleReasonMessageForCode(
  code: Parameters<typeof freshnessReasonToMessage>[0],
): string | null {
  return freshnessReasonToMessage(code);
}
