/**
 * H8.5 — 운영자용 **런타임 한눈 요약** ViewModel(read-only).
 */

import { evaluateExecutionRoutingSafety } from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";
import type {
  HarnessMaturityBaselineReport,
  HarnessReleaseGateReadinessReport,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { OverlayUiSummaryHeaderVM } from "@/lib/overlay-ui/overlayUiAdapter";
import { buildExecutionRoutingSafetyVM } from "@/lib/overlay-ui/executionRoutingUiAdapter";

const MATURITY: Record<string, string> = {
  missing: "누락",
  partial: "부분",
  ready_read_only: "읽기 전용 준비",
  ready_for_controlled_trial: "통제 시험 후보",
};

const GATE: Record<string, string> = {
  not_ready: "미준비",
  observe_more: "추가 관찰",
  candidate_for_manual_review: "수동 검토 후보",
};

export type OverlayOperatorRuntimeSummaryVM = Readonly<{
  maturityOverallLabel: string;
  releaseGateLabel: string;
  warningCountLabel: string;
  executionSafetyStatusLabel: string;
  reviewSecurityLabel: string;
  explainabilitySurfaceLabel: string;
}>;

export function buildOverlayOperatorRuntimeSummaryVm(input: {
  readonly overlay: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly summary: OverlayUiSummaryHeaderVM;
  readonly maturityBaseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly messageExplainabilityAvailable: boolean;
}): OverlayOperatorRuntimeSummaryVM {
  const safetyReport =
    input.overlay?.executionRoutingSafetyReport ??
    (input.overlay?.executionRoutingPlan
      ? evaluateExecutionRoutingSafety({ plan: input.overlay.executionRoutingPlan })
      : null);
  const safetyVm = buildExecutionRoutingSafetyVM(safetyReport);

  const hasReview = Boolean(input.overlay?.reviewSecurityHarnessPlan);
  const reviewSecurityLabel = hasReview ? "체크리스트 기록됨" : "미기록";

  return {
    maturityOverallLabel: MATURITY[input.maturityBaseline.overallStatus] ?? input.maturityBaseline.overallStatus,
    releaseGateLabel: GATE[input.releaseGate.readinessLevel] ?? input.releaseGate.readinessLevel,
    warningCountLabel: `${input.summary.warningCount}건`,
    executionSafetyStatusLabel: safetyVm.statusLabel,
    reviewSecurityLabel,
    explainabilitySurfaceLabel: input.messageExplainabilityAvailable
      ? "SingleChat AI 판단 보기 연결됨"
      : "SingleChat AI 판단 보기 미연결",
  };
}
