import { describe, expect, it } from "vitest";

import { RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateConstants";
import {
  assertRuntimeActualFlagsDisabled,
  assertRuntimeForbiddenFlagsTrue,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyInvariants";
import { RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewConstants";
import { buildRuntimeOrchestrationForbiddenProof } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeOrchestrationForbiddenProof";
import { buildRuntimeUltimateNoEnforcementProof } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeUltimateNoEnforcementProof";
import { detectRuntimeUltimateGovernanceReviewViolations } from "@/lib/harness/runtimeUltimateGovernanceReview/detectRuntimeUltimateGovernanceReviewViolations";
import { isRuntimeOrchestrationForbiddenProofComplete } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewCheckHelpers";
import { buildUltimateGovernanceReviewPlanning } from "../runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewTestFixtures";

describe("runtime read-only orchestration invariants (H39/H40)", () => {
  it("H39.5 and H40 actual-disabled flags match shared canonical object", () => {
    expect(RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED).toEqual(
      RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED
    );
    expect(RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED).toEqual(
      RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED
    );
    for (const value of Object.values(RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED)) {
      expect(value).toBe(false);
    }
  });

  it("H40 no-enforcement and forbidden proofs hold diagnosticOnly and forbidden=true", () => {
    const noEnforcement = buildRuntimeUltimateNoEnforcementProof();
    const forbidden = buildRuntimeOrchestrationForbiddenProof();
    expect(noEnforcement.diagnosticOnly).toBe(true);
    expect(noEnforcement.runtimeOrchestrated).toBe(false);
    expect(noEnforcement.executionPerformed).toBe(false);
    expect(isRuntimeOrchestrationForbiddenProofComplete(forbidden)).toBe(true);
    expect(forbidden.actualOrchestrationForbidden).toBe(true);
    expect(forbidden.actualExecutionBlockingForbidden).toBe(true);
    expect(forbidden.actualRetrievalOrchestrationForbidden).toBe(true);
  });

  it("assertRuntimeActualFlagsDisabled detects violation when flag is true", () => {
    const violations = assertRuntimeActualFlagsDisabled({
      ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
      actualExecutionEnabled: true,
    });
    expect(violations).toContain("actualExecutionEnabled must be false");
  });

  it("assertRuntimeForbiddenFlagsTrue detects violation when flag is false", () => {
    const forbidden = buildRuntimeOrchestrationForbiddenProof();
    const violations = assertRuntimeForbiddenFlagsTrue({
      ...forbidden,
      actualOrchestrationForbidden: false,
    });
    expect(violations).toContain("actualOrchestrationForbidden must be true");
  });
});

describe("H40.5 ultimate governance review stabilization", () => {
  it("full semantic includes H40.5 stabilization reports", () => {
    const review = buildUltimateGovernanceReviewPlanning();
    expect(review.runtimeUltimateGovernanceReviewViolationReport.mode).toBe(
      "runtime_ultimate_governance_review_violation_report"
    );
    expect(review.runtimeUltimateGovernanceReviewFinalSafetyGate.h41EntryReadiness).toBe(
      review.runtimeUltimateGovernanceReviewFinalSafetyGate.finalGateStatus
    );
  });

  it("diagnosticOnly false yields proof violation", () => {
    const noEnforcement = { ...buildRuntimeUltimateNoEnforcementProof(), diagnosticOnly: false as true };
    const summary = buildUltimateGovernanceReviewPlanning().runtimeUltimateGovernanceReviewSummary;
    const forbidden = buildRuntimeOrchestrationForbiddenProof();
    const violation = detectRuntimeUltimateGovernanceReviewViolations({
      summary,
      noEnforcementProof: noEnforcement,
      forbiddenProof: forbidden,
    });
    expect(violation.proofViolations.some((v) => v.includes("diagnosticOnly"))).toBe(true);
  });

  it("runtimeOrchestrated true yields proof violation", () => {
    const noEnforcement = { ...buildRuntimeUltimateNoEnforcementProof(), runtimeOrchestrated: true as false };
    const violation = detectRuntimeUltimateGovernanceReviewViolations({
      summary: buildUltimateGovernanceReviewPlanning().runtimeUltimateGovernanceReviewSummary,
      noEnforcementProof: noEnforcement,
      forbiddenProof: buildRuntimeOrchestrationForbiddenProof(),
    });
    expect(violation.proofViolations.some((v) => v.includes("runtimeOrchestrated"))).toBe(true);
  });
});
