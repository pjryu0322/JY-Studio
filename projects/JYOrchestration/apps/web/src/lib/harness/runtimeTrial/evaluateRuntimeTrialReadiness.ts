/**
 * H10 — 통제 런타임 시험 **준비도** 평가(read-only).
 */

import type { HarnessMaturityBaselineReport, HarnessReleaseGateReadinessReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { RuntimeTrialReadinessLevel, RuntimeTrialReadinessReport } from "./runtimeTrialTypes";
import { runtimeTrialHarnessLayerLabelKo } from "./runtimeTrialLayerLabels";

export function evaluateRuntimeTrialReadiness(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly releaseGate: HarnessReleaseGateReadinessReport;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
}): RuntimeTrialReadinessReport {
  const pressure = evaluateResourcePressure(input.extract);
  const unstable = input.baseline.layers.filter((l) => l.status === "missing" || l.status === "partial");
  const unstableHarnessLayers = unstable.map((l) => l.layer);
  const unstableLayerLabelsKo = unstableHarnessLayers.map(runtimeTrialHarnessLayerLabelKo);

  const notes: string[] = [...input.releaseGate.recommendations];
  if (pressure.pressureSeverity === "critical") {
    notes.unshift("자원 압력이 매우 높습니다. 문서화된 통제 시험 전 운영 완화를 권장합니다.");
  }
  if (unstableHarnessLayers.length > 0) {
    notes.push(`불안정·미완 계층 ${unstableHarnessLayers.length}개: ${unstableLayerLabelsKo.slice(0, 5).join(", ")}${unstableHarnessLayers.length > 5 ? " …" : ""}`);
  }

  let readinessLevel: RuntimeTrialReadinessLevel;
  if (input.releaseGate.readinessLevel === "not_ready" || input.baseline.missingCount > 0) {
    readinessLevel = "not_prepared";
  } else if (
    pressure.pressureSeverity === "critical" ||
    unstableHarnessLayers.length > 4 ||
    !input.baseline.controlledTrialReady
  ) {
    readinessLevel = "preparation_partial";
  } else if (
    input.releaseGate.readinessLevel === "candidate_for_manual_review" &&
    input.baseline.controlledTrialReady &&
    (pressure.pressureSeverity === "stable" || pressure.pressureSeverity === "elevated")
  ) {
    readinessLevel = "ready_for_documented_trial";
  } else {
    readinessLevel = "preparation_partial";
  }

  return {
    mode: "controlled_runtime_trial_preparation",
    readinessLevel,
    actualRuntimeOrchestrationEnabled: false,
    actualProviderRoutingEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualTokenEnforcementEnabled: false,
    actualContextPruningEnabled: false,
    actualRetrievalOrchestrationEnabled: false,
    unstableHarnessLayers,
    unstableLayerLabelsKo,
    preparationNotes: notes.slice(0, 8),
  };
}

/** 진단 API용 직렬화(breaking change 없음). */
export function serializeRuntimeTrialReadinessForDiagnostic(
  report: RuntimeTrialReadinessReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    readinessLevel: report.readinessLevel,
    actualRuntimeOrchestrationEnabled: report.actualRuntimeOrchestrationEnabled,
    actualProviderRoutingEnabled: report.actualProviderRoutingEnabled,
    actualExecutionRoutingEnabled: report.actualExecutionRoutingEnabled,
    actualTokenEnforcementEnabled: report.actualTokenEnforcementEnabled,
    actualContextPruningEnabled: report.actualContextPruningEnabled,
    actualRetrievalOrchestrationEnabled: report.actualRetrievalOrchestrationEnabled,
    unstableHarnessLayers: [...report.unstableHarnessLayers],
    unstableLayerLabelsKo: [...report.unstableLayerLabelsKo],
    preparationNotes: [...report.preparationNotes],
  };
}
