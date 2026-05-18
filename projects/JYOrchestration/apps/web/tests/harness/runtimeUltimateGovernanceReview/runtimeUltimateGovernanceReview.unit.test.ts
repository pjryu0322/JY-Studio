import { describe, expect, it } from "vitest";

import { buildRuntimeUltimateNoEnforcementProof } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeUltimateNoEnforcementProof";
import {
  buildRuntimeOrchestrationForbiddenProof,
  isRuntimeOrchestrationForbiddenProofComplete,
} from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeOrchestrationForbiddenProof";
import { buildRuntimeUltimateGovernanceReviewSummary } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeUltimateGovernanceReviewSummary";
import { serializeRuntimeUltimateGovernanceReviewDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeUltimateGovernanceReview/serializeRuntimeUltimateGovernanceReviewDiagnosticBundle";
import { stripRuntimeUltimateGovernanceReviewLayer } from "../runtimePlanningReportStrip";
import {
  buildFullSemanticForUltimateGovernanceReview,
  buildUltimateGovernanceReviewBaseReports,
  buildUltimateGovernanceReviewPlanning,
} from "./runtimeUltimateGovernanceReviewTestFixtures";

describe("H40 ultimate governance review", () => {
  it("full semantic includes H40 reports with all actual flags false", () => {
    const semantic = buildFullSemanticForUltimateGovernanceReview();
    expect(semantic.runtimeUltimateGovernanceReviewSummary.mode).toBe(
      "runtime_ultimate_governance_review_summary"
    );
    expect(semantic.runtimeUltimateGovernanceReviewSummary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(semantic.runtimeUltimateGovernanceReviewSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeUltimateGovernanceReviewSummary.actualExecutionBlockingEnabled).toBe(false);
    expect(semantic.runtimeUltimateGovernanceReviewSummary.actualMergeBlockingEnabled).toBe(false);
    expect(semantic.runtimeUltimateNoEnforcementProof.diagnosticOnly).toBe(true);
    expect(semantic.runtimeOrchestrationForbiddenProof.actualOrchestrationForbidden).toBe(true);
    expect(semantic.runtimeFinalOrchestrationReadinessBoundary.boundaryTargetLayer).toBe(
      "finalOrchestrationReadinessBoundary"
    );
  });

  it("final gate ready + verified + aligned yields ultimate_governance_metadata_ready when aligned", () => {
    const semantic = buildFullSemanticForUltimateGovernanceReview();
    if (
      semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeFinalReleaseGovernanceGateVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeFinalReleaseGovernanceGateAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeFinalReleaseGovernanceGateViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeUltimateGovernanceReviewSummary.reviewStatus).toBe(
        "ultimate_governance_metadata_ready"
      );
    }
  });

  it("final gate watch yields review watch", () => {
    const base = buildUltimateGovernanceReviewBaseReports();
    const review = buildUltimateGovernanceReviewPlanning({
      runtimeFinalReleaseGovernanceGateFinalSafetyGate: {
        ...base.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
        finalGateStatus: "watch",
        h40EntryReadiness: "watch",
      },
      runtimeFinalReleaseGovernanceGateVerificationReport: {
        ...base.runtimeFinalReleaseGovernanceGateVerificationReport,
        verificationStatus: "partial",
      },
    });
    expect(review.runtimeUltimateGovernanceReviewSummary.reviewStatus).toBe("watch");
  });

  it("final gate blocked yields review blocked", () => {
    const base = buildUltimateGovernanceReviewBaseReports();
    const review = buildUltimateGovernanceReviewPlanning({
      runtimeFinalReleaseGovernanceGateFinalSafetyGate: {
        ...base.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
        finalGateStatus: "blocked",
        h40EntryReadiness: "blocked",
      },
      runtimeFinalReleaseGovernanceGateVerificationReport: {
        ...base.runtimeFinalReleaseGovernanceGateVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(review.runtimeUltimateGovernanceReviewSummary.reviewStatus).toBe("blocked");
  });

  it("ultimate no-enforcement proof diagnosticOnly false yields blocked", () => {
    const base = buildUltimateGovernanceReviewBaseReports();
    const noEnforcementProof = { ...buildRuntimeUltimateNoEnforcementProof(), diagnosticOnly: false as true };
    const forbiddenProof = buildRuntimeOrchestrationForbiddenProof();
    const blockerReport = buildUltimateGovernanceReviewPlanning().runtimeUltimateGovernanceBlockerReport;
    const summary = buildRuntimeUltimateGovernanceReviewSummary({
      reports: base,
      blockerReport,
      noEnforcementProof,
      forbiddenProof,
    });
    expect(summary.reviewStatus).toBe("blocked");
  });

  it("orchestration-forbidden proof incomplete yields blocked", () => {
    const base = buildUltimateGovernanceReviewBaseReports();
    const forbiddenProof = {
      ...buildRuntimeOrchestrationForbiddenProof(),
      actualOrchestrationForbidden: false as true,
    };
    expect(isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof)).toBe(false);
    const summary = buildRuntimeUltimateGovernanceReviewSummary({
      reports: base,
      blockerReport: buildUltimateGovernanceReviewPlanning().runtimeUltimateGovernanceBlockerReport,
      noEnforcementProof: buildRuntimeUltimateNoEnforcementProof(),
      forbiddenProof,
    });
    expect(summary.reviewStatus).toBe("blocked");
  });

  it("serializer includes twelve H40/H40.5 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForUltimateGovernanceReview();
    const bundle = serializeRuntimeUltimateGovernanceReviewDiagnosticBundleFromSemanticReports(semantic);
    expect(bundle.runtimeUltimateGovernanceReviewSummary.reviewStatus).toBe(
      semantic.runtimeUltimateGovernanceReviewSummary.reviewStatus
    );
    expect(bundle.runtimeFinalOrchestrationReadinessBoundary.boundarySourceLayer).toBe(
      "runtimeFinalReleaseGovernanceGateFinalSafetyGate"
    );
    expect(bundle.runtimeUltimateNoEnforcementProof.diagnosticOnly).toBe(true);
    expect(bundle.runtimeOrchestrationForbiddenProof.actualExecutionForbidden).toBe(true);
    expect(bundle.runtimeUltimateGovernanceReviewFinalSafetyGate).toBeDefined();
    expect(bundle.runtimeUltimateGovernanceReviewViolationReport).toBeDefined();
  });

  it("ready review with verified alignment yields final gate ready_metadata when upstream aligned", () => {
    const semantic = buildFullSemanticForUltimateGovernanceReview();
    if (
      semantic.runtimeUltimateGovernanceReviewSummary.reviewStatus === "ultimate_governance_metadata_ready" &&
      semantic.runtimeUltimateGovernanceReviewVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeUltimateGovernanceReviewAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeUltimateGovernanceReviewViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeUltimateGovernanceReviewViolationReport.proofViolations.length === 0
    ) {
      expect(semantic.runtimeUltimateGovernanceReviewFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeUltimateGovernanceReviewFinalSafetyGate.h41EntryReadiness).toBe("ready_metadata");
    }
  });

  it("stripRuntimeUltimateGovernanceReviewLayer removes H40 fields only", () => {
    const semantic = buildFullSemanticForUltimateGovernanceReview();
    const stripped = stripRuntimeUltimateGovernanceReviewLayer(semantic);
    expect("runtimeUltimateGovernanceReviewSummary" in stripped).toBe(false);
    expect(stripped.runtimeFinalReleaseGovernanceGateSummary.mode).toBe(
      "runtime_final_release_governance_gate_summary"
    );
  });
});
