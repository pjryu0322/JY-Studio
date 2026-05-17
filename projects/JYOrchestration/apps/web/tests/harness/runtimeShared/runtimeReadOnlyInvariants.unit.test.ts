import { describe, expect, it } from "vitest";

import { RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateConstants";
import { RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewConstants";
import { buildRuntimeOrchestrationForbiddenProof } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeOrchestrationForbiddenProof";
import { buildRuntimeUltimateNoEnforcementProof } from "@/lib/harness/runtimeUltimateGovernanceReview/buildRuntimeUltimateNoEnforcementProof";
import { isRuntimeOrchestrationForbiddenProofComplete } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewCheckHelpers";

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
});
