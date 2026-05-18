import { describe, expect, it } from "vitest";

import { detectRuntimeControlledPilotExecutionCandidateViolations } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/detectRuntimeControlledPilotExecutionCandidateViolations";
import { serializeRuntimeControlledPilotExecutionCandidateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/serializeRuntimeControlledPilotExecutionCandidateDiagnosticBundle";
import {
  buildControlledPilotExecutionCandidateBaseReports,
  buildControlledPilotExecutionCandidatePlanning,
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForControlledPilotExecutionCandidate,
} from "./runtimeControlledPilotExecutionCandidateTestFixtures";

describe("H45 controlled pilot execution candidate", () => {
  it("full semantic includes H45 reports with pilot actual flags false", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.mode).toBe(
      "runtime_controlled_pilot_execution_candidate_summary"
    );
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualIsolatedRunnerInvocationEnabled).toBe(
      false
    );
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualReleaseEnforcementEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualApprovalEnforcementEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualExecutionBlockingEnabled).toBe(false);
    expect(semantic.runtimeControlledPilotExecutionCandidateSummary.actualMergeBlockingEnabled).toBe(false);
    expect(semantic.runtimeFinalRuntimeHandoffBoundary.boundaryTargetLayer).toBe("finalRuntimeHandoffBoundary");
    expect(semantic.runtimeControlledPilotExecutionCandidatePolicy.actualPilotActivationForbidden).toBe(true);
    expect(semantic.runtimeControlledPilotExecutionCandidatePolicy.actualSandboxInvocationForbidden).toBe(true);
  });

  it("pilot execution readiness final gate ready_metadata + verified + aligned yields controlled_pilot_execution_metadata_candidate when aligned", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    if (
      semantic.runtimePilotExecutionReadinessFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimePilotExecutionReadinessFinalSafetyGate.h45EntryReadiness === "ready_metadata" &&
      semantic.runtimePilotExecutionReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimePilotExecutionReadinessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimePilotExecutionReadinessViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimePilotExecutionReadinessViolationReport.proofViolations.length === 0 &&
      semantic.runtimePilotExecutionReadinessViolationReport.forbiddenProofViolations.length === 0
    ) {
      expect(semantic.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe(
        "controlled_pilot_execution_metadata_candidate"
      );
      expect(semantic.runtimeControlledPilotExecutionCandidateSummary.executionMode).toBe("metadata_only");
    }
  });

  it("pilot execution readiness final gate watch yields watch", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("watch");
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.executionMode).toBe("disabled");
  });

  it("pilot execution readiness final gate blocked yields blocked", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning({
      runtimePilotExecutionReadinessFinalSafetyGate: {
        ...base.runtimePilotExecutionReadinessFinalSafetyGate,
        finalGateStatus: "blocked",
        h45EntryReadiness: "blocked",
      },
    });
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("blocked");
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.executionMode).toBe("blocked");
  });

  it("pilot execution readiness verification failed yields blocked", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning({
      runtimePilotExecutionReadinessVerificationReport: {
        ...base.runtimePilotExecutionReadinessVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("pilot execution readiness alignment failed yields blocked", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning({
      runtimePilotExecutionReadinessAlignmentReport: {
        ...base.runtimePilotExecutionReadinessAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("pilot execution readiness actual flag violation yields blocked", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning({
      runtimePilotExecutionReadinessViolationReport: {
        ...base.runtimePilotExecutionReadinessViolationReport,
        actualFlagViolations: [
          "runtimePilotExecutionReadinessSummary.actualPilotActivationEnabled must be false",
        ],
      },
    });
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("blocked");
  });

  it("controlled_pilot_execution_metadata_candidate + verified + aligned yields final gate ready_metadata when aligned", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    if (
      semantic.runtimeControlledPilotExecutionCandidateSummary.candidateStatus ===
        "controlled_pilot_execution_metadata_candidate" &&
      semantic.runtimeControlledPilotExecutionCandidateVerificationReport.verificationStatus ===
        "verified_metadata" &&
      semantic.runtimeControlledPilotExecutionCandidateAlignmentReport.alignmentStatus ===
        "aligned_metadata" &&
      semantic.runtimeControlledPilotExecutionCandidateViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeControlledPilotExecutionCandidateViolationReport.policyViolations.length === 0
    ) {
      expect(semantic.runtimeControlledPilotExecutionCandidateFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeControlledPilotExecutionCandidateFinalSafetyGate.pilotValidationEntryReadiness).toBe(
        "ready_metadata"
      );
    }
  });

  it("watch candidate yields final gate watch", () => {
    const base = buildControlledPilotExecutionCandidateBaseReports();
    const candidate = buildControlledPilotExecutionCandidatePlanning(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    expect(candidate.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe("watch");
    expect(candidate.runtimeControlledPilotExecutionCandidateFinalSafetyGate.finalGateStatus).toBe("watch");
    expect(candidate.runtimeControlledPilotExecutionCandidateFinalSafetyGate.pilotValidationEntryReadiness).toBe(
      "watch"
    );
  });

  it("policy actualPilotActivationForbidden false yields violation", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    const violation = detectRuntimeControlledPilotExecutionCandidateViolations({
      summary: semantic.runtimeControlledPilotExecutionCandidateSummary,
      policy: {
        ...semantic.runtimeControlledPilotExecutionCandidatePolicy,
        actualPilotActivationForbidden: false as true,
      },
    });
    expect(violation.policyViolations.length).toBeGreaterThan(0);
  });

  it("policy actualPilotExecutionForbidden false yields violation", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    const violation = detectRuntimeControlledPilotExecutionCandidateViolations({
      summary: semantic.runtimeControlledPilotExecutionCandidateSummary,
      policy: {
        ...semantic.runtimeControlledPilotExecutionCandidatePolicy,
        actualPilotExecutionForbidden: false as true,
      },
    });
    expect(violation.policyViolations.length).toBeGreaterThan(0);
  });

  it("serializer exposes twelve H45/H45.5 keys without rebuilding reports", () => {
    const semantic = buildFullSemanticForControlledPilotExecutionCandidate();
    const serialized = serializeRuntimeControlledPilotExecutionCandidateDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(serialized).sort()).toEqual(
      [
        "runtimeControlledPilotExecutionCandidateAlignmentReport",
        "runtimeControlledPilotExecutionCandidateBlockerReport",
        "runtimeControlledPilotExecutionCandidateFinalSafetyGate",
        "runtimeControlledPilotExecutionCandidatePolicy",
        "runtimeControlledPilotExecutionCandidateScope",
        "runtimeControlledPilotExecutionCandidateSummary",
        "runtimeControlledPilotExecutionCandidateVerificationReport",
        "runtimeControlledPilotExecutionCandidateViolationReport",
        "runtimeControlledPilotExecutionInputContract",
        "runtimeControlledPilotExecutionOutputContract",
        "runtimeControlledPilotExecutionReadinessChecklist",
        "runtimeFinalRuntimeHandoffBoundary",
      ].sort()
    );
    expect(serialized.runtimeControlledPilotExecutionCandidateSummary.candidateStatus).toBe(
      semantic.runtimeControlledPilotExecutionCandidateSummary.candidateStatus
    );
    expect(serialized.runtimeFinalRuntimeHandoffBoundary.boundarySourceLayer).toBe(
      "runtimePilotExecutionReadinessFinalSafetyGate"
    );
  });
});
