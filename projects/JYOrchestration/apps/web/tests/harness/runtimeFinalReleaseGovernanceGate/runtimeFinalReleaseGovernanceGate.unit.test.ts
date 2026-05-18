import { describe, expect, it } from "vitest";

import { buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate";
import { verifyRuntimeFinalReleaseGovernanceGateReadiness } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/verifyRuntimeFinalReleaseGovernanceGateReadiness";
import { serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundle";
import {
  stripRuntimeFinalReleaseGovernanceGateLayer,
  stripRuntimeGovernanceReleaseReadinessLayer,
} from "../runtimePlanningReportStrip";
import {
  buildFinalReleaseGatePlanningReports,
  buildFinalReleaseGovernanceGateBaseReports,
  buildFullSemanticForFinalReleaseGovernanceGate,
  detectFinalReleaseGatePolicyViolation,
  detectFinalReleaseGateSummaryViolation,
  releaseReadinessBlockedUpstreamPatches,
  releaseReadinessWatchUpstreamPatches,
} from "./runtimeFinalReleaseGovernanceGateTestFixtures";

describe("H39 / H39.5 final release governance gate candidate", () => {
  it("full semantic includes final release governance gate with all actual flags false", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.mode).toBe(
      "runtime_final_release_governance_gate_summary"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateViolationReport.mode).toBe(
      "runtime_final_release_governance_gate_violation_report"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateVerificationReport.mode).toBe(
      "runtime_final_release_governance_gate_verification_report"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateAlignmentReport.mode).toBe(
      "runtime_final_release_governance_gate_alignment_report"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.mode).toBe(
      "runtime_final_release_governance_gate_final_safety_gate"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.h40EntryReadiness).toBe(
      semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.finalGateStatus
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualExecutionEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualExecutionBlockingEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGateSummary.actualMergeBlockingEnabled).toBe(false);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionBlockingForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGatePolicy.actualMergeBlockingForbidden).toBe(true);
    expect(semantic.runtimeFinalReleaseGovernanceGateScope.candidateSourceLayer).toBe(
      "runtimeGovernanceReleaseReadinessFinalSafetyGate"
    );
    expect(semantic.runtimeFinalReleaseGovernanceGateScope.candidateTargetLayer).toBe(
      "finalReleaseGovernanceGateCandidate"
    );
  });

  it("release final gate ready yields final_release_governance_gate_metadata_candidate when aligned", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    if (
      semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.finalGateStatus === "ready_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessFinalSafetyGate.h39EntryReadiness === "ready_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.actualFlagViolations.length === 0 &&
      semantic.runtimeGovernanceReleaseReadinessViolationReport.proofViolations.length === 0 &&
      semantic.runtimeFinalReleaseGovernanceGateBlockerReport.blockers.length === 0
    ) {
      expect(semantic.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe(
        "final_release_governance_gate_metadata_candidate"
      );
      expect(semantic.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("metadata_only");
    }
  });

  it("release final gate watch yields gate watch when built in isolation", () => {
    const base = buildFinalReleaseGovernanceGateBaseReports();
    const gate = buildFinalReleaseGatePlanningReports(releaseReadinessWatchUpstreamPatches(base));
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe("watch");
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("disabled");
  });

  it("blocked release readiness yields gate blocked", () => {
    const base = buildFinalReleaseGovernanceGateBaseReports();
    const gate = buildFinalReleaseGatePlanningReports(releaseReadinessBlockedUpstreamPatches(base));
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe("blocked");
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.gateMode).toBe("blocked");
    expect(gate.runtimeFinalReleaseGovernanceGateBlockerReport.blockers.length).toBeGreaterThan(0);
  });

  it("metadata candidate + verified + aligned yields final gate ready_metadata", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    if (
      semantic.runtimeFinalReleaseGovernanceGateSummary.candidateStatus ===
        "final_release_governance_gate_metadata_candidate" &&
      semantic.runtimeFinalReleaseGovernanceGateSummary.gateMode === "metadata_only" &&
      semantic.runtimeFinalReleaseGovernanceGateVerificationReport.verificationStatus === "verified_metadata" &&
      semantic.runtimeFinalReleaseGovernanceGateAlignmentReport.alignmentStatus === "aligned_metadata" &&
      semantic.runtimeFinalReleaseGovernanceGateViolationReport.actualFlagViolations.length === 0
    ) {
      expect(semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.finalGateStatus).toBe("ready_metadata");
      expect(semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.h40EntryReadiness).toBe("ready_metadata");
    }
  });

  it.each([
    ["actualExecutionForbidden", { actualExecutionForbidden: false as unknown as true }],
    ["actualApprovalEnforcementForbidden", { actualApprovalEnforcementForbidden: false as unknown as true }],
    ["actualExecutionBlockingForbidden", { actualExecutionBlockingForbidden: false as unknown as true }],
    ["actualMergeBlockingForbidden", { actualMergeBlockingForbidden: false as unknown as true }],
  ] as const)("policy %s false yields violation", (needle, policyPatch) => {
    const partial = buildFinalReleaseGatePlanningReports();
    const violation = detectFinalReleaseGatePolicyViolation(partial, policyPatch);
    expect(violation.actualFlagViolations.some((v) => v.includes(needle))).toBe(true);
  });

  it.each([
    ["actualExecutionEnabled", { actualExecutionEnabled: true as unknown as false }],
    ["actualExecutionBlockingEnabled", { actualExecutionBlockingEnabled: true as unknown as false }],
    ["actualMergeBlockingEnabled", { actualMergeBlockingEnabled: true as unknown as false }],
  ] as const)("summary %s true yields violation", (needle, summaryPatch) => {
    const partial = buildFinalReleaseGatePlanningReports();
    const violation = detectFinalReleaseGateSummaryViolation(partial, summaryPatch);
    expect(violation.actualFlagViolations.some((v) => v.includes(needle))).toBe(true);
  });

  it("gateMode and policy mismatch yields verification partial or failed", () => {
    const partial = buildFinalReleaseGatePlanningReports();
    const verification = verifyRuntimeFinalReleaseGovernanceGateReadiness({
      summary: {
        ...partial.runtimeFinalReleaseGovernanceGateSummary,
        candidateStatus: "final_release_governance_gate_metadata_candidate",
        gateMode: "metadata_only",
      },
      scope: partial.runtimeFinalReleaseGovernanceGateScope,
      policy: {
        ...partial.runtimeFinalReleaseGovernanceGatePolicy,
        gateAllowedMode: "disabled",
      },
      checklist: partial.runtimeFinalReleaseGovernanceGateReadinessChecklist,
      blockerReport: partial.runtimeFinalReleaseGovernanceGateBlockerReport,
    });
    expect(["partial", "failed"]).toContain(verification.verificationStatus);
    expect(verification.findings.some((f) => f.includes("gateAllowedMode"))).toBe(true);
  });

  it("alignment failed yields final gate blocked", () => {
    const partial = buildFinalReleaseGatePlanningReports();
    const finalGate = buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate({
      summary: partial.runtimeFinalReleaseGovernanceGateSummary,
      blockerReport: partial.runtimeFinalReleaseGovernanceGateBlockerReport,
      boundaryViolation: partial.runtimeFinalReleaseGovernanceGateViolationReport,
      readinessVerification: {
        ...partial.runtimeFinalReleaseGovernanceGateVerificationReport,
        verificationStatus: "verified_metadata",
      },
      alignmentReport: {
        ...partial.runtimeFinalReleaseGovernanceGateAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(finalGate.finalGateStatus).toBe("blocked");
    expect(finalGate.h40EntryReadiness).toBe("blocked");
  });

  it("blocked candidate yields final gate blocked", () => {
    const gate = buildFinalReleaseGatePlanningReports(
      releaseReadinessBlockedUpstreamPatches(buildFinalReleaseGovernanceGateBaseReports())
    );
    expect(gate.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe("blocked");
    expect(gate.runtimeFinalReleaseGovernanceGateFinalSafetyGate.finalGateStatus).toBe("blocked");
  });

  it("watch candidate with partial verification yields final gate watch", () => {
    const partial = buildFinalReleaseGatePlanningReports();
    const finalGate = buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate({
      summary: {
        ...partial.runtimeFinalReleaseGovernanceGateSummary,
        candidateStatus: "watch",
        gateMode: "disabled",
        gateBlockers: [],
      },
      blockerReport: {
        ...partial.runtimeFinalReleaseGovernanceGateBlockerReport,
        blockers: [],
      },
      boundaryViolation: {
        ...partial.runtimeFinalReleaseGovernanceGateViolationReport,
        actualFlagViolations: [],
        wordingRiskFindings: [],
      },
      readinessVerification: {
        ...partial.runtimeFinalReleaseGovernanceGateVerificationReport,
        verificationStatus: "partial",
      },
      alignmentReport: {
        ...partial.runtimeFinalReleaseGovernanceGateAlignmentReport,
        alignmentStatus: "partial",
      },
    });
    expect(finalGate.finalGateStatus).toBe("watch");
    expect(finalGate.h40EntryReadiness).toBe("watch");
  });

  it("serializer includes nine H39/H39.5 fields without rebuilding reports", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    const bundle = serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundleFromSemanticReports(semantic);
    expect(bundle.runtimeFinalReleaseGovernanceGateSummary.candidateStatus).toBe(
      semantic.runtimeFinalReleaseGovernanceGateSummary.candidateStatus
    );
    expect(bundle.runtimeFinalReleaseGovernanceGateScope.candidateTargetLayer).toBe(
      "finalReleaseGovernanceGateCandidate"
    );
    expect(bundle.runtimeFinalReleaseGovernanceGatePolicy.actualExecutionBlockingForbidden).toBe(true);
    expect(bundle.runtimeFinalReleaseGovernanceGateBlockerReport.mode).toBe(
      "runtime_final_release_governance_gate_blocker_report"
    );
    expect(bundle.runtimeFinalReleaseGovernanceGateReadinessChecklist.mode).toBe(
      "runtime_final_release_governance_gate_readiness_checklist"
    );
    expect(bundle.runtimeFinalReleaseGovernanceGateViolationReport).toBeDefined();
    expect(bundle.runtimeFinalReleaseGovernanceGateVerificationReport).toBeDefined();
    expect(bundle.runtimeFinalReleaseGovernanceGateAlignmentReport).toBeDefined();
    expect(bundle.runtimeFinalReleaseGovernanceGateFinalSafetyGate).toEqual(
      expect.objectContaining({
        finalGateStatus: semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.finalGateStatus,
        h40EntryReadiness: semantic.runtimeFinalReleaseGovernanceGateFinalSafetyGate.h40EntryReadiness,
      })
    );
  });

  it("stripRuntimeFinalReleaseGovernanceGateLayer removes H39 fields only", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    const stripped = stripRuntimeFinalReleaseGovernanceGateLayer(semantic);
    expect("runtimeFinalReleaseGovernanceGateSummary" in stripped).toBe(false);
    expect(stripped.runtimeGovernanceReleaseReadinessSummary.mode).toBe(
      "runtime_governance_release_readiness_summary"
    );
  });

  it("stripRuntimeGovernanceReleaseReadinessLayer removes H38 and H39 fields", () => {
    const semantic = buildFullSemanticForFinalReleaseGovernanceGate();
    const stripped = stripRuntimeGovernanceReleaseReadinessLayer(semantic);
    expect("runtimeFinalReleaseGovernanceGateSummary" in stripped).toBe(false);
    expect("runtimeGovernanceReleaseReadinessSummary" in stripped).toBe(false);
    expect(stripped.runtimeExecutionGovernanceBoundarySummary.mode).toBe(
      "runtime_execution_governance_boundary_summary"
    );
  });
});
