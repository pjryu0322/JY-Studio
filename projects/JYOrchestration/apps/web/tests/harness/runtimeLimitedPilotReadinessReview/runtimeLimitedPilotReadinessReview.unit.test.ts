import { describe, expect, it } from "vitest";

import { detectRuntimeLimitedPilotReadinessReviewViolations } from "@/lib/harness/runtimeLimitedPilotReadinessReview/detectRuntimeLimitedPilotReadinessReviewViolations";
import { evaluateRuntimeLimitedPilotReadinessReviewStatus } from "@/lib/harness/runtimeLimitedPilotReadinessReview/buildRuntimeLimitedPilotReadinessReviewSummary";
import { buildRuntimePilotNoExecutionProof } from "@/lib/harness/runtimeLimitedPilotReadinessReview/buildRuntimePilotNoExecutionProof";
import { buildRuntimePilotExecutionForbiddenProof } from "@/lib/harness/runtimeLimitedPilotReadinessReview/buildRuntimePilotExecutionForbiddenProof";
import { detectRuntimePilotReadinessBlockers } from "@/lib/harness/runtimeLimitedPilotReadinessReview/detectRuntimePilotReadinessBlockers";
import { serializeRuntimeLimitedPilotReadinessReviewDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeLimitedPilotReadinessReview/serializeRuntimeLimitedPilotReadinessReviewDiagnosticBundle";
import {
  buildFullSemanticForLimitedPilotReadinessReview,
  buildLimitedPilotReadinessReviewBaseReports,
  buildLimitedPilotReadinessReviewPlanning,
  buildLimitedPilotReadinessWatchScenarioPatches,
} from "./runtimeLimitedPilotReadinessReviewTestFixtures";

describe("H43 limited pilot readiness review", () => {
  it("full semantic includes H43 reports with pilot actual flags false", () => {
    const semantic = buildFullSemanticForLimitedPilotReadinessReview();
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.mode).toBe(
      "runtime_limited_pilot_readiness_review_summary"
    );
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.actualIsolatedRunnerInvocationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotReadinessReviewSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimePilotNoExecutionProof.diagnosticOnly).toBe(true);
    expect(semantic.runtimePilotExecutionForbiddenProof.actualPilotActivationForbidden).toBe(true);
    expect(semantic.runtimePilotContractHardeningBoundary.boundarySourceLayer).toBe(
      "runtimeLimitedPilotBoundaryFinalSafetyGate"
    );
  });

  it("limited pilot boundary final gate ready + verified + aligned yields limited_pilot_readiness_metadata_ready when aligned", () => {
    const semantic = buildFullSemanticForLimitedPilotReadinessReview();
    if (
      semantic.runtimeLimitedPilotBoundaryFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeLimitedPilotBoundaryFinalSafetyGate.h43EntryReadiness === "ready_metadata" &&
      semantic.runtimeLimitedPilotBoundaryVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeLimitedPilotBoundaryAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeLimitedPilotBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeLimitedPilotBoundaryViolationReport.policyViolations.length === 0
    ) {
      expect(semantic.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe(
        "limited_pilot_readiness_metadata_ready"
      );
      expect(semantic.runtimeLimitedPilotReadinessReviewSummary.reviewMode).toBe("metadata_only");
    }
  });

  it("limited pilot boundary final gate watch yields watch", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning(buildLimitedPilotReadinessWatchScenarioPatches(base));
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe("watch");
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewMode).toBe("disabled");
  });

  it("limited pilot boundary final gate blocked yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning({
      runtimeLimitedPilotBoundaryFinalSafetyGate: {
        ...base.runtimeLimitedPilotBoundaryFinalSafetyGate,
        finalGateStatus: "blocked",
        h43EntryReadiness: "blocked",
      },
    });
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe("blocked");
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewMode).toBe("blocked");
  });

  it("limited pilot boundary verification failed yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning({
      runtimeLimitedPilotBoundaryVerificationReport: {
        ...base.runtimeLimitedPilotBoundaryVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe("blocked");
  });

  it("limited pilot boundary alignment failed yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning({
      runtimeLimitedPilotBoundaryAlignmentReport: {
        ...base.runtimeLimitedPilotBoundaryAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe("blocked");
  });

  it("limited pilot boundary policy violation yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning({
      runtimeLimitedPilotBoundaryViolationReport: {
        ...base.runtimeLimitedPilotBoundaryViolationReport,
        policyViolations: ["runtimeLimitedPilotBoundaryPolicy.actualPilotActivationForbidden must be true"],
      },
    });
    expect(review.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe("blocked");
  });

  it("pilot no-execution proof diagnosticOnly false yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const status = evaluateRuntimeLimitedPilotReadinessReviewStatus({
      reports: base,
      blockerReport: detectRuntimePilotReadinessBlockers(base),
      noExecutionProof: { ...buildRuntimePilotNoExecutionProof(), diagnosticOnly: false as true },
      forbiddenProof: buildRuntimePilotExecutionForbiddenProof(),
    });
    expect(status).toBe("blocked");
  });

  it("pilot execution-forbidden proof incomplete yields blocked", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const status = evaluateRuntimeLimitedPilotReadinessReviewStatus({
      reports: base,
      blockerReport: detectRuntimePilotReadinessBlockers(base),
      noExecutionProof: buildRuntimePilotNoExecutionProof(),
      forbiddenProof: {
        ...buildRuntimePilotExecutionForbiddenProof(),
        actualPilotActivationForbidden: false as true,
      },
    });
    expect(status).toBe("blocked");
  });

  it("serializer exposes twelve H43/H43.5 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForLimitedPilotReadinessReview();
    const serialized = serializeRuntimeLimitedPilotReadinessReviewDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(serialized)).toHaveLength(12);
    expect(serialized.runtimeLimitedPilotReadinessReviewSummary.reviewStatus).toBe(
      semantic.runtimeLimitedPilotReadinessReviewSummary.reviewStatus
    );
    expect(serialized.runtimePilotContractHardeningBoundary.boundaryTargetLayer).toBe(
      "pilotContractHardeningBoundary"
    );
    expect(serialized.runtimeLimitedPilotReadinessReviewFinalSafetyGate).toBeDefined();
    expect(serialized.runtimeLimitedPilotReadinessReviewViolationReport).toBeDefined();
  });

  it("ready review with verified alignment yields final gate ready_metadata when upstream aligned", () => {
    const semantic = buildFullSemanticForLimitedPilotReadinessReview();
    if (
      semantic.runtimeLimitedPilotReadinessReviewSummary.reviewStatus ===
        "limited_pilot_readiness_metadata_ready" &&
      semantic.runtimeLimitedPilotReadinessReviewVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.proofViolations.length === 0 &&
      semantic.runtimeLimitedPilotReadinessReviewViolationReport.forbiddenProofViolations.length === 0
    ) {
      expect(semantic.runtimeLimitedPilotReadinessReviewFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeLimitedPilotReadinessReviewFinalSafetyGate.h44EntryReadiness).toBe("ready_metadata");
    }
  });

  it("readiness review verification failed yields blocked final gate", () => {
    const base = buildLimitedPilotReadinessReviewBaseReports();
    const review = buildLimitedPilotReadinessReviewPlanning({
      runtimeLimitedPilotReadinessReviewVerificationReport: {
        ...base.runtimeLimitedPilotReadinessReviewVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(review.runtimeLimitedPilotReadinessReviewFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("summary actual flag violation yields policy violation report", () => {
    const semantic = buildFullSemanticForLimitedPilotReadinessReview();
    const violation = detectRuntimeLimitedPilotReadinessReviewViolations({
      summary: {
        ...semantic.runtimeLimitedPilotReadinessReviewSummary,
        actualPilotActivationEnabled: true as false,
      },
      noExecutionProof: semantic.runtimePilotNoExecutionProof,
      forbiddenProof: semantic.runtimePilotExecutionForbiddenProof,
    });
    expect(violation.actualFlagViolations.length).toBeGreaterThan(0);
  });
});
