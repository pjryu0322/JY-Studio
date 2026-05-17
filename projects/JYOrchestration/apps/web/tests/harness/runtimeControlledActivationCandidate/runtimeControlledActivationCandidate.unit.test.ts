import { describe, expect, it } from "vitest";

import { detectRuntimeControlledActivationCandidateViolations } from "@/lib/harness/runtimeControlledActivationCandidate/detectRuntimeControlledActivationCandidateViolations";
import { serializeRuntimeControlledActivationCandidateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlledActivationCandidate/serializeRuntimeControlledActivationCandidateDiagnosticBundle";
import {
  buildControlledActivationCandidateBaseReports,
  buildControlledActivationCandidatePlanning,
  buildControlledActivationWatchScenarioPatches,
  buildFullSemanticForControlledActivationCandidate,
} from "./runtimeControlledActivationCandidateTestFixtures";

describe("H41 controlled activation candidate", () => {
  it("full semantic includes H41 reports with all actual flags false", () => {
    const semantic = buildFullSemanticForControlledActivationCandidate();
    expect(semantic.runtimeControlledActivationCandidateSummary.mode).toBe(
      "runtime_controlled_activation_candidate_summary"
    );
    expect(semantic.runtimeControlledActivationCandidateSummary.actualControlledActivationEnabled).toBe(false);
    expect(semantic.runtimeControlledActivationCandidateSummary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(semantic.runtimeControlledActivationCandidateSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeControlledActivationCandidateSummary.actualExecutionBlockingEnabled).toBe(false);
    expect(semantic.runtimeControlledActivationCandidateSummary.actualMergeBlockingEnabled).toBe(false);
    expect(semantic.runtimeControlHandoffBoundary.boundaryTargetLayer).toBe("runtimeControlHandoffBoundary");
    expect(semantic.runtimeControlledActivationCandidatePolicy.actualControlledActivationForbidden).toBe(true);
  });

  it("ultimate final gate ready + verified + aligned yields controlled_activation_metadata_candidate when aligned", () => {
    const semantic = buildFullSemanticForControlledActivationCandidate();
    if (
      semantic.runtimeUltimateGovernanceReviewFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeUltimateGovernanceReviewFinalSafetyGate.h41EntryReadiness === "ready_metadata" &&
      semantic.runtimeUltimateGovernanceReviewVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeUltimateGovernanceReviewAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeUltimateGovernanceReviewViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeUltimateGovernanceReviewViolationReport.proofViolations.length === 0
    ) {
      expect(semantic.runtimeControlledActivationCandidateSummary.candidateStatus).toBe(
        "controlled_activation_metadata_candidate"
      );
      expect(semantic.runtimeControlledActivationCandidateSummary.activationMode).toBe("metadata_only");
    }
  });

  it("ultimate final gate watch yields watch", () => {
    const base = buildControlledActivationCandidateBaseReports();
    const activation = buildControlledActivationCandidatePlanning(buildControlledActivationWatchScenarioPatches(base));
    expect(activation.runtimeControlledActivationCandidateSummary.candidateStatus).toBe("watch");
    expect(activation.runtimeControlledActivationCandidateSummary.activationMode).toBe("disabled");
  });

  it("ultimate final gate blocked yields blocked", () => {
    const base = buildControlledActivationCandidateBaseReports();
    const activation = buildControlledActivationCandidatePlanning({
      runtimeUltimateGovernanceReviewFinalSafetyGate: {
        ...base.runtimeUltimateGovernanceReviewFinalSafetyGate,
        finalGateStatus: "blocked",
        h41EntryReadiness: "blocked",
      },
    });
    expect(activation.runtimeControlledActivationCandidateSummary.candidateStatus).toBe("blocked");
    expect(activation.runtimeControlledActivationCandidateSummary.activationMode).toBe("blocked");
  });

  it("ultimate verification failed yields blocked", () => {
    const base = buildControlledActivationCandidateBaseReports();
    const activation = buildControlledActivationCandidatePlanning({
      runtimeUltimateGovernanceReviewVerificationReport: {
        ...base.runtimeUltimateGovernanceReviewVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(activation.runtimeControlledActivationCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("ultimate alignment failed yields blocked", () => {
    const base = buildControlledActivationCandidateBaseReports();
    const activation = buildControlledActivationCandidatePlanning({
      runtimeUltimateGovernanceReviewAlignmentReport: {
        ...base.runtimeUltimateGovernanceReviewAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(activation.runtimeControlledActivationCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("ultimate actual flag violation yields blocked", () => {
    const base = buildControlledActivationCandidateBaseReports();
    const activation = buildControlledActivationCandidatePlanning({
      runtimeUltimateGovernanceReviewViolationReport: {
        ...base.runtimeUltimateGovernanceReviewViolationReport,
        actualFlagViolations: ["runtimeUltimateGovernanceReviewSummary.actualExecutionEnabled must be false"],
      },
    });
    expect(activation.runtimeControlledActivationCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("serializer exposes ten H41/H41.5 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForControlledActivationCandidate();
    const serialized = serializeRuntimeControlledActivationCandidateDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(serialized)).toHaveLength(10);
    expect(serialized.runtimeControlledActivationCandidateSummary.candidateStatus).toBe(
      semantic.runtimeControlledActivationCandidateSummary.candidateStatus
    );
    expect(serialized.runtimeControlHandoffBoundary.boundarySourceLayer).toBe(
      "runtimeUltimateGovernanceReviewFinalSafetyGate"
    );
    expect(serialized.runtimeControlledActivationCandidateFinalSafetyGate).toBeDefined();
    expect(serialized.runtimeControlledActivationCandidateViolationReport).toBeDefined();
  });

  it("ready candidate with verified alignment yields final gate ready_metadata when upstream aligned", () => {
    const semantic = buildFullSemanticForControlledActivationCandidate();
    if (
      semantic.runtimeControlledActivationCandidateSummary.candidateStatus ===
        "controlled_activation_metadata_candidate" &&
      semantic.runtimeControlledActivationCandidateVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeControlledActivationCandidateAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeControlledActivationCandidateViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeControlledActivationCandidateViolationReport.policyViolations.length === 0
    ) {
      expect(semantic.runtimeControlledActivationCandidateFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeControlledActivationCandidateFinalSafetyGate.h42EntryReadiness).toBe("ready_metadata");
    }
  });

  it("policy forbidden false yields policy violation", () => {
    const semantic = buildFullSemanticForControlledActivationCandidate();
    const violation = detectRuntimeControlledActivationCandidateViolations({
      summary: semantic.runtimeControlledActivationCandidateSummary,
      policy: {
        ...semantic.runtimeControlledActivationCandidatePolicy,
        actualControlledActivationForbidden: false as true,
      },
    });
    expect(violation.policyViolations.length).toBeGreaterThan(0);
  });
});
