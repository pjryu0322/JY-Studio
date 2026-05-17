import { describe, expect, it } from "vitest";

import { resolveRuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationCheckHelpers";
import { serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimePilotValidation/serializeRuntimePilotValidationDiagnosticBundle";
import {
  assertRuntimeActualFlagsDisabled,
  prefixRuntimeInvariantViolations,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyInvariants";
import { buildPilotValidationUserSummaryVmFromReports } from "@/lib/overlay-ui/pilotValidationUserSummaryVm";
import {
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForPilotValidation,
  buildPilotValidationBaseReports,
  buildPilotValidationPlanning,
  buildPilotValidationPlanningWithControlledCandidatePatches,
} from "./runtimePilotValidationTestFixtures";

describe("Pilot Validation Phase 0 read-only chain", () => {
  it("full semantic includes pilot validation summary with actual flags false", () => {
    const semantic = buildFullSemanticForPilotValidation();
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.mode).toBe(
      "runtime_pilot_validation_read_only_chain_summary"
    );
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.actualPilotActivationEnabled).toBe(false);
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.actualPilotExecutionEnabled).toBe(false);
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.actualSandboxInvocationEnabled).toBe(false);
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.actualExecutionEnabled).toBe(false);
    expect(
      prefixRuntimeInvariantViolations(
        "runtimePilotValidationReadOnlyChainSummary",
        assertRuntimeActualFlagsDisabled(semantic.runtimePilotValidationReadOnlyChainSummary, {
          allowMissing: true,
        })
      )
    ).toEqual([]);
  });

  it("ready_metadata final gate + verified + aligned + no violations yields ready_for_validation when aligned", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const gate = semantic.runtimeControlledPilotExecutionCandidateFinalSafetyGate;
    const verification = semantic.runtimeControlledPilotExecutionCandidateVerificationReport;
    const alignment = semantic.runtimeControlledPilotExecutionCandidateAlignmentReport;
    const violation = semantic.runtimeControlledPilotExecutionCandidateViolationReport;
    const blockers = semantic.runtimeControlledPilotExecutionCandidateBlockerReport;
    if (
      gate.finalGateStatus === "ready_metadata" &&
      gate.pilotValidationEntryReadiness === "ready_metadata" &&
      verification.verificationStatus === "verified_metadata" &&
      alignment.alignmentStatus === "aligned_metadata" &&
      violation.actualFlagViolations.length === 0 &&
      violation.policyViolations.length === 0 &&
      violation.wordingRiskFindings.length === 0 &&
      blockers.blockers.length === 0
    ) {
      expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("ready_for_validation");
      expect(resolveRuntimePilotValidationReadOnlyChainStatus(semantic)).toBe("ready_for_validation");
    }
  });

  it("watch final gate yields watch validation status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanningWithControlledCandidatePatches(
      buildControlledPilotExecutionWatchScenarioPatches(base)
    );
    expect(semantic.runtimeControlledPilotExecutionCandidateFinalSafetyGate.finalGateStatus).toBe("watch");
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("watch");
  });

  it("blocked final gate yields blocked validation status", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateFinalSafetyGate: {
        ...base.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        pilotValidationEntryReadiness: "blocked",
      },
    });
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("blocked");
  });

  it("verification failed yields blocked", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateVerificationReport: {
        ...base.runtimeControlledPilotExecutionCandidateVerificationReport,
        verificationStatus: "failed",
      },
    });
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("blocked");
  });

  it("alignment failed yields blocked", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateAlignmentReport: {
        ...base.runtimeControlledPilotExecutionCandidateAlignmentReport,
        alignmentStatus: "failed",
      },
    });
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("blocked");
  });

  it("violation exists yields blocked", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateViolationReport: {
        ...base.runtimeControlledPilotExecutionCandidateViolationReport,
        policyViolations: ["runtimeControlledPilotExecutionCandidatePolicy.actualPilotActivationForbidden must be true"],
      },
    });
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("blocked");
  });

  it("blocker exists yields blocked", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateBlockerReport: {
        ...base.runtimeControlledPilotExecutionCandidateBlockerReport,
        blockers: ["pilot execution readiness final safety gate blocked"],
      },
    });
    expect(semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus).toBe("blocked");
  });

  it("serializer exposes pilot validation summary without rebuilding", () => {
    const semantic = buildFullSemanticForPilotValidation();
    const diag = serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(semantic);
    expect(Object.keys(diag)).toEqual(["runtimePilotValidationReadOnlyChainSummary"]);
    expect((diag.runtimePilotValidationReadOnlyChainSummary as { mode: string }).mode).toBe(
      "runtime_pilot_validation_read_only_chain_summary"
    );
  });

  it("user summary vm ready_for_validation labels", () => {
    const semantic = buildFullSemanticForPilotValidation();
    if (semantic.runtimePilotValidationReadOnlyChainSummary.validationStatus !== "ready_for_validation") {
      return;
    }
    const userVm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(userVm.statusKo).toBe("파일럿 검증 준비됨");
    expect(userVm.primaryActionLabelKo).toBe("검증 결과 보기");
    expect(userVm.secondaryActionLabelKo).toBe("파일럿 실행 검증 준비");
    expect(userVm.canRequestPilotValidation).toBe(true);
    expect(userVm.prohibitedOperationRows.length).toBeGreaterThan(0);
  });

  it("user summary vm blocked labels", () => {
    const base = buildPilotValidationBaseReports();
    const semantic = buildPilotValidationPlanning({
      runtimeControlledPilotExecutionCandidateFinalSafetyGate: {
        ...base.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
        finalGateStatus: "blocked",
        pilotValidationEntryReadiness: "blocked",
      },
    });
    const userVm = buildPilotValidationUserSummaryVmFromReports(semantic);
    expect(userVm.statusKo).toBe("파일럿 검증 차단");
    expect(userVm.primaryActionLabelKo).toBe("차단 사유 보기");
    expect(userVm.secondaryActionLabelKo).toBe("AI 개발자에게 보완 요청");
    expect(userVm.canRequestPilotValidation).toBe(false);
  });
});
