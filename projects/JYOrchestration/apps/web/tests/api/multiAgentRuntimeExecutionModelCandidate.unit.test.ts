import { describe, expect, it } from "vitest";
import {
  buildDefaultRuntimeExecutionModelCandidates,
  buildStage6BReadyCandidateInput,
  buildStage6BRuntimeExecutionModelCandidateConfirmedInput,
  evaluateRuntimeExecutionModelCandidate,
  validateRuntimeExecutionModelCandidates,
} from "@/lib/agents/evaluateRuntimeExecutionModelCandidate";
import { buildStage6AReadyBaselineInput } from "@/lib/agents/evaluateRuntimeExecutionModelBaseline";

function evaluateReadyCandidate(input: Parameters<typeof evaluateRuntimeExecutionModelCandidate>[0] = {}) {
  return evaluateRuntimeExecutionModelCandidate({ ...buildStage6BReadyCandidateInput(), ...input });
}

describe("multi-agent runtime execution model candidate stage 6-B", () => {
  it("default input defers", () => {
    expect(evaluateRuntimeExecutionModelCandidate().decision).toBe("defer");
  });

  it("baseline defer propagates defer", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: { stage5Closure: { stage5AClosureReviewConfirmed: false } },
      }).decision,
    ).toBe("defer");
  });

  it("baseline blocked propagates blocked", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: { stage5Closure: { stage5AClosure: { agentTypes: ["unknown_role"] } } },
      }).decision,
    ).toBe("blocked");
  });

  it("baseline ready with three confirmations yields ready_for_runtime_execution_model_review", () => {
    expect(evaluateReadyCandidate().decision).toBe("ready_for_runtime_execution_model_review");
  });

  it("modelCandidates includes 7 required kinds", () => {
    const kinds = evaluateReadyCandidate().modelCandidates.map((c) => c.kind);
    expect(kinds).toContain("RuntimeExecutionRequest");
    expect(kinds).toContain("RuntimeExecutionPlan");
    expect(kinds).toContain("RuntimeExecutionStep");
    expect(kinds).toContain("RuntimeExecutionResult");
    expect(kinds).toContain("RuntimeExecutionFinding");
    expect(kinds).toContain("RuntimeExecutionApprovalState");
    expect(kinds).toContain("RuntimeExecutionRollbackPlan");
    expect(kinds).toHaveLength(7);
  });

  it("each modelCandidate.persistenceCandidateOnly is true", () => {
    expect(evaluateReadyCandidate().modelCandidates.every((c) => c.persistenceCandidateOnly === true)).toBe(true);
  });

  it("actualExecutionWireAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualExecutionWireAllowedInThisStep).toBe(false);
  });

  it("actualPersistenceAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualPersistenceAllowedInThisStep).toBe(false);
  });

  it("actualExternalSideEffectAllowedInThisStep is false", () => {
    expect(evaluateReadyCandidate().actualExternalSideEffectAllowedInThisStep).toBe(false);
  });

  it("RuntimeExecutionRequest has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionRequest");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "projectId", "requestedBy", "executionGoal", "createdAt"]),
    );
  });

  it("RuntimeExecutionPlan has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionPlan");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "steps", "approvalState", "rollbackPlan"]),
    );
  });

  it("RuntimeExecutionStep has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionStep");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "planId", "sequence", "unitKind", "status"]),
    );
  });

  it("RuntimeExecutionResult has required proposed fields", () => {
    const model = evaluateReadyCandidate().modelCandidates.find((c) => c.kind === "RuntimeExecutionResult");
    expect(model?.proposedFields).toEqual(
      expect.arrayContaining(["id", "requestId", "status", "summary", "findings"]),
    );
  });

  it("findings include runtime_execution_model_candidate_created", () => {
    expect(
      evaluateReadyCandidate().findings.some((f) => f.code === "runtime_execution_model_candidate_created"),
    ).toBe(true);
  });

  it("findings include runtime_execution_model_candidate_only", () => {
    expect(
      evaluateReadyCandidate().findings.some((f) => f.code === "runtime_execution_model_candidate_only"),
    ).toBe(true);
  });

  it("missing runtimeModelReviewConfirmed yields defer", () => {
    expect(
      evaluateRuntimeExecutionModelCandidate({
        baseline: buildStage6AReadyBaselineInput(),
        ...buildStage6BRuntimeExecutionModelCandidateConfirmedInput(),
        runtimeModelReviewConfirmed: false,
      }).decision,
    ).toBe("defer");
  });

  it("validateRuntimeExecutionModelCandidates fails when kind missing", () => {
    const incomplete = buildDefaultRuntimeExecutionModelCandidates().filter(
      (c) => c.kind !== "RuntimeExecutionRollbackPlan",
    );
    expect(validateRuntimeExecutionModelCandidates(incomplete).hasRequiredModelKinds).toBe(false);
  });

  it("candidateOnly is true", () => {
    expect(evaluateReadyCandidate().candidateOnly).toBe(true);
  });
});
