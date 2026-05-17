import { describe, expect, it } from "vitest";

import { detectRuntimePilotExecutionReadinessViolations } from "@/lib/harness/runtimePilotExecutionReadiness/detectRuntimePilotExecutionReadinessViolations";
import { verifyRuntimePilotExecutionReadiness } from "@/lib/harness/runtimePilotExecutionReadiness/verifyRuntimePilotExecutionReadiness";
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

  it("pilot_execution_readiness_metadata_ready + verified + aligned yields final gate ready_metadata when aligned", () => {
    const semantic = buildFullSemanticForPilotExecutionReadiness();
    if (
      semantic.runtimePilotExecutionReadinessSummary.readinessStatus ===
        "pilot_execution_readiness_metadata_ready" &&
      semantic.runtimePilotExecutionReadinessSummary.readinessMode === "metadata_only" &&
      semantic.runtimePilotExecutionReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimePilotExecutionReadinessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimePilotExecutionReadinessViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimePilotExecutionReadinessViolationReport.proofViolations.length === 0 &&
      semantic.runtimePilotExecutionReadinessViolationReport.forbiddenProofViolations.length === 0
    ) {
      expect(semantic.runtimePilotExecutionReadinessFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimePilotExecutionReadinessFinalSafetyGate.h45EntryReadiness).toBe("ready_metadata");
    }
  });

  it("watch readiness yields final gate watch when execution verification is not failed", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning(buildPilotExecutionReadinessWatchScenarioPatches(base));
    expect(execution.runtimePilotExecutionReadinessSummary.readinessStatus).toBe("watch");
    const execVerification = execution.runtimePilotExecutionReadinessVerificationReport.verificationStatus;
    if (execVerification === "failed") {
      expect(execution.runtimePilotExecutionReadinessFinalSafetyGate.finalGateStatus).toBe("blocked");
    } else {
      expect(execution.runtimePilotExecutionReadinessFinalSafetyGate.finalGateStatus).toBe("watch");
    }
  });

  it("blocked readiness yields final gate blocked", () => {
    const base = buildPilotExecutionReadinessBaseReports();
    const execution = buildPilotExecutionReadinessPlanning({
      runtimeLimitedPilotReadinessReviewFinalSafetyGate: {
        ...base.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
        finalGateStatus: "blocked",
        h44EntryReadiness: "blocked",
      },
    });
    expect(execution.runtimePilotExecutionReadinessFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("detectRuntimePilotExecutionReadinessViolations flags pilotActivated true", () => {
    const summary = buildFullSemanticForPilotExecutionReadiness().runtimePilotExecutionReadinessSummary;
    const noExecutionProof = {
      ...buildRuntimeFinalPilotNoExecutionProof(),
      pilotActivated: true,
    } as import("@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessTypes").RuntimeFinalPilotNoExecutionProof;
    const forbiddenProof = buildRuntimeFinalPilotExecutionForbiddenProof();
    const violation = detectRuntimePilotExecutionReadinessViolations({
      summary,
      noExecutionProof,
      forbiddenProof,
    });
    expect(violation.proofViolations.some((v) => v.includes("pilotActivated"))).toBe(true);
  });

  it("finalPilotExecutionForbiddenProof incomplete yields verification failed", () => {
    const execution = buildPilotExecutionReadinessPlanning();
    const forbiddenProof = {
      ...buildRuntimeFinalPilotExecutionForbiddenProof(),
      actualPilotActivationForbidden: false,
    } as import("@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessTypes").RuntimeFinalPilotExecutionForbiddenProof;
    const violation = detectRuntimePilotExecutionReadinessViolations({
      summary: execution.runtimePilotExecutionReadinessSummary,
      noExecutionProof: execution.runtimeFinalPilotNoExecutionProof,
      forbiddenProof,
    });
    const verification = verifyRuntimePilotExecutionReadiness({
      summary: execution.runtimePilotExecutionReadinessSummary,
      boundary: execution.runtimePilotExecutionReadinessBoundary,
      inputEnvelope: execution.runtimePilotExecutionReadinessInputEnvelope,
      outputEnvelope: execution.runtimePilotExecutionReadinessOutputEnvelope,
      noExecutionProof: execution.runtimeFinalPilotNoExecutionProof,
      forbiddenProof,
      checklist: execution.runtimePilotExecutionReadinessChecklist,
      blockerReport: execution.runtimePilotExecutionReadinessBlockerReport,
    });
    expect(violation.forbiddenProofViolations.length).toBeGreaterThan(0);
    expect(verification.verificationStatus).toBe("failed");
  });

  it("serializer exposes 12 H44/H44.5 keys without rebuilding", () => {
    const semantic = buildFullSemanticForPilotExecutionReadiness();
    const bundle = serializeRuntimePilotExecutionReadinessDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "runtimeFinalPilotExecutionForbiddenProof",
        "runtimeFinalPilotNoExecutionProof",
        "runtimePilotExecutionReadinessAlignmentReport",
        "runtimePilotExecutionReadinessBlockerReport",
        "runtimePilotExecutionReadinessBoundary",
        "runtimePilotExecutionReadinessChecklist",
        "runtimePilotExecutionReadinessFinalSafetyGate",
        "runtimePilotExecutionReadinessInputEnvelope",
        "runtimePilotExecutionReadinessOutputEnvelope",
        "runtimePilotExecutionReadinessSummary",
        "runtimePilotExecutionReadinessVerificationReport",
        "runtimePilotExecutionReadinessViolationReport",
      ].sort()
    );
    expect(bundle.runtimePilotExecutionReadinessSummary.readinessStatus).toBe(
      semantic.runtimePilotExecutionReadinessSummary.readinessStatus
    );
  });
});
