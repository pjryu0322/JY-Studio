/**
 * Harness H8 maturity baseline → Overlay 탭용 **요약 ViewModel**.
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";

export type HarnessMaturityUiLayerRow = Readonly<{
  layerLabel: string;
  statusLabel: string;
  exposureLabel: string;
}>;

export type HarnessMaturityUiViewModel = Readonly<{
  hasData: boolean;
  overallLabel: string;
  countsLabel: string;
  userVisibleSummaryLabel: string;
  controlledTrialLabel: string;
  releaseGateLevelLabel: string;
  releaseGateBlockers: readonly string[];
  releaseGateRecommendations: readonly string[];
  forbiddenFlags: readonly { label: string; value: string }[];
  layerRows: readonly HarnessMaturityUiLayerRow[];
  findings: readonly { severity: string; message: string }[];
  /** 필수 안내 문구(H8). */
  diagnosticDisclaimer: string;
}>;

const LAYER_LABEL: Record<string, string> = {
  prompt_assembly_preview: "H1 Prompt assembly preview",
  apply_readiness: "H2 Apply readiness",
  knowledge_activation: "H3 Knowledge activation",
  memory_runtime: "H4 Memory runtime",
  memory_stabilization: "H4.5 Memory stabilization",
  execution_routing: "H5 Execution routing",
  execution_safety: "H5.5 Execution safety",
  review_security: "H6 Review / security",
  issue_planning: "H6.5 Issue planning",
  message_explainability: "H7 Message explainability",
};

const STATUS_LABEL: Record<string, string> = {
  missing: "누락",
  partial: "부분",
  ready_read_only: "읽기 전용 준비",
  ready_for_controlled_trial: "통제 시험 후보",
};

const EXPOSURE_LABEL: Record<string, string> = {
  internal_only: "내부 전용",
  operator_visible: "운영자 표시",
  user_visible_summary: "사용자 요약",
};

const RELEASE_LEVEL_LABEL: Record<string, string> = {
  not_ready: "미준비",
  observe_more: "추가 관찰",
  candidate_for_manual_review: "수동 검토 후보",
};

export function buildHarnessMaturityUiViewModel(
  baseline: HarnessMaturityBaselineReport | null | undefined,
  releaseGate: HarnessReleaseGateReadinessReport | null | undefined
): HarnessMaturityUiViewModel {
  const disclaimer =
    "이 정보는 실제 실행 전환 허가가 아니라, 현재 Harness가 어느 수준까지 관측 가능한지 보여주는 진단 정보입니다.";

  if (!baseline || !releaseGate) {
    return {
      hasData: false,
      overallLabel: "—",
      countsLabel: "",
      userVisibleSummaryLabel: "",
      controlledTrialLabel: "",
      releaseGateLevelLabel: "—",
      releaseGateBlockers: [],
      releaseGateRecommendations: [],
      forbiddenFlags: [],
      layerRows: [],
      findings: [],
      diagnosticDisclaimer: disclaimer,
    };
  }

  const layerRows: HarnessMaturityUiLayerRow[] = baseline.layers.map((l) => ({
    layerLabel: LAYER_LABEL[l.layer] ?? l.layer,
    statusLabel: STATUS_LABEL[l.status] ?? l.status,
    exposureLabel: EXPOSURE_LABEL[l.exposureLevel] ?? l.exposureLevel,
  }));

  return {
    hasData: true,
    overallLabel: STATUS_LABEL[baseline.overallStatus] ?? baseline.overallStatus,
    countsLabel: `준비 ${baseline.readyReadOnlyCount} · 부분 ${baseline.partialCount} · 누락 ${baseline.missingCount}`,
    userVisibleSummaryLabel: baseline.userVisibleSummaryReady ? "가능" : "불가",
    controlledTrialLabel: baseline.controlledTrialReady ? "충족" : "미충족",
    releaseGateLevelLabel: RELEASE_LEVEL_LABEL[releaseGate.readinessLevel] ?? releaseGate.readinessLevel,
    releaseGateBlockers: releaseGate.blockers,
    releaseGateRecommendations: releaseGate.recommendations,
    forbiddenFlags: [
      { label: "actualPromptAssembly", value: String(releaseGate.actualPromptAssemblyAllowed) },
      { label: "actualRetrievalOrchestration", value: String(releaseGate.actualRetrievalOrchestrationAllowed) },
      { label: "actualProviderRouting", value: String(releaseGate.actualProviderRoutingAllowed) },
      { label: "actualBlocking", value: String(releaseGate.actualBlockingAllowed) },
    ],
    layerRows,
    findings: baseline.findings.map((f) => ({ severity: f.severity, message: f.message })),
    diagnosticDisclaimer: disclaimer,
  };
}
