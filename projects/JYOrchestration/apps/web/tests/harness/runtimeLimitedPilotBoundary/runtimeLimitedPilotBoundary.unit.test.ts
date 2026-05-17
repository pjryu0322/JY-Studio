import { describe, expect, it } from "vitest";

import { detectRuntimeLimitedPilotBoundaryViolations } from "@/lib/harness/runtimeLimitedPilotBoundary/detectRuntimeLimitedPilotBoundaryViolations";
import { serializeRuntimeLimitedPilotBoundaryDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeLimitedPilotBoundary/serializeRuntimeLimitedPilotBoundaryDiagnosticBundle";
import {
  buildFullSemanticForLimitedPilotBoundary,
  buildLimitedPilotBoundaryBaseReports,
  buildLimitedPilotBoundaryPlanning,
  buildLimitedPilotWatchScenarioPatches,
} from "./runtimeLimitedPilotBoundaryTestFixtures";

describe("H42 limited pilot boundary", () => {
  it("full semantic includes H42 reports with pilot actual flags false", () => {
    const semantic = buildFullSemanticForLimitedPilotBoundary();
    expect(semantic.runtimeLimitedPilotBoundarySummary.mode).toBe("runtime_limited_pilot_boundary_summary");
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualIsolatedRunnerInvocationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundarySummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeLimitedPilotBoundaryPolicy.actualPilotActivationForbidden).toBe(true);
    expect(semantic.runtimeLimitedPilotInputContract.contractRows.length).toBeGreaterThan(0);
    expect(semantic.runtimeLimitedPilotOutputContract.contractRows.length).toBeGreaterThan(0);
  });

  it("controlled activation final gate ready + verified + aligned yields limited_pilot_boundary_metadata_candidate when aligned", () => {
    const semantic = buildFullSemanticForLimitedPilotBoundary();
    if (
      semantic.runtimeControlledActivationCandidateFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeControlledActivationCandidateFinalSafetyGate.h42EntryReadiness === "ready_metadata" &&
      semantic.runtimeControlledActivationCandidateVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeControlledActivationCandidateAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeControlledActivationCandidateViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeControlledActivationCandidateViolationReport.policyViolations.length === 0
    ) {
      expect(semantic.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe(
        "limited_pilot_boundary_metadata_candidate"
      );
      expect(semantic.runtimeLimitedPilotBoundarySummary.pilotBoundaryMode).toBe("metadata_only");
    }
  });

  it("controlled activation final gate watch yields watch", () => {
    const base = buildLimitedPilotBoundaryBaseReports();
    const pilot = buildLimitedPilotBoundaryPlanning(buildLimitedPilotWatchScenarioPatches(base));
    expect(pilot.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe("watch");
    expect(pilot.runtimeLimitedPilotBoundarySummary.pilotBoundaryMode).toBe("disabled");
  });

  it("controlled activation final gate blocked yields blocked", () => {
    const base = buildLimitedPilotBoundaryBaseReports();
    const pilot = buildLimitedPilotBoundaryPlanning({
      runtimeControlledActivationCandidateFinalSafetyGate: {
        ...base.runtimeControlledActivationCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        h42EntryReadiness: "blocked",
      },
    });
    expect(pilot.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe("blocked");
    expect(pilot.runtimeLimitedPilotBoundarySummary.pilotBoundaryMode).toBe("blocked");
  });

  it("controlled activation verification failed yields blocked", () => {
    const base = buildLimitedPilotBoundaryBaseReports();
    const pilot = buildLimitedPilotBoundaryPlanning({
      runtimeControlledActivationCandidateVerificationReport: {
        ...base.runtimeControlledActivationCandidateVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(pilot.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("controlled activation alignment failed yields blocked", () => {
    const base = buildLimitedPilotBoundaryBaseReports();
    const pilot = buildLimitedPilotBoundaryPlanning({
      runtimeControlledActivationCandidateAlignmentReport: {
        ...base.runtimeControlledActivationCandidateAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(pilot.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("controlled activation policy violation yields blocked", () => {
    const base = buildLimitedPilotBoundaryBaseReports();
    const pilot = buildLimitedPilotBoundaryPlanning({
      runtimeControlledActivationCandidateViolationReport: {
        ...base.runtimeControlledActivationCandidateViolationReport,
        policyViolations: ["runtimeControlledActivationCandidatePolicy.actualControlledActivationForbidden must be true"],
      },
    });
    expect(pilot.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe("blocked");
  });

  it("serializer exposes eleven H42/H42.5 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForLimitedPilotBoundary();
    const serialized = serializeRuntimeLimitedPilotBoundaryDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(serialized)).toHaveLength(11);
    expect(serialized.runtimeLimitedPilotBoundarySummary.candidateStatus).toBe(
      semantic.runtimeLimitedPilotBoundarySummary.candidateStatus
    );
    expect(serialized.runtimeLimitedPilotBoundaryScope.candidateSourceLayer).toBe(
      "runtimeControlledActivationCandidateFinalSafetyGate"
    );
    expect(serialized.runtimeLimitedPilotBoundaryFinalSafetyGate).toBeDefined();
    expect(serialized.runtimeLimitedPilotBoundaryViolationReport).toBeDefined();
  });

  it("ready candidate with verified alignment yields final gate ready_metadata when upstream aligned", () => {
    const semantic = buildFullSemanticForLimitedPilotBoundary();
    if (
      semantic.runtimeLimitedPilotBoundarySummary.candidateStatus ===
        "limited_pilot_boundary_metadata_candidate" &&
      semantic.runtimeLimitedPilotBoundaryVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeLimitedPilotBoundaryAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeLimitedPilotBoundaryViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeLimitedPilotBoundaryViolationReport.policyViolations.length === 0
    ) {
      expect(semantic.runtimeLimitedPilotBoundaryFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeLimitedPilotBoundaryFinalSafetyGate.h43EntryReadiness).toBe("ready_metadata");
    }
  });

  it("policy forbidden false yields policy violation", () => {
    const semantic = buildFullSemanticForLimitedPilotBoundary();
    const violation = detectRuntimeLimitedPilotBoundaryViolations({
      summary: semantic.runtimeLimitedPilotBoundarySummary,
      policy: {
        ...semantic.runtimeLimitedPilotBoundaryPolicy,
        actualPilotActivationForbidden: false as true,
      },
    });
    expect(violation.policyViolations.length).toBeGreaterThan(0);
  });
});
