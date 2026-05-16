import { describe, expect, it } from "vitest";

import { buildRuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationPlanningReports";
import { buildRuntimePilotSkeletonPlanningReports } from "@/lib/harness/runtimePilotSkeleton/buildRuntimePilotSkeletonPlanningReports";
import { serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotSkeleton/serializeRuntimePilotSkeletonDiagnosticBundle";
import { buildRuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  stripRuntimePilotActivationLayer,
  stripRuntimePilotSkeletonLayer,
} from "../runtimePlanningReportStrip";
import { evaluateHarnessMaturityBaseline } from "@/lib/harness/maturity/evaluateHarnessMaturityBaseline";
import { evaluateHarnessReleaseGateReadiness } from "@/lib/harness/maturity/evaluateHarnessReleaseGateReadiness";
import { emptyHarnessPromptApplyReadinessReport } from "@/lib/harness/promptAssembly/harnessPromptApplyReadinessTypes";
import { emptyRecentMemoryRuntimeSummary } from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import { normalizeRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/normalizeRuntimePlanningContext";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";

function buildFullSemantic() {
  const maturityBaseline = evaluateHarnessMaturityBaseline({
    overlayExtract: null,
    harnessPromptApplyReadinessReport: emptyHarnessPromptApplyReadinessReport(),
    recentMemoryRuntimeSummary: emptyRecentMemoryRuntimeSummary(),
    messageExplainabilityAvailable: true,
  });
  const ctx = normalizeRuntimePlanningContext({
    overlay: null,
    maturityBaseline,
    releaseGate: evaluateHarnessReleaseGateReadiness(maturityBaseline),
    messageExplainabilityAvailable: true,
    overlayWarningCount: 0,
  });
  const dep = buildRuntimeDependencyPlanningReports(ctx);
  const crit = buildRuntimeCriticalityPlanningReports(ctx, dep);
  const trace = buildRuntimeTraceabilityPlanningReports(ctx, dep, crit);
  const reasoning = buildRuntimeReasoningPlanningReports(dep, crit, trace);
  return buildRuntimeSemanticPlanningReports(reasoning);
}

describe("H28 runtime pilot skeleton & dry-run runner contract", () => {
  it("full semantic includes pilot skeleton with all actual runner flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimePilotSkeletonSummary.mode).toBe("runtime_pilot_skeleton_summary");
    expect(semantic.runtimePilotSkeletonSummary.actualIsolatedRunnerExecutionEnabled).toBe(false);
    expect(semantic.runtimePilotSkeletonSummary.actualDryRunRunnerExecutionEnabled).toBe(false);
    expect(semantic.runtimeDryRunRunnerContract.mode).toBe("runtime_dry_run_runner_contract");
    expect(semantic.runtimeDryRunRunnerContract.actualDryRunRunnerExecutionEnabled).toBe(false);
    expect(semantic.runtimePilotRunnerSafetyGuard.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimePilotRunnerSafetyGuard.actualPromptMutationForbidden).toBe(true);
  });

  it("ready final gate + verified activation can yield skeleton_metadata_ready", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimePilotActivationFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimePilotActivationFinalSafetyGate.h28EntryReadiness === "ready_metadata" &&
      semantic.runtimePilotActivationReadinessVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimePilotActivationBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimePilotSkeletonBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimePilotSkeletonSummary.skeletonReadiness).toBe("skeleton_metadata_ready");
      expect(semantic.runtimePilotSkeletonSummary.runnerMode).toBe("dry_run_contract_only");
    }
  });

  it("final gate watch yields skeleton watch", () => {
    const base = stripRuntimePilotSkeletonLayer(buildFullSemantic());
    const activation = buildRuntimePilotActivationPlanningReports(stripRuntimePilotActivationLayer(buildFullSemantic()));
    const skeleton = buildRuntimePilotSkeletonPlanningReports({
      ...base,
      ...activation,
      runtimePilotActivationFinalSafetyGate: {
        ...activation.runtimePilotActivationFinalSafetyGate,
        finalGateStatus: "watch",
        h28EntryReadiness: "watch",
      },
      runtimePilotActivationBoundaryViolationReport: {
        ...activation.runtimePilotActivationBoundaryViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: ["wording risk"],
      },
      runtimePilotActivationReadinessVerificationReport: {
        ...activation.runtimePilotActivationReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimePilotActivationBlockerReport: {
        ...activation.runtimePilotActivationBlockerReport,
        blockers: [],
      },
      runtimeAdapterSandboxPreflightSummary: {
        ...base.runtimeAdapterSandboxPreflightSummary,
        preflightReadiness: "ready_metadata",
      },
      runtimeOperatorApprovalSummary: {
        ...base.runtimeOperatorApprovalSummary,
        approvalReadiness: "ready_for_review_metadata",
      },
      runtimeRollbackReadinessSummary: {
        ...base.runtimeRollbackReadinessSummary,
        rollbackReadiness: "metadata_ready",
      },
      runtimeAuditReadinessSummary: {
        ...base.runtimeAuditReadinessSummary,
        auditReadiness: "sufficient_metadata",
      },
    });
    expect(skeleton.runtimePilotSkeletonSummary.skeletonReadiness).toBe("watch");
    expect(skeleton.runtimePilotSkeletonSummary.runnerMode).toBe("disabled");
  });

  it("final gate blocked yields skeleton blocked", () => {
    const activation = buildRuntimePilotActivationPlanningReports(
      stripRuntimePilotActivationLayer(buildFullSemantic())
    );
    const skeleton = buildRuntimePilotSkeletonPlanningReports({
      ...stripRuntimePilotSkeletonLayer(buildFullSemantic()),
      ...activation,
      runtimePilotActivationFinalSafetyGate: {
        ...activation.runtimePilotActivationFinalSafetyGate,
        finalGateStatus: "blocked",
        h28EntryReadiness: "blocked",
      },
      runtimePilotActivationBlockerReport: {
        ...activation.runtimePilotActivationBlockerReport,
        blockers: ["test blocker"],
      },
    });
    expect(skeleton.runtimePilotSkeletonSummary.skeletonReadiness).toBe("blocked");
    expect(skeleton.runtimePilotSkeletonSummary.runnerMode).toBe("blocked");
  });

  it("activation actual flag violation yields skeleton blocked", () => {
    const semantic = buildFullSemantic();
    if (semantic.runtimePilotActivationBoundaryViolationReport.actualFlagViolations.length > 0) {
      expect(semantic.runtimePilotSkeletonSummary.skeletonReadiness).toBe("blocked");
    }
  });

  it("dry-run runner contract includes forbidden operations", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimeDryRunRunnerContract.forbiddenRunnerOperations.length).toBeGreaterThan(0);
    expect(
      semantic.runtimeDryRunRunnerContract.forbiddenRunnerOperations.some((op) =>
        op.includes("actual isolated runner execution")
      )
    ).toBe(true);
    expect(semantic.runtimeDryRunRunnerContract.runnerNoExecutionGuarantees.length).toBeGreaterThan(0);
  });

  it("runner safety guard keeps execution paths forbidden", () => {
    const guard = buildFullSemantic().runtimePilotRunnerSafetyGuard;
    expect(guard.actualIsolatedRunnerExecutionEnabled).toBe(false);
    expect(guard.actualDryRunRunnerExecutionEnabled).toBe(false);
    expect(guard.actualExecutionForbidden).toBe(true);
    expect(guard.actualAdapterInvocationForbidden).toBe(true);
    expect(guard.guardRows.some((r) => r.includes("actualIsolatedRunnerExecutionEnabled:false"))).toBe(true);
  });

  it("serializer does not rebuild reports", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimePilotSkeletonSummary.mode).toBe("runtime_pilot_skeleton_summary");
    expect(ser.runtimeDryRunRunnerContract.mode).toBe("runtime_dry_run_runner_contract");
    expect(ser.runtimePilotRunnerInputEnvelope.mode).toBe("runtime_pilot_runner_input_envelope");
    expect(ser.runtimePilotRunnerOutputEnvelope.mode).toBe("runtime_pilot_runner_output_envelope");
    expect(ser.runtimePilotRunnerSafetyGuard.mode).toBe("runtime_pilot_runner_safety_guard");
    expect(ser.runtimePilotSkeletonBlockerReport.mode).toBe("runtime_pilot_skeleton_blocker_report");
  });

  it("stripRuntimePilotSkeletonLayer removes H28 fields only", () => {
    const semantic = buildFullSemantic();
    const stripped = stripRuntimePilotSkeletonLayer(semantic);
    expect("runtimePilotSkeletonSummary" in stripped).toBe(false);
    expect(stripped.runtimePilotActivationFinalSafetyGate.mode).toBe(
      "runtime_pilot_activation_final_safety_gate"
    );
  });
});
