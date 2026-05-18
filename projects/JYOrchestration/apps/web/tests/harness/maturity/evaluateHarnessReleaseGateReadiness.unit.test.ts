import { describe, expect, it } from "vitest";

import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import type {
  HarnessMaturityBaselineReport,
  HarnessMaturityLayer,
  HarnessMaturityLayerStatus,
} from "@/lib/harness/maturity/harnessMaturityTypes";
import { resolveHarnessExposureLevel } from "@/lib/harness/maturity/harnessExposurePolicy";

const LAYERS: readonly HarnessMaturityLayer[] = [
  "prompt_assembly_preview",
  "apply_readiness",
  "knowledge_activation",
  "memory_runtime",
  "memory_stabilization",
  "execution_routing",
  "execution_safety",
  "review_security",
  "issue_planning",
  "message_explainability",
];

function allReadyLayer(layer: HarnessMaturityLayer): HarnessMaturityLayerStatus {
  return {
    layer,
    status: "ready_read_only",
    exposureLevel: resolveHarnessExposureLevel(layer),
    evidenceCount: 1,
    missingSignals: [],
    warnings: [],
  };
}

describe("evaluateHarnessReleaseGateReadiness", () => {
  it("keeps all actual flags false", () => {
    const baseline = evaluateHarnessMaturityBaseline({ overlayExtract: null, messageExplainabilityAvailable: false });
    const r = evaluateHarnessReleaseGateReadiness(baseline);
    expect(r.actualPromptAssemblyAllowed).toBe(false);
    expect(r.actualRetrievalOrchestrationAllowed).toBe(false);
    expect(r.actualProviderRoutingAllowed).toBe(false);
    expect(r.actualBlockingAllowed).toBe(false);
  });

  it("is not_ready when missing layers exist", () => {
    const baseline = evaluateHarnessMaturityBaseline({ overlayExtract: null, messageExplainabilityAvailable: false });
    const r = evaluateHarnessReleaseGateReadiness(baseline);
    expect(r.readinessLevel).toBe("not_ready");
    expect(r.blockers.some((b) => b.startsWith("missing_layer:"))).toBe(true);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it("is candidate_for_manual_review when every layer is read-only ready", () => {
    const layers = LAYERS.map(allReadyLayer);
    const baseline: HarnessMaturityBaselineReport = {
      mode: "read_only_maturity_baseline",
      overallStatus: "ready_read_only",
      layers,
      readyReadOnlyCount: layers.length,
      partialCount: 0,
      missingCount: 0,
      userVisibleSummaryReady: true,
      controlledTrialReady: true,
      findings: [],
    };
    const r = evaluateHarnessReleaseGateReadiness(baseline);
    expect(r.readinessLevel).toBe("candidate_for_manual_review");
    expect(r.blockers.length).toBe(0);
  });
});
