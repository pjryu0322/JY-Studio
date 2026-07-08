import type { ReleaseGateFreshnessSnapshot, ReleaseGateSummaryDto } from "@/lib/release-gate/release-gate-dto";
import type { ReleaseGateStatus } from "@/lib/release-gate/release-gate-types";

export function meetsReleaseGateForApproval(summary: ReleaseGateSummaryDto | null): boolean {
  if (!summary?.latestRun) {
    return false;
  }
  if (summary.freshness.status !== "CURRENT") {
    return false;
  }
  const status = summary.latestRun.status;
  return status === "PASS" || status === "WARNING";
}

export function getReleaseGateApprovalMessage(
  summary: ReleaseGateSummaryDto | null,
): string | null {
  if (!summary?.latestRun) {
    return "릴리스 게이트 재점검을 먼저 실행해 주세요. 승인 시에도 최신 상태로 다시 평가됩니다.";
  }
  if (summary.freshness.status === "STALE") {
    return "릴리스 게이트 결과가 최신 데이터와 일치하지 않습니다. 재점검 후 승인해 주세요.";
  }
  if (summary.latestRun.status === "FAIL") {
    return "릴리스 게이트(FAIL)로 승인할 수 없습니다. 차단 항목을 해결한 뒤 재점검해 주세요.";
  }
  return null;
}

export function releaseGateAllowsApprovalStatus(status: ReleaseGateStatus): boolean {
  return status === "PASS" || status === "WARNING";
}

export function releaseGateFreshnessBlocksApproval(
  freshness: ReleaseGateFreshnessSnapshot,
): boolean {
  return freshness.status !== "CURRENT";
}
