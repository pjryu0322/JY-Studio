import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { ChunkQualityFreshnessStatus } from "@/lib/chunk-quality/chunk-quality-freshness";

export type ChunkQualityGateSnapshot = {
  reportStatus: string | null;
  freshnessStatus: ChunkQualityFreshnessStatus;
};

export function chunkQualityGateSnapshotFromSummary(
  summary: ChunkQualitySummaryDto | null,
): ChunkQualityGateSnapshot {
  if (!summary?.report) {
    return {
      reportStatus: null,
      freshnessStatus: summary?.freshness.status ?? "MISSING",
    };
  }
  return {
    reportStatus: summary.report.status,
    freshnessStatus: summary.freshness.status,
  };
}

export function meetsChunkQualityGate(snapshot: ChunkQualityGateSnapshot): boolean {
  if (snapshot.freshnessStatus !== "CURRENT") {
    return false;
  }
  if (!snapshot.reportStatus) {
    return false;
  }
  return snapshot.reportStatus !== "FAIL";
}

export function getChunkQualityBlockingMessage(
  snapshot: ChunkQualityGateSnapshot,
  summary?: ChunkQualitySummaryDto | null,
): string | null {
  if (snapshot.freshnessStatus === "MISSING") {
    return summary?.freshness.reason ?? "청킹 품질 점검을 먼저 실행해 주세요.";
  }
  if (snapshot.freshnessStatus === "STALE") {
    return (
      summary?.freshness.reason ??
      "청킹 품질 점검 결과가 최신 chunk/source/검증 상태와 일치하지 않습니다. 재평가해 주세요."
    );
  }
  if (!snapshot.reportStatus) {
    return "청킹 품질 점검을 먼저 실행해 주세요.";
  }
  if (snapshot.reportStatus === "FAIL") {
    return "청킹 품질(FAIL) 결과로 제출할 수 없습니다. chunk를 보완한 뒤 재평가하세요.";
  }
  return null;
}
