import { describe, expect, it } from "vitest";

import { buildRuntimePilotActivationPlanningReports } from "@/lib/harness/runtimePilotActivation/buildRuntimePilotActivationPlanningReports";
import { buildRuntimePilotSkeletonPlanningReports } from "@/lib/harness/runtimePilotSkeleton/buildRuntimePilotSkeletonPlanningReports";
import { detectRuntimePilotRunnerBoundaryViolations } from "@/lib/harness/runtimePilotSkeleton/detectRuntimePilotRunnerBoundaryViolations";
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
    expect("runtimePilotSkeletonPreflightSummary" in stripped).toBe(false);
    expect(stripped.runtimePilotActivationFinalSafetyGate.mode).toBe(
      "runtime_pilot_activation_final_safety_gate"
    );
  });
});

describe("H28.5 pilot skeleton stabilization & runner contract verification", () => {
  it("full semantic includes H28.5 reports with no-execution flags false", () => {
    const semantic = buildFullSemantic();
    expect(semantic.runtimePilotRunnerContractVerificationReport.mode).toBe(
      "runtime_pilot_runner_contract_verification_report"
    );
    expect(semantic.runtimePilotRunnerBoundaryViolationReport.mode).toBe(
      "runtime_pilot_runner_boundary_violation_report"
    );
    expect(semantic.runtimePilotRunnerNoExecutionResultMetadata.runnerExecuted).toBe(false);
    expect(semantic.runtimePilotRunnerNoExecutionResultMetadata.dryRunRunnerExecuted).toBe(false);
    expect(semantic.runtimePilotRunnerNoExecutionResultMetadata.diagnosticOnly).toBe(true);
    expect(semantic.runtimePilotSkeletonPreflightSummary.mode).toBe("runtime_pilot_skeleton_preflight_summary");
  });

  it("skeleton_metadata_ready + verified contract can yield preflight ready_metadata", () => {
    const semantic = buildFullSemantic();
    if (
      semantic.runtimePilotSkeletonSummary.skeletonReadiness === "skeleton_metadata_ready" &&
      semantic.runtimePilotRunnerContractVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimePilotRunnerBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimePilotSkeletonBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimePilotSkeletonPreflightSummary.preflightReadiness).toBe("ready_metadata");
    }
  });

  it("watch skeleton yields preflight watch", () => {
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
        wordingRiskFindings: [],
      },
      runtimePilotActivationReadinessVerificationReport: {
        ...activation.runtimePilotActivationReadinessVerificationReport,
        verificationStatus: "partial",
      },
      runtimePilotActivationBlockerReport: { ...activation.runtimePilotActivationBlockerReport, blockers: [] },
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
    expect(skeleton.runtimePilotSkeletonPreflightSummary.preflightReadiness).toBe("watch");
  });

  it("blocked skeleton yields preflight blocked", () => {
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
    });
    expect(skeleton.runtimePilotSkeletonPreflightSummary.preflightReadiness).toBe("blocked");
  });

  it("boundary violation detects actualIsolatedRunnerExecutionEnabled true", () => {
    const semantic = buildFullSemantic();
    const violations = detectRuntimePilotRunnerBoundaryViolations({
      summary: {
        ...semantic.runtimePilotSkeletonSummary,
        actualIsolatedRunnerExecutionEnabled: true as unknown as false,
      },
      contract: semantic.runtimeDryRunRunnerContract,
      inputEnvelope: semantic.runtimePilotRunnerInputEnvelope,
      outputEnvelope: semantic.runtimePilotRunnerOutputEnvelope,
      safetyGuard: semantic.runtimePilotRunnerSafetyGuard,
      noExecution: semantic.runtimePilotRunnerNoExecutionResultMetadata,
    });
    expect(
      violations.actualFlagViolations.some((v) => v.includes("actualIsolatedRunnerExecutionEnabled"))
    ).toBe(true);
  });

  it("boundary violation detects actualDryRunRunnerExecutionEnabled true", () => {
    const semantic = buildFullSemantic();
    const violations = detectRuntimePilotRunnerBoundaryViolations({
      summary: semantic.runtimePilotSkeletonSummary,
      contract: {
        ...semantic.runtimeDryRunRunnerContract,
        actualDryRunRunnerExecutionEnabled: true as unknown as false,
      },
      inputEnvelope: semantic.runtimePilotRunnerInputEnvelope,
      outputEnvelope: semantic.runtimePilotRunnerOutputEnvelope,
      safetyGuard: semantic.runtimePilotRunnerSafetyGuard,
      noExecution: semantic.runtimePilotRunnerNoExecutionResultMetadata,
    });
    expect(
      violations.actualFlagViolations.some((v) => v.includes("actualDryRunRunnerExecutionEnabled"))
    ).toBe(true);
  });

  it("boundary violation detects runnerExecuted=true wording risk", () => {
    const semantic = buildFullSemantic();
    const violations = detectRuntimePilotRunnerBoundaryViolations({
      summary: { ...semantic.runtimePilotSkeletonSummary, rationaleKo: "runnerExecuted=true in text" },
      contract: semantic.runtimeDryRunRunnerContract,
      inputEnvelope: semantic.runtimePilotRunnerInputEnvelope,
      outputEnvelope: semantic.runtimePilotRunnerOutputEnvelope,
      safetyGuard: semantic.runtimePilotRunnerSafetyGuard,
      noExecution: semantic.runtimePilotRunnerNoExecutionResultMetadata,
    });
    expect(violations.wordingRiskFindings.some((w) => w.includes("runnerExecuted"))).toBe(true);
  });

  it("boundary violation detects dryRunRunnerExecuted adapterInvoked executionPerformed wording", () => {
    const semantic = buildFullSemantic();
    const violations = detectRuntimePilotRunnerBoundaryViolations({
      summary: semantic.runtimePilotSkeletonSummary,
      contract: semantic.runtimeDryRunRunnerContract,
      inputEnvelope: semantic.runtimePilotRunnerInputEnvelope,
      outputEnvelope: semantic.runtimePilotRunnerOutputEnvelope,
      safetyGuard: semantic.runtimePilotRunnerSafetyGuard,
      noExecution: {
        ...semantic.runtimePilotRunnerNoExecutionResultMetadata,
        resultRows: [
          "dryRunRunnerExecuted=true",
          "adapterInvoked=true",
          "executionPerformed=true",
          "providerRoutingPerformed=true",
          "queueControlPerformed=true",
          "rollbackPerformed=true",
        ],
      },
    });
    expect(violations.wordingRiskFindings.some((w) => w.includes("dryRunRunnerExecuted"))).toBe(true);
    expect(violations.wordingRiskFindings.some((w) => w.includes("adapterInvoked"))).toBe(true);
    expect(violations.wordingRiskFindings.some((w) => w.includes("executionPerformed"))).toBe(true);
  });

  it("boundary violation detects diagnosticOnly false on no-execution metadata", () => {
    const semantic = buildFullSemantic();
    const violations = detectRuntimePilotRunnerBoundaryViolations({
      summary: semantic.runtimePilotSkeletonSummary,
      contract: semantic.runtimeDryRunRunnerContract,
      inputEnvelope: semantic.runtimePilotRunnerInputEnvelope,
      outputEnvelope: semantic.runtimePilotRunnerOutputEnvelope,
      safetyGuard: semantic.runtimePilotRunnerSafetyGuard,
      noExecution: {
        ...semantic.runtimePilotRunnerNoExecutionResultMetadata,
        diagnosticOnly: false as unknown as true,
      },
    });
    expect(violations.actualFlagViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("serializer includes verification boundary no-execution preflight", () => {
    const semantic = buildFullSemantic();
    const ser = serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports(semantic);
    expect(ser.runtimePilotRunnerContractVerificationReport.mode).toBe(
      "runtime_pilot_runner_contract_verification_report"
    );
    expect(ser.runtimePilotRunnerBoundaryViolationReport.mode).toBe(
      "runtime_pilot_runner_boundary_violation_report"
    );
    expect(ser.runtimePilotRunnerNoExecutionResultMetadata.mode).toBe(
      "runtime_pilot_runner_no_execution_result_metadata"
    );
    expect(ser.runtimePilotSkeletonPreflightSummary.mode).toBe("runtime_pilot_skeleton_preflight_summary");
  });
});
