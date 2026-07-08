import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";
import type { RetrievalEvaluationFreshnessStatus } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";

export type RetrievalEvaluationGateSnapshot = {
  reportStatus: string | null;
  freshnessStatus: RetrievalEvaluationFreshnessStatus;
};

export function retrievalEvaluationGateSnapshotFromSummary(
  summary: RetrievalEvaluationSummaryDto | null,
): RetrievalEvaluationGateSnapshot {
  if (!summary?.latestRun) {
    return {
      reportStatus: null,
      freshnessStatus: summary?.freshness.status ?? "MISSING",
    };
  }
  return {
    reportStatus: summary.latestRun.status,
    freshnessStatus: summary.freshness.status,
  };
}

export function meetsRetrievalEvaluationGate(
  snapshot: RetrievalEvaluationGateSnapshot,
): boolean {
  if (snapshot.freshnessStatus !== "CURRENT") {
    return false;
  }
  if (!snapshot.reportStatus) {
    return false;
  }
  return snapshot.reportStatus !== "FAIL";
}

export function getRetrievalEvaluationBlockingMessage(
  snapshot: RetrievalEvaluationGateSnapshot,
  summary?: RetrievalEvaluationSummaryDto | null,
): string | null {
  if (snapshot.freshnessStatus === "MISSING") {
    return (
      summary?.freshness.reason ??
      "검색 품질 평가 케이스를 생성하고 평가를 실행해 주세요."
    );
  }
  if (snapshot.freshnessStatus === "STALE") {
    return (
      summary?.freshness.reason ??
      "검색 품질 평가 결과가 최신 chunk/source/검증 상태와 일치하지 않습니다. 재평가해 주세요."
    );
  }
  if (!snapshot.reportStatus) {
    return "검색 품질 평가 케이스를 생성하고 평가를 실행해 주세요.";
  }
  if (snapshot.reportStatus === "FAIL") {
    return "검색 품질 평가(FAIL) 결과로 제출할 수 없습니다. 평가 케이스 또는 chunk/retrieval 품질을 보완해 주세요.";
  }
  return null;
}
