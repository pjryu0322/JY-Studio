import { describe, expect, it } from "vitest";

import { evaluateRuntimePilotExecutionReadinessStatus } from "@/lib/harness/runtimePilotExecutionReadiness/buildRuntimePilotExecutionReadinessSummary";
import { buildRuntimeFinalPilotNoExecutionProof } from "@/lib/harness/runtimePilotExecutionReadiness/buildRuntimeFinalPilotNoExecutionProof";
import { buildRuntimeFinalPilotExecutionForbiddenProof } from "@/lib/harness/runtimePilotExecutionReadiness/buildRuntimeFinalPilotExecutionForbiddenProof";
import { serializeRuntimePilotExecutionReadinessDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotExecutionReadiness/serializeRuntimePilotExecutionReadinessDiagnosticBundle";
import {
  buildFullSemanticForPilotExecutionReadiness,
  buildPilotExecutionReadinessBaseReports,
  buildPilotExecutionReadinessPlanning,
  buildPilotExecutionReadinessWatchScenarioPatches,
} from "./runtimePilotExecutionReadinessTestFixtures";

describe("H44 pilot execution readiness", () => {
  it("full semantic includes H44 reports with pilot actual flags false", () => {
    const semantic = buildFullSemanticForPilotExecutionReadiness();
    expect(semantic.runtimePilotExecutionReadinessSummary.mode).toBe(
      "runtime_pilot_execution_readiness_summary"
    );
    expect(semantic.runtimePilotExecutionReadinessSummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimePilotExecutionReadinessSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimeFinalPilotNoExecutionProof.diagnosticOnly).toBe(true);
    expect(semantic.runtimeFinalPilotExecutionForbiddenProof.actualPilotActivationForbidden).toBe(true);
    expect(semantic.runtimePilotExecutionReadinessBoundary.boundarySourceLayer).toBe(
      "runtimeLimitedPilotReadinessReviewFinalSafetyGate"
    );
  });

  it("review final gate ready + verified + aligned yields pilot_execution_readiness_metadata_ready when aligned", () => {
    const semantic = buildFullSemanticForPilotExecutionReadiness();
    if (
      semantic.runtimeLimitedPilotReadinessReviewFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewFinalSafetyGate.h44EntryReadiness === "ready_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.proofViolations.length === 0 &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.forbiddenProofViolations.length === 0
    ) {
      expect(semantic.runtimePilotExecutionReadinessSummary.readinessStatus).toBe(
        "pilot_execution_readiness_metadata_ready"
      );
      expect(semantic.runtimePilotExecutionReadinessSummary.readinessMode).toBe("metadata_only");
    }
  });

  it("review final gate watch yields watch", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning(buildPilotExecutionReadinessWatchScenarioPatches(base));
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("watch");
    expect(execution.runtimePilotExecutionReadinessSummary.readinessMode).toBe("disabled");
  });

  it("review final gate blocked yields blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning({
      runtimeLimitedPilotReadinessReviewFinalSafetyGate: {
        ...base.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
        finalGateStatus: "blocked",
        h44EntryReadiness: "blocked",
      },
    });
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("blocked");
    expect(execution.runtimePilotExecutionReadinessSummary.readinessMode).toBe("blocked");
  });

  it("review verification failed yields blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning({
      runtimeLimitedPilotReadinessReviewVerificationReport: {
        ...base.runtimeLimitedPilotReadinessReviewVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("blocked");
  });

  it("review alignment failed yields blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning({
      runtimeLimitedPilotReadinessReviewAlignmentReport: {
        ...base.runtimeLimitedPilotReadinessReviewAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("blocked");
  });

  it("review actual flag violation yields blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning({
      runtimeLimitedPilotReadinessReviewViolationReport: {
        ...base.runtimeLimitedPilotReadinessReviewViolationReport,
        actualFlagViolations: ["runtimeLimitedPilotReadinessReviewSummary.actualPilotActivationEnabled must be false"],
      },
    });
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("blocked");
  });

  it("final pilot no-execution proof diagnosticOnly=false yields blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning();
    const noExecutionProof = { ...buildRuntimeFinalPilotNoExecutionProof(), diagnosticOnly: false as false };
    const forbiddenProof = buildRuntimeFinalPilotExecutionForbiddenProof();
    expect(
      evaluateRuntimePilotExecutionReadinessStatus({
        reports: base,
        blockerReport: execution.runtimePilotExecutionReadinessBlockerReport,
        noExecutionProof,
        forbiddenProof,
      })
    ).toBe("blocked");
  });

  it("serializer exposes 8 H44 keys without rebuilding", () => {
    const semantic = buildFullSemanticForPilotExecutionReadiness();
    const bundle = serializeRuntimePilotExecutionReadinessDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "runtimeFinalPilotExecutionForbiddenProof",
        "runtimeFinalPilotNoExecutionProof",
        "runtimePilotExecutionReadinessBlockerReport",
        "runtimePilotExecutionReadinessBoundary",
        "runtimePilotExecutionReadinessChecklist",
        "runtimePilotExecutionReadinessInputEnvelope",
        "runtimePilotExecutionReadinessOutputEnvelope",
        "runtimePilotExecutionReadinessSummary",
      ].sort()
    );
    expect(bundle.runtimePilotExecutionReadinessSummary.readinessStatus).toBe(
      semantic.runtimePilotExecutionReadinessSummary.readinessStatus
    );
  });
});
