/**
 * Harness Phase H8 — maturity baseline을 바탕으로 **release gate readiness**를 진단한다.
 *
 * 순수 함수 / read-only. actual 적용·차단·라우팅 없음(플래그는 항상 false).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "./harnessMaturityTypes";

function isReadOnlyReadyLayer(
  status: HarnessMaturityBaselineReport["layers"][number]["status"]
): boolean {
  return status === "ready_read_only" || status === "ready_for_controlled_trial";
}

export function evaluateHarnessReleaseGateReadiness(
  baseline: HarnessMaturityBaselineReport
): HarnessReleaseGateReadinessReport {
  const blockers: string[] = [];
  const recommendations: string[] = [];

  for (const layer of baseline.layers) {
    if (layer.status === "missing") {
      blockers.push(`missing_layer:${layer.layer}`);
    } else if (layer.status === "partial") {
      blockers.push(`partial_layer:${layer.layer}`);
    }
  }

  const allReadOnlyReady = baseline.layers.every((l) => isReadOnlyReadyLayer(l.status));

  let readinessLevel: HarnessReleaseGateReadinessReport["readinessLevel"];
  if (baseline.missingCount > 0 || baseline.overallStatus === "missing") {
    readinessLevel = "not_ready";
    recommendations.push("누락된 Harness 계층에 대한 타임라인/메타데이터 수집을 우선 보강하세요.");
  } else if (!allReadOnlyReady || baseline.partialCount > 0) {
    readinessLevel = "observe_more";
    recommendations.push("partial 계층을 추가 관찰한 뒤, 수동 검토 범위를 좁히세요.");
  } else {
    readinessLevel = "candidate_for_manual_review";
    recommendations.push("모든 계층이 read-only ready입니다. 다음 단계는 수동 검토·통제 시험 설계입니다.");
  }

  if (!baseline.userVisibleSummaryReady) {
    recommendations.push("사용자 요약 노출(Message Explainability) 경로를 확인하세요.");
  }

  return {
    mode: "read_only_release_gate_readiness",
    actualPromptAssemblyAllowed: false,
    actualRetrievalOrchestrationAllowed: false,
    actualProviderRoutingAllowed: false,
    actualBlockingAllowed: false,
    readinessLevel,
    blockers,
    recommendations,
  };
}
